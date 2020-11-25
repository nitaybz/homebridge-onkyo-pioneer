const availableInputs = require('./inputs')

module.exports = {

	getState: async function() {
		try {
			const state = {
				power: await this.avr.isOn(this.zone) ? 1 : 0,
				volume: await this.avr.getVolume(this.zone) / this.maxVolume * 100,
				mute: await this.avr.getMute(this.zone) ? 1 : 0,
				source: availableInputs[this.zone].IndexOf(await this.avr.getSource(this.zone))
			}

			this.cachedStates[this.id] = state
			await this.storage.setItem('cachedStates', this.cachedStates)
			return state

		} catch(err) {
			this.log(`Could NOT get state from "${this.name}" : ${err.message}`)
			this.log.easyDebug(err)

			if (this.id in this.cachedStates) {
				this.log.easyDebug(`${this.name} - found cached state in storage`)
				return this.cachedStates[this.id]
			} else {
				this.log(`${this.name} - Returning default values - please check your network connection`)
				return {
					power: 0,
					volume: 0,
					mute: false,
					source: 0
				}
			}
		}
	},

	set: {

		Active: function(state, callback) {
			if (state) {
				this.log(`${this.name}  - Turning ON`)
				this.avr.pwrOn(this.zone)
			} else {
				this.log(`${this.name} - Turning OFF`)
				this.avr.pwrOff(this.zone)
			}

			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback()
		},

		ActiveIdentifier: function(identifier, callback) {
			const source = availableInputs[this.zone][identifier]
			this.log(`${this.name} - Setting Source to "${source}"`)
			this.avr.setSource(source, this.zone)
			
			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback()
		},

		RemoteKey: function(key, callback) {
			const RemoteKey = this.api.hap.Characteristic.RemoteKey
			switch (key) {
				case RemoteKey.ARROW_UP:
					this.log(`${this.name} - Sending Remote Key: "UP"`)
					this.avr.sendRemoteKey("UP")
					break;
				case RemoteKey.ARROW_DOWN:
					this.log(`${this.name} - Sending Remote Key: "DOWN"`)
					this.avr.sendRemoteKey("DOWN")
					break;
				case RemoteKey.ARROW_RIGHT:
					this.log(`${this.name} - Sending Remote Key: "RIGHT"`)
					this.avr.sendRemoteKey("RIGHT")
					break;
				case RemoteKey.ARROW_LEFT:
					this.log(`${this.name} - Sending Remote Key: "LEFT"`)
					this.avr.sendRemoteKey("LEFT")
					break;
				case RemoteKey.SELECT:
					this.log(`${this.name} - Sending Remote Key: "ENTER"`)
					this.avr.sendRemoteKey("ENTER")
					break;
				case RemoteKey.BACK:
					this.log(`${this.name} - Sending Remote Key: "EXIT"`)
					this.avr.sendRemoteKey("EXIT")
					break;
				case RemoteKey.INFORMATION:
					this.log(`${this.name} - Sending Remote Key: "MENU"`)
					this.avr.sendRemoteKey("MENU")
					break;
				case RemoteKey.PLAY_PAUSE:
					this.log(`${this.name} - PLAY/PAUSE command is not available`)
					break;
				default:
			}
			
			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback()
		},

		Volume: function(volume, callback) {
			const mappedVolume = this.maxVolume / 100 * volume
			this.log(`${this.name} - Setting Volume to "${mappedVolume}"`)
			this.avr.setVolume(mappedVolume, this.zone)
			
			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback()
		},

		Mute: function(mute, callback) {
			if (mute) {
				this.log(`${this.name} - Setting Mute ON`)
				this.avr.mute(this.zone)
			} else {
				this.log(`${this.name} - Setting Mute OFF`)
				this.avr.unMute(this.zone)
			}
			
			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback()
		},

		VolumeSelector: function(decrement, callback) {
			if (decrement) {
				this.log(`${this.name} - Decrementing Volume by 1`)
				this.avr.volDown(this.zone)
			} else {
				this.log(`${this.name} - Incrementing Volume by 1`)
				this.avr.volUp(this.zone)
			}
			
			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback()
		},

		ExternalVolume: function(volume, callback) {
			const mappedVolume = this.maxVolume / 100 * volume
			this.log(`${this.name} (Ext.) - Setting Volume to "${mappedVolume}"`)
			this.avr.setVolume(mappedVolume, this.zone)
			
			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback()
		},

		ExternalMute: function(mute, callback) {
			if (mute) {
				this.log(`${this.name} (Ext.) - Setting Mute ON`)
				this.avr.mute(this.zone)
			} else {
				this.log(`${this.name} (Ext.) - Setting Mute OFF`)
				this.avr.unMute(this.zone)
			}
			
			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback()

			callback()
		}
	}
}