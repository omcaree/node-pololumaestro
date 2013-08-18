var LOG = require("winston"),
	EventEmitter = require("events").EventEmitter,
	ByteUtils = require("./byteutils"),
	SerialPortWrapper = require("./serialportwrapper");

/**
 * What you came here for.
 */
var Maestro = function(comPort, baudRate) {
	if(!comPort) {
		LOG.error("pololu-maestro: No com port specified.");
		
		return;
	}

	if(!baudRate) {
		LOG.info("pololu-maestro: No baud rate specified, defaulting to 115200");

		baudRate = 115200;
	}
	
	if(comPort instanceof SerialPortWrapper) {
		this._serialPort = comPort;
	} else {
		this._serialPort = new SerialPortWrapper(comPort, baudRate);
	}

	this._serialPort.on("open", this.emit.bind(this, "ready"));
	this._serialPort.on("error", this.emit.bind(this, "error"));
};

// extends EventEmmiter
Maestro.prototype = Object.create(EventEmitter.prototype);

/****
 *  Servo commands
 ****/

// sets the servo target in microseconds
Maestro.prototype.setTarget = function(channel, us, onComplete) {
	if(us < 640 || us > 2304) {
		LOG.error("pololu-maestro: target value should be 640-2304 microseconds, was: " + us);

		return;
	}

	LOG.debug("pololu-maestro: Setting channel " + channel + " target to " + us + " microseconds");
	this._sendCommand(0x84, channel, us * 4, onComplete);
};

// sets the servo target via the mini-SCC protocol
Maestro.prototype.set8BitTarget = function(channel, target, onComplete) {
	if(target < 0 || target > 254) {
		LOG.error("pololu-maestro: 8 bit target value should be 0-254, was: " + target);

		return;
	}
	
	LOG.info("pololu-maestro: Setting channel " + channel + " 8 bit target to " + target + " microseconds");
	this._send8BitCommand(0xFF, channel, target, onComplete);
};

// sets servo speed in units 1 = 0.25 μs / (10 ms).
// E.g. passing 140 to cause the servo to take 100ms to setTarget from 1000 μs to 1350 μs
Maestro.prototype.setSpeed = function(channel, us, onComplete) {
	if(us < 0 || us > 255) {
		LOG.error("pololu-maestro: speed value should be 0-255, was: " + us);

		return;
	}
	
	LOG.info("pololu-maestro: Setting channel " + channel + " speed to " + us + " microseconds");
	this._sendCommand(0x87, channel, us, onComplete);
};

// sets servo acceleration in units 1 = 0.25 μs / (10 ms).
// E.g. passing 140 to cause the servo to take 100ms to setTarget from 1000 μs to 1350 μs
Maestro.prototype.setAcceleration = function(channel, us, onComplete) {
	if(us < 0 || us > 255) {
		LOG.error("pololu-maestro: acceleration value should be 0-255, was: " + us);

		return;
	}

	LOG.info("pololu-maestro: Setting channel " + channel + " acceleration to " + us + " microseconds");
	this._sendCommand(0x89, channel, us, onComplete);
};

// returns the last position sent the specified servo channel
Maestro.prototype.getPosition = function(channel, onPosition) {
	this._serialPort.writeAndRead([
			0x90,
			channel
		], function(data) {
			LOG.info("Position data was " + data);
			onPosition(ByteUtils.fromLowAndHigh8Bits(data));
		}.bind(this)
	);
};

// passes true to the passed callback if any servos are moving, false otherwise
Maestro.prototype.getMovingState = function(channel, onData) {
	this._serialPort.writeAndRead([
			0x93,
			channel
		], function(data) {
			onData(data[0] ? true : false);
		}.bind(this)
	);
};

// sends all servos and outputs to their home position
Maestro.prototype.reset = function() {
	this._serialPort.write([ 0xA2 ]);
};

/****
 *  Input commands
 ****/

// reads the state of an analog input
Maestro.prototype.analogRead = function(channel, onValue) {
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

// reads the state of a digital input
Maestro.prototype.digitalRead = function(channel, onValue) {
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

/****
 *  Output commands
 ****/

// sets the state of a digital output
Maestro.prototype.digitalWrite = function(channel, value, onComplete) {
	this.setTarget(channel, value ? 2304 : 640, onComplete);
};

/****
 *  PWM commands
 ****/

// sets PWM channel value
Maestro.prototype.setPWM = function(onTime, period, onComplete) {
	this._serialPort.write(
		[ 0x8A ].concat(ByteUtils.toLowAndHighBits(onTime)).concat(ByteUtils.toLowAndHighBits(period)),
		onComplete
	);
};

/****
 *  Script commands
 ****/

// stops a currently running script
Maestro.prototype.stopScript = function() {
	this._serialPort.write([ 0xA4 ]);
};

Maestro.prototype.restartScriptAtSubroutine = function(subroutineNumber, onData) {
	if(onData) {
		this._serialPort.writeAndRead([ 0xA7, subroutineNumber ], onData);
	} else {
		this._serialPort.write([ 0xA7, subroutineNumber]);
	}
};

// runs the subroutine with the passed number and sends a parameter
Maestro.prototype.restartScriptAtSubroutineWithParameter = function(subroutineNumber, parameter, onData) {
	if(parameter < 0 || parameter > 16383) {
		LOG.error("Subroutine parameter must be in the range 0-16383");

		return;
	}
	
	if(onData) {
		this._serialPort.writeAndRead([ 0xA8, subroutineNumber ].concat(ByteUtils.toLowAndHighBits(parameter)), onData);
	} else {
		this._serialPort.write([ 0xA8, subroutineNumber].concat(ByteUtils.toLowAndHighBits(parameter)));
	}
};

// passes true to the passed callback if the script is still running, otherwise false
Maestro.prototype.getScriptStatus = function(onStatus) {
	this._serialPort.writeAndRead([ 0xAE ], function(data) {
		onStatus(data[0] ? true : false);
	});
};

/****
 *  Internal methods
 ****/

Maestro.prototype._sendCommand = function(command, channel, value, onComplete) {
	this._serialPort.write([ command, channel ].concat(ByteUtils.toLowAndHighBits(value)), onComplete);
};

Maestro.prototype._send8BitCommand = function(command, channel, value, onComplete) {
	this._serialPort.write([ command, channel, value ], onComplete);
};

module.exports = Maestro;