/**
 * # SerialPortWrapper
 */

//^ imports
var SerialPort = require("serialport").SerialPort,
	LOG = require("winston"),
	EventEmitter = require("events").EventEmitter,
	ByteUtils = require("./byteutils");

/**
 * node-serialport has sychronous writes but asychronous reads. This presents
 * as problem as we can't guarantee which write matches up with which read.
 * 
 * Firmata works around this by prefixing each response from the board with
 * known byte patterns - as long as you don't make the same request again before
 * the first response has been received you're good.
 * 
 * We don't want to mandate users to install a script to use this, so our 
 * "solution" is to defer writing until a response is received after a write 
 * that expects a read.
 *
 * Supports two constructors.  The one you use depends on what mode you have
 * your Maestro set to.
 *
 * 1.  USB Dual Port:
 * new SerialPortWrapper("/dev/COM1", "/dev/COM2");
 *
 * 2. USB Chained:
 * new SerialPortWrapper("/dev/COM1", 115200);
 */
var SerialPortWrapper = function() {

};

// extends EventEmmiter
SerialPortWrapper.prototype = Object.create(EventEmitter.prototype);

SerialPortWrapper.prototype.write = function(bytes, onComplete) {
	LOG.info("Writing " + bytes);

	if(!this._connected) {
		LOG.warn("pololu-maestro: Not connected yet, deferring write until com port is available.");

		this.once("open", this.write.bind(this, bytes, onComplete));

		return;
	}

	if(this._awaitingRead) {
		this.once("read", this.write.bind(this, bytes, onComplete));

		return;
	}

	this._write(bytes, onComplete);
};

SerialPortWrapper.prototype.writeAndRead = function(bytes, onData) {
	LOG.error("SerialPortWrapper#writeAndRead should be overridden by implementing classes");
};

SerialPortWrapper.prototype._write = function(bytes, onComplete) {
	if(!Array.isArray(bytes)) {
		bytes = [bytes];
	}

	this._serialPort.write(bytes, function(error, bytesWritten) {
		if(bytesWritten != bytes.length) {
			LOG.warn("Short write! Wrote " + bytesWritten + " of " + bytes.length);
		}

		if(!this._detectingError) {
			this._readError(onComplete);
		}
	}.bind(this));
};

var SERIAL_ERRORS = [
	{ code: 1, message: "Serial signal error detected" },
	{ code: 2, message: "Serial overrun error detected" },
	{ code: 4, message: "Serial RX buffer full" },
	{ code: 8, message: "Serial CRC error detected" },
	{ code: 16, message: "Serial protocol error detected" },
	{ code: 32, message: "Serial timeout error detected" },
	{ code: 64, message: "Script stack error detected" },
	{ code: 128, message: "Script call stack error detected" },
	{ code: 256, message: "Script program counter error detected" }
];

SerialPortWrapper.prototype._readError = function(onComplete) {
	this._detectingError = true;

	this.writeAndRead([0xA1], function(data) {
		this._detectingError = false;

		var code = ByteUtils.fromLowAndHigh8Bits(data);

		if(code) {
			for(var i = 0; i < SERIAL_ERRORS.length; i++) {
				if(code & SERIAL_ERRORS[i].code) {
					LOG.warn(SERIAL_ERRORS[i].message);

					this.emit("error", code, SERIAL_ERRORS[i].message);
				}
			}
		}

		if(onComplete) {
			onComplete();
		}
	}.bind(this));
};

module.exports = SerialPortWrapper;
