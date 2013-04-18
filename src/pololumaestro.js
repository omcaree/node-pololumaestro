var SerialPort = require("serialport").SerialPort

var DEBUG = false;

var maestro = function(comport) {
	this.serialPort = new SerialPort(comport, {
		baudrate: 115200
	});
	var self = this;
	this.serialPort.on("open", function() {
		self.connected = true;
		if (DEBUG) {
			console.log("pololu-maestro: Connected");
		}
	});
}

maestro.prototype.setPWM = function(channel,pwm) {
	if (!this.connected) {
		console.warn("pololu-maestro: Serial Port not open, ignoring setPWM call");
		return 0;
	}
	if (DEBUG) {
		console.log("pololu-maestro: Setting channel " + channel + " to " + pwm);
	}
	var buf = new Buffer(4);
	buf[0] = 0x84;
	buf[1] = channel;
	pwm = Math.floor(pwm*4);
	buf[2] = (pwm) & 0x7F;
	buf[3] = ((pwm) >> 7) & 0x7F;
	this.serialPort.write(buf, function(err, results) {
		if (err !== undefined) {
			console.warn("pololu-maestro: Error writing to serial port (" + err + ")");
		}
	});
	return 1;
}

module.exports = maestro;