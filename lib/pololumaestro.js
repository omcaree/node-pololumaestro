/**
 * # PololuMaestro
 */

//^ imports
var LOG = require("winston"),
	EventEmitter = require("events").EventEmitter,
	ByteUtils = require("./byteutils"),
	SerialPortWrapper = require("./serialportwrapper"),
	DualModeSerialPortWrapper = require("./serialportwrapper-dualport"),
	ChainedModeSerialPortWrapper = require("./serialportwrapper-chained"),
	SERIAL_MODES = require("./serialmodes"),
	SerialPort = require("serialport"),
	TYPES = require("./types");

/**
 * Supports two constructors.  The one you use depends on what mode you have
 * your Maestro set to and if you expect to receive output from scripts
 * running on the Maestro.
 *
 * If you wish to receive output (e.g. you are going to pass an onData callback
 * to `restartScriptAtSubroutine` or `restartScriptAtSubroutineWithParameter`),
 * you must:
 *
 * * use USB Dual Port mode and
 * * connect the RX and TX pins on the Maestro.
 *
 * This is because the `serial_write_byte` command was envisioned to be
 * used to control downstream serial devices and not to communicate with the
 * host computer.
 *
 * If you do not wish to receive output, you can use either mode.
 *
 * 1. USB Dual Port mode:
 * `new Maestro("COM1", "COM2");`
 *
 * 2. USB Chained mode:
 * `new Maestro("COM1", 115200);`
 *
 * UART mode is not supported.
 */
var PololuMaestro = function(comPort, baudRate) {
	if(!comPort && !baudRate) {
		LOG.error("PololuMaestro", "Please pass either two COM port addresses (for USB Dual Port mode) or one COM port and one baud rate (for USB Chained mode) into the constructor.");

		return;
	}

	if(comPort instanceof SerialPortWrapper) {
		this._serialPort = comPort;
	} else if(typeof(comPort) === "string" && typeof(baudRate) == "string") {
		LOG.info("PololuMaestro", "Using USB Dual Port mode.");

		this.mode = SERIAL_MODES.USB_DUAL_PORT;
		this._serialPort = new DualModeSerialPortWrapper(comPort, baudRate);
	} else {
		if(!baudRate) {
			LOG.info("PololuMaestro", "Defaulting to baud rate of 115200");
			baudRate = 115200;
		}

		LOG.info("PololuMaestro", "Using USB Chained mode.");
		this.mode = SERIAL_MODES.USB_CHAINED;
		this._serialPort = new ChainedModeSerialPortWrapper(comPort, baudRate);
	}

	this._serialPort.on("open", this.emit.bind(this, "ready", this));
	this._serialPort.on("error", this.emit.bind(this, "error", this));
	this._serialPort.on("disconnected", this.emit.bind(this, "disconnected", this));
};

//} extends EventEmmiter
PololuMaestro.prototype = Object.create(EventEmitter.prototype);

/**
 * ## Servo commands
 *
 * See the [Polulu documentation](http://www.pololu.com/docs/0J40/5.e) for more information.
 */

/**
 * Sets the servo target in microseconds
 */
PololuMaestro.prototype.setTarget = function(channel, us, onComplete) {
	if(us < 640 || us > 2304) {
		LOG.error("PololuMaestro", "target value should be 640-2304 microseconds, was: ", us);

		return;
	}

	LOG.debug("PololuMaestro", "Setting channel", channel, "target to", us, "microseconds");
	this._sendCommand(0x84, channel, us * 4, onComplete);
};

/**
 * Sets the servo target via the mini-SCC protocol
 */
PololuMaestro.prototype.set8BitTarget = function(channel, target, onComplete) {
	if(target < 0 || target > 254) {
		LOG.error("PololuMaestro", "8 bit target value should be 0-254, was:", target);

		return;
	}
	
	LOG.info("PololuMaestro", "Setting channel", channel, "8 bit target to", target, "microseconds");
	this._send8BitCommand(0xFF, channel, target, onComplete);
};

/**
 * Sets servo speed in units 1 = 0.25 μs / (10 ms).
 *
 * E.g. passing 140 to cause the servo to take 100ms to setTarget from 1000 μs to 1350 μs
 */
PololuMaestro.prototype.setSpeed = function(channel, us, onComplete) {
	if(us < 0 || us > 255) {
		LOG.error("PololuMaestro", "speed value should be 0-255, was:", us);

		return;
	}
	
	LOG.info("PololuMaestro", "Setting channel", channel, "speed to", us, "microseconds");
	this._sendCommand(0x87, channel, us, onComplete);
};

/**
 * Sets servo acceleration in units 1 = 0.25 μs / (10 ms).
 *
 * E.g. passing 140 to cause the servo to take 100ms to setTarget from 1000 μs to 1350 μs
 */
PololuMaestro.prototype.setAcceleration = function(channel, us, onComplete) {
	if(us < 0 || us > 255) {
		LOG.error("PololuMaestro", "acceleration value should be 0-255, was:", us);

		return;
	}

	LOG.info("PololuMaestro", "Setting channel", channel, "acceleration to", us, "microseconds");
	this._sendCommand(0x89, channel, us, onComplete);
};

/**
 * Returns the last position sent the specified servo channel
 */
PololuMaestro.prototype.getPosition = function(channel, onPosition) {
	this._serialPort.writeAndRead([
			0x90,
			channel
		], function(data) {
			onPosition(ByteUtils.fromLowAndHigh8Bits(data));
		}.bind(this)
	);
};

/**
 * Passes true to the passed callback if any servos are moving, false otherwise
 */
PololuMaestro.prototype.getMovingState = function(channel, onData) {
	this._serialPort.writeAndRead([
			0x93,
			channel
		], function(data) {
			onData(data[0] ? true : false);
		}.bind(this)
	);
};

/**
 * Sends all servos and outputs to their home position
 */
PololuMaestro.prototype.reset = function() {
	this._serialPort.write([ 0xA2 ]);
};

/**
 * ## Input commands
 */

/**
 * Reads the state of an analog input
 */
PololuMaestro.prototype.analogRead = function(channel, onValue) {
	if(channel > 11) {
		LOG.error("PololuMaestro", "Only pins 0-11 are analog inputs.");

		return;
	}

	this._serialPort.writeAndRead(
		[0x90, channel], function(data) {
			onValue(ByteUtils.fromLowAndHigh8Bits(data));
		}
	);
};

/**
 * Reads the state of a digital input
 */
PololuMaestro.prototype.digitalRead = function(channel, onValue) {
	if(channel < 12) {
		LOG.error("PololuMaestro", "Only pins 12+ are digital inputs.");
		
		return;
	}

	this._serialPort.writeAndRead(
		[0x90, channel], function(data) {
			onValue(ByteUtils.fromLowAndHigh8Bits(data) >= 6000 ? true : false);
		}
	);
};

/**
 * ## Output commands
 *
 * The Maestro has no analog outputs, only digital.
 */

/**
 * Sets the state of a digital output
 */
PololuMaestro.prototype.digitalWrite = function(channel, value, onComplete) {
	this.setTarget(channel, value ? 2304 : 640, onComplete);
};

/**
 * ## PWM commands
 *
 * The Maestro 12, 18 & 24 have one PWM channel on pins 8, 12 & 12 respectively.
 */

/**
 * Sets PWM channel value
 */
PololuMaestro.prototype.setPWM = function(onTime, period, onComplete) {
	this._serialPort.write(
		[ 0x8A ].concat(ByteUtils.toLowAndHighBits(onTime)).concat(ByteUtils.toLowAndHighBits(period)),
		onComplete
	);
};

/**
 * ## Script commands
 *
 * See the [Pololu documentation](http://www.pololu.com/docs/0J40/5.f) for more information.
 */

/**
 * Stops a currently running script
 */
PololuMaestro.prototype.stopScript = function() {
	this._serialPort.write([ 0xA4 ]);
};


/**
 * Tells the Maestro to run the passed subroutine number.
 *
 * N.b. if you pass the onData callback, you must be running the Maestro in USB Dual Port mode.
 */
PololuMaestro.prototype.restartScriptAtSubroutine = function(subroutineNumber, onData) {
	if(onData) {
		if(this.mode !== SERIAL_MODES.USB_DUAL_PORT) {
			this.emit("error", "Must be in USB Dual Port mode to read output from subroutines");
		}

		this._serialPort.writeAndRead([ 0xA7, subroutineNumber ], onData);
	} else {
		this._serialPort.write([ 0xA7, subroutineNumber]);
	}
};

/**
 * Runs the subroutine with the passed number and sends a parameter
 *
 * N.b. if you pass the onData callback, you must be running the Maestro in USB Dual Port mode.
 */
PololuMaestro.prototype.restartScriptAtSubroutineWithParameter = function(subroutineNumber, parameter, onData) {
	if(parameter < 0 || parameter > 16383) {
		LOG.error("PololuMaestro", "Subroutine parameter must be in the range 0-16383");

		return;
	}
	
	if(onData) {
		if(this.mode !== SERIAL_MODES.USB_DUAL_PORT) {
			this.emit("error", "Must be in USB Dual Port mode to read output from subroutines");
		}

		this._serialPort.writeAndRead([ 0xA8, subroutineNumber ].concat(ByteUtils.toLowAndHighBits(parameter)), onData);
	} else {
		this._serialPort.write([ 0xA8, subroutineNumber].concat(ByteUtils.toLowAndHighBits(parameter)));
	}
};

/**
 * Passes true to the passed callback if the script is still running, otherwise false
 */
PololuMaestro.prototype.getScriptStatus = function(onStatus) {
	this._serialPort.writeAndRead([ 0xAE ], function(data) {
		onStatus(data[0] ? true : false);
	});
};

/**
 * Closes any ports this PololuMaestro has open and invokes the passed callback once closed
 */
PololuMaestro.prototype.close = function(callback) {
	this._serialPort.close(callback);
};

//^ Internal methods
PololuMaestro.prototype._sendCommand = function(command, channel, value, onComplete) {
	this._serialPort.write([ command, channel ].concat(ByteUtils.toLowAndHighBits(value)), onComplete);
};

PololuMaestro.prototype._send8BitCommand = function(command, channel, value, onComplete) {
	this._serialPort.write([ command, channel, value ], onComplete);
};

//} This is a list of ports we have previously connected to - useful if there is more than one Maestro connected
SerialPort.used = [];
POLOLU_VENDOR_ID = 0x1ffb;

/**
 * Attempts to find Maestros connected in the passed SERIAL_MODE.
 *
 * N.b. This will connect to the first eligible port(s) encountered so you might want to unplug your phone first.
 *
 * ```
 * var PololuMaestro = require("pololu-maestro");
 *
 * PololuMaestro.find(PololuMaestro.SERIAL_MODES.USB_DUAL_PORT, function(error, maestro) {
 * 	// the maestro argument is an instance of PololuMaestro or null if an error occurred
 * });
 * ```
 */
PololuMaestro.find = function(mode, callback) {
	if(mode == SERIAL_MODES.UART) {
		return callback(new Error("UART serial mode is not supported.  Please set your Maestro to use USB Dual Port or USB Chained mode."));
	}

	LOG.debug("PololuMaestro.find", "Searching for attached Pololu Maestro...");

	SerialPort.list(function (error, result) {
		var ports = [];

		result.forEach(function(port) {
			// If we've previously connected to this device, don't try again
			if(SerialPort.used.indexOf(port.comName) > -1) {
				return false;
			}

			if(port.vendorId == POLOLU_VENDOR_ID) {
				ports.push(port.comName);
			} else if(ports.length == 1 && !port.vendorId) {
				// USB Dual Port and Chained modes both open two ports but the second doesn't have a vendor id :(
				ports.push(port.comName);
			}
		});

		if(ports.length != 2) {
			return callback(new Error("Did not find enough serial ports!  Is the Maestro connected and in USB Dual Port mode?"));
		}

		LOG.debug("PololuMaestro.find", "Found", ports.length, "ports -", ports);

		var maestro;

		if(mode == SERIAL_MODES.USB_DUAL_PORT) {
			LOG.info("PololuMaestro.find", "Using command port", ports[0], "and ttl port:", ports[1]);

			// make sure we don't try to reconnect
			SerialPort.used.push(ports[0]);
			SerialPort.used.push(ports[1]);

			maestro = new PololuMaestro(ports[0], ports[1]);
		} else {
			LOG.info("PololuMaestro.find", "Using command port:", ports[0]);

			// make sure we don't try to reconnect
			SerialPort.used.push(ports[1]);

			maestro = new PololuMaestro(ports[0]);
		}

		maestro.on("ready", function(maestro) {
			callback(null, maestro);
		});
	});
}

//} Export for the public
module.exports = PololuMaestro;
module.exports.SERIAL_MODES = SERIAL_MODES;
module.exports.TYPES = TYPES;
