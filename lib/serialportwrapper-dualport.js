/**
 * # DualModeSerialPortWrapper
 */

//^ imports
var SerialPort = require("serialport").SerialPort,
	LOG = require("winston"),
	SerialPortWrapper = require("./serialportwrapper"),
	async = require("async");

/**
 * Implements USB Dual Port mode.  In this mode, the RX line should be connected
 * to the TX line.  This will let scripts on the Maestro use the `serial_send_byte`
 * command to communicate with the host computer at the expense of not being able
 * to use the Maestro to control downstream serial devices.
 *
 * See the [Pololu docs](http://www.pololu.com/docs/0J40/5.a) for more information.
 *
 * ```javascript
 * new DualModeSerialPortWrapper("/dev/COM1", "/dev/COM2");
 * ```
 */
var DualModeSerialPortWrapper = function(controlPort, ttlPort) {
	if(!controlPort || !ttlPort) {
		this.emit("error", "Please specify both the control port and the ttl port");

		return;
	}

	//} signifies we are waiting for a read
	this._awaitingRead = false;

	// wait for both ports to open
	async.parallel([
		function(callback) {
			if(controlPort instanceof SerialPort) {
				this._serialPort = controlPort;
			} else {
				this._serialPort = new SerialPort(controlPort, {
					disconnectedCallback: this._portDisconnected.bind(this)
				});
			}

			this._serialPort.once("open", function() {
				callback();
			}.bind(this));
		}.bind(this),
		function(callback) {
			if(ttlPort instanceof SerialPort) {
				this._ttlPort = ttlPort;
			} else {
				this._ttlPort = new SerialPort(ttlPort, {
					disconnectedCallback: this._portDisconnected.bind(this)
				});
			}

			this._ttlPort.once("open", function() {
				callback();
			}.bind(this));
		}.bind(this)
	], function() {
		this._connected = true;

		LOG.info("DualModeSerialPortWrapper", "Connected to control port", controlPort, "and ttl port", ttlPort);

		this.emit("open");
	}.bind(this));
};

// extends EventEmmiter
DualModeSerialPortWrapper.prototype = Object.create(SerialPortWrapper.prototype);

DualModeSerialPortWrapper.prototype._portDisconnected = function() {
	if(!this._connected) {
		return;
	}

	this._connected = false;
	this.emit("disconnected");
}

DualModeSerialPortWrapper.prototype.writeAndRead = function(bytes, onData) {
	if(!this._connected) {
		LOG.warn("DualModeSerialPortWrapper", "Not connected yet, deferring read until com port is available.");

		this.once("open", this.writeAndRead.bind(this, bytes, onData));

		return;
	}

	if(this._awaitingRead) {
		LOG.debug("DualModeSerialPortWrapper", "Deferring write and read of", bytes);

		// defer until the request ahead of us has read from the serial port
		this.once("read", this.writeAndRead.bind(this, bytes, onData));

		return;
	}

	// lock the read queue - this will defer any more writes until we've read some data
	this._awaitingRead = true;

	var read = function(data) {
		// we've read data so decrement the counter to let other requests write
		this._awaitingRead = false;

		// we've consumed the data for this read, remove data listener from other port
		this._ttlPort.removeListener("data", read);
		this._serialPort.removeListener("data", read);

		if(onData) {
			onData(data);
		}

		// let any other writes commence
		this.emit("read");
	}.bind(this);

	this._serialPort.on("data", read);
	this._ttlPort.on("data", read);

	this._write(bytes);
};

DualModeSerialPortWrapper.prototype.close = function(callback) {
	async.parallel([
		function(callback) {
			this._serialPort.close(function() {
				callback();
			});
		}.bind(this),
		function(callback) {
			this._ttlPort.close(function() {
				callback();
			});
		}.bind(this)
	], function() {
		this._connected = false;

		callback();
	}.bind(this));
};

module.exports = DualModeSerialPortWrapper;
