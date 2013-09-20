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
	SerialModes = require("./serialmodes");

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
		LOG.error("pololu-maestro", "Please pass either two COM port addresses (for USB Dual Port mode) or one COM port and one baud rate (for USB Chained mode) into the constructor.");

		return;
	}

	if(comPort instanceof SerialPortWrapper) {
		this._serialPort = comPort;
	} else if(typeof(comPort) === "string" && typeof(baudRate) == "string") {
		LOG.info("pololu-maestro", "Using USB Dual Port mode.");

		this._mode = SerialModes.USB_DUAL_PORT;
		this._serialPort = new DualModeSerialPortWrapper(comPort, baudRate);
	} else {
		if(!baudRate) {
			LOG.info("pololu-maestro", "Defaulting to baud rate of 115200");
			baudRate = 115200;
		}

		LOG.info("pololu-maestro", "Using USB Chained mode.");
		this._mode = SerialModes.USB_CHAINED;
		this._serialPort = new ChainedModeSerialPortWrapper(comPort, baudRate);
	}

	this._serialPort.on("open", this.emit.bind(this, "ready"));
	this._serialPort.on("error", this.emit.bind(this, "error"));
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
		LOG.error("pololu-maestro: target value should be 640-2304 microseconds, was: " + us);

		return;
	}

	LOG.debug("pololu-maestro: Setting channel " + channel + " target to " + us + " microseconds");
	this._sendCommand(0x84, channel, us * 4, onComplete);
};

/**
 * Sets the servo target via the mini-SCC protocol
 */
PololuMaestro.prototype.set8BitTarget = function(channel, target, onComplete) {
	if(target < 0 || target > 254) {
		LOG.error("pololu-maestro: 8 bit target value should be 0-254, was: " + target);

		return;
	}
	
	LOG.info("pololu-maestro: Setting channel " + channel + " 8 bit target to " + target + " microseconds");
	this._send8BitCommand(0xFF, channel, target, onComplete);
};

/**
 * Sets servo speed in units 1 = 0.25 μs / (10 ms).
 *
 * E.g. passing 140 to cause the servo to take 100ms to setTarget from 1000 μs to 1350 μs
 */
PololuMaestro.prototype.setSpeed = function(channel, us, onComplete) {
	if(us < 0 || us > 255) {
		LOG.error("pololu-maestro: speed value should be 0-255, was: " + us);

		return;
	}
	
	LOG.info("pololu-maestro: Setting channel " + channel + " speed to " + us + " microseconds");
	this._sendCommand(0x87, channel, us, onComplete);
};

/**
 * Sets servo acceleration in units 1 = 0.25 μs / (10 ms).
 *
 * E.g. passing 140 to cause the servo to take 100ms to setTarget from 1000 μs to 1350 μs
 */
PololuMaestro.prototype.setAcceleration = function(channel, us, onComplete) {
	if(us < 0 || us > 255) {
		LOG.error("pololu-maestro: acceleration value should be 0-255, was: " + us);

		return;
	}

	LOG.info("pololu-maestro: Setting channel " + channel + " acceleration to " + us + " microseconds");
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
			LOG.info("Position data was " + data);
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
		LOG.error("Only pins 0-11 are analog inputs.");
		
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
		LOG.error("Only pins 12+ are digital inputs.");
		
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
		if(this._mode !== SerialModes.USB_DUAL_PORT) {
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
		LOG.error("Subroutine parameter must be in the range 0-16383");

		return;
	}
	
	if(onData) {
		if(this._mode !== SerialModes.USB_DUAL_PORT) {
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

//^ Internal methods
PololuMaestro.prototype._sendCommand = function(command, channel, value, onComplete) {
	this._serialPort.write([ command, channel ].concat(ByteUtils.toLowAndHighBits(value)), onComplete);
};

PololuMaestro.prototype._send8BitCommand = function(command, channel, value, onComplete) {
	this._serialPort.write([ command, channel, value ], onComplete);
};

//} Export for the public
module.exports = PololuMaestro;