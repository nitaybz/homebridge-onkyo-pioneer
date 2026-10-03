const AVR = require('./lib/avr')
const PLUGIN_NAME = 'homebridge-onkyo-pioneer'
const PLATFORM_NAME = 'OnkyoPioneer'
const storage = require('node-persist')
const path = require('path')

const DEFAULT_STATE_POLLING_INTERVAL = 30 // seconds, matches config.schema.json
const MIN_STATE_POLLING_INTERVAL = 3 // seconds

// Always returns a finite number of seconds >= MIN_STATE_POLLING_INTERVAL.
// Missing, empty or non-numeric values fall back to the default.
const resolveStatePollingInterval = (value) => {
	if (value === undefined || value === null || value === '')
		return DEFAULT_STATE_POLLING_INTERVAL
	const seconds = Number(value)
	if (!Number.isFinite(seconds))
		return DEFAULT_STATE_POLLING_INTERVAL
	return Math.max(seconds, MIN_STATE_POLLING_INTERVAL)
}

module.exports = (api) => {
	api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, OnkyoPioneer)
}

class OnkyoPioneer {

	constructor(log, config, api) {
		this.api = api
		this.log = log
		this.storage = storage

		// this.accessories = []
		this.avrDevices = []
		this.PLUGIN_NAME = PLUGIN_NAME
		this.PLATFORM_NAME = PLATFORM_NAME
		this.name = config.name || PLATFORM_NAME
		this.discovery = config.discovery
		this.receivers = config.receivers || []
		// The config schema's default (30) only applies when the settings are saved
		// through the UI form. A config written by hand, or saved before this option
		// existed, leaves it undefined, and `undefined < 3` is false, so the minimum
		// below never applied. Receiver.js then ran setInterval(..., undefined * 1000),
		// i.e. NaN, which Node treats as 1 ms (TimeoutNaNWarning), polling the receiver
		// continuously instead of every N seconds.
		this.statePollingInterval = resolveStatePollingInterval(config.statePollingInterval)
		this.debug = config.debug || false
		this.persistPath = path.join(this.api.user.persistPath(), '/../onkyo-pioneer-persist')

		
		// define debug method to output debug logs when enabled in the config
		this.log.easyDebug = (...content) => {
			if (this.debug) {
				this.log(content.reduce((previous, current) => {
					return previous + ' ' + current
				}))
			} else
				this.log.debug(content.reduce((previous, current) => {
					return previous + ' ' + current
				}))
		}

		this.api.on('didFinishLaunching', AVR.init.bind(this))

	}

	configureAccessory(accessory) {
		this.log.easyDebug(`Found Cached Accessory: ${accessory.displayName} (${accessory.context.deviceId}) `)
		// this.accessories.push(accessory)
	}
}