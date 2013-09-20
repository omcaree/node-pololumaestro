/**
 * # ChainedModeSerialPortWrapper
 */

//^ imports
var SerialPort = require("serialport").SerialPort,
	LOG = require("winston"),
	SerialPortWrapper = require("./serialportwrapper");

/**
 * Implements USB Chained mode.  In this mode the Maestro will read and write
 * to the command port so only one port is required.  Scripts running on the
 * Maestro will *not* be able to use `serial_send_byte` to communicate with the
 * host computer as it writes to the TX port which is not connected to anything.
 *
 * If you want to communicate with the host computer, please use USB Dual Port
 * mode instead.
 *
 * ```javascript
 * new ChainedModeSerialPortWrapper("/dev/COM1", 115200);
 * ```
 */
var ChainedModeSerialPortWrapper = function(comPort, baudRate) {
	if(!comPort && !baudRate) {
		LOG.error("No port or baud rate specified.");

		return;
	}

	//} signifies we are waiting for a read
	this._awaitingRead = false;

	if(comPort instanceof SerialPort) {
		this._serialPort = comPort;
	} else {
		this._serialPort = new SerialPort(comPort, {
			baudrate: baudRate
		});
	}

	this._serialPort.once("open", function() {
		this._connected = true;

		LOG.info("pololu-maestro: Connected to " + comPort);

		this.emit("open");
	}.bind(this));
};

//} extends SerialPortWrapper
ChainedModeSerialPortWrapper.prototype = Object.create(SerialPortWrapper.prototype);

ChainedModeSerialPortWrapper.prototype.writeAndRead = function(bytes, onData) {
	if(!this._connected) {
		LOG.warn("pololu-maestro: Not connected yet, deferring read until com port is available.");

		this.once("open", this.writeAndRead.bind(this, bytes, onData));

		return;
	}

	if(this._awaitingRead) {
		// defer until the request ahead of us has read from the serial port
		this.once("read", this.writeAndRead.bind(this, bytes, onData));

		return;
	}

	// lock the read queue - this will defer any more writes until we've read some data
	this._awaitingRead = true;
	this._serialPort.once("data", function(data) {
		// we've read data so decrement the counter to let other requests write
		this._awaitingRead = false;

		if(onData) {
			onData(data);
		}

		// let any other writes commence
		this.emit("read");
	}.bind(this));

	this._write(bytes);
};

module.exports = ChainedModeSerialPortWrapper;
