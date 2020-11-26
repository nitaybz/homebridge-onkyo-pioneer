const {OnkyoDiscover, Onkyo} = require('onkyo.js')
const Receiver = require('../accessories/Receiver')
const availableInputs = require('./inputs')
let logger

module.exports = {
	init: async function() {

		logger = {
			silly: this.log.easyDebug,
			info: this.log.easyDebug,
			debug: this.log.easyDebug,
			warn: this.log.easyDebug,
			error: this.log.easyDebug,
		}

		await this.storage.init({
			dir: this.persistPath,
			forgiveParseErrors: true
		})

		this.cachedDevices = await this.storage.getItem('cachedDevices') || []
		this.cachedStates = await this.storage.getItem('cachedStates') || {}

		// remove cachedDevices that were removed from config
		this.cachedDevices = this.cachedDevices.filter(cachedDevice => 
			this.receivers.find(receiver => receiver.ip === cachedDevice.address))

		for (const config of this.receivers) {

			if (!config.ip)
				continue
				
			// validate ipv4
			const IPV4 = new RegExp(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)
			if (!IPV4.test(config.ip)) {
				this.log(`"${config.ip}" is not a valid IPv4 address!!`)
				this.log(`skipping "${config.name}" device...`)
				return 
			}

			// default port
			config.port = config.port || 60128
			let avr
			try {
			// Init onkyo.js
				avr = await new Onkyo({logger, address: config.ip, port: config.port, name: config.name})
			} catch (err) {
				this.log('ERROR starting device')
				this.log(err)
			}
			this.log.info(`Scanning for "${config.ip}"`)
			// Init Scan for device
			const onkyoScan = new OnkyoDiscover({logger, broadcastAddress: config.ip, broadcastPort: config.port})
			try {
				const detected = await onkyoScan.discoverFirst()
				avr.device = detected.device
				this.log(`Found AVR "${config.name || avr.device.name}" at ${config.ip}:`)
				this.log(avr.device)
			} catch (err) {
				this.log(`Could not detect "${config.name}" receiver at ${config.ip}!`)
				this.log(`Control may not work, check your receiver network connection`)
				this.log.easyDebug(err.message)
			}
			await onkyoScan.close()

			config.id = avr.device.info ? avr.device.info.identifier : 'not-found'
			config.name = config.name || avr.device.name

			// get device from cache if exists
			let deviceConfig = this.cachedDevices.find(device => device.id === config.id || device.address === config.ip)

			if (deviceConfig) {
				// Update dynamic config params
				deviceConfig.main.volume.type = config.volumeAccessory
				deviceConfig.main.maxVolume = config.maxVolume
				deviceConfig.zone2.active = config.enableZone2
				deviceConfig.zone2.maxVolume = config.zone2MaxVolume
				deviceConfig.zone2.volume.type = config.volumeAccessory
				deviceConfig.zone3.active = config.enableZone3
				deviceConfig.zone3.maxVolume = config.zone3MaxVolume
				deviceConfig.zone3.volume.type = config.volumeAccessory
			} else {
				if (!avr.device.info) {
					// this.log(`Can't create new accessory for undetected device (${config.ip}) !`)
					// this.log(`skipping "${config.name}" device...`)
					// return
					avr.device.info = {
						modelName: "test",
						identifier: "test123"
					}
				}

				// Create config for new device
				deviceConfig = createNewConfig(config, avr)
				this.cachedDevices.push(deviceConfig)
			}

			this.log.easyDebug(`Full Device Config: ${JSON.stringify(deviceConfig)}`)
			
			// init avr accessories
			newAVR(avr, deviceConfig, this)
		}


		// update cachedDevices storage
		await this.storage.setItem('cachedDevices', this.cachedDevices)

		if (this.discovery)
			await startDiscovery.bind(this)(this.cachedDevices)

	}
}

const startDiscovery = async function() {
	const onkyoScan = new OnkyoDiscover({logger})
	this.log.info('Starting discovery of supported Onkyo/Pioneer AVR...')
	try {
		await onkyoScan.discover()
	} catch(err) {
		this.log.easyDebug(err.message)
		this.log.easyDebug(err.message)
	}

	onkyoScan.on('detected', (avr) => {
		if (!this.cachedDevices.find(cachedDevice => cachedDevice.address === avr.address)) {
			this.log('Detected unregistered supported AVR:')
			this.log(avr.device)
		}
	})

	onkyoScan.on('error', err => {
		this.log.easyDebug('Discovery Error Occurred!')
		this.log.easyDebug(err)
	})

	setTimeout(() => {
		onkyoScan.close()
		this.log('Stopping discovery')
	}, 10000)
}

const createNewConfig = (config, avr) => {
	return {
		...avr.device,
		id: config.id,
		main: {
			name: config.name,
			inputs: mapInputs('main'),
			maxVolume: config.maxVolume,
			volume: {
				name: '',
				type: config.volumeAccessory
			},
		},
		zone2: {
			active: config.enableZone2,
			name: '',
			inputs: mapInputs('zone2'),
			maxVolume: config.zone2MaxVolume,
			volume: {
				name: '',
				type: config.volumeAccessory
			},
		},
		zone3: {
			active: config.enableZone3,
			name: '',
			inputs: mapInputs('zone3'),
			maxVolume: config.zone3MaxVolume,
			volume: {
				name: '',
				type: config.volumeAccessory
			}
		}
	}
}

const getZoneConfig = (config, zone) => {
	return {
		id: config.id,
		avrName: config.main.name,
		name: config[zone].name,
		zone: zone,
		model: config.info.modelName,
		inputs: config[zone].inputs,
		volume: config[zone].volume,
		maxVolume: config[zone].maxVolume
	}
}

const newAVR = function(avr, deviceConfig, platform) {

	avr.on('error', (err) => {
		platform.log.error('ERROR OCCURRED:', err.message || err)
	})
	
	// add main zone
	new Receiver(avr, platform, getZoneConfig(deviceConfig, 'main'))

	// add zone2
	if (deviceConfig.zone2.active) {
		platform.log.easyDebug(`Adding Zone 2 for ${deviceConfig.main.name}`)
		new Receiver(avr, platform, getZoneConfig(deviceConfig, 'zone2'))
	}

	// add zone3
	if (deviceConfig.zone3.active) {
		platform.log.easyDebug(`Adding Zone 3 for ${deviceConfig.main.name}`)
		new Receiver(avr, platform, getZoneConfig(deviceConfig, 'zone3'))
	}
}

const mapInputs = function(zone) {
	return availableInputs[zone].map((input, i) => { 
		return {identifier: i, name: input, key: input, hidden: 0 }
	})
}