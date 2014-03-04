var ChainedModeSerialPortWrapper = require("../lib/serialportwrapper-chained"),
	SerialPort = require("serialport").SerialPort,
	LOG = require("winston"),
	JsMockito = require("jsmockito").JsMockito,
	JsHamcrest = require('jshamcrest').JsHamcrest;

JsHamcrest.Integration.Nodeunit();
JsMockito.Integration.Nodeunit();

function arr_equals(arr1, arr2) {
	var result = true;

	arr1.forEach(function(value, index) {
		if(arr2[index] != value) {
			result = false;
		}
	});

	return result;
}

// holds serial port behaviour
var serialTraffic = [ /*{
 input: [0xA1],
 output: [0x00, 0x00]
 } */];

// because we're stubbing SerialPort#write, it looks like we have to
// keep track of invocations ourselves.  Ugh.
var serialPortWriteInvocations = [];

module.exports = {
	setUp: function (done) {
		// our mock serial port object
		var mockSerialPort = spy(new SerialPort("/dev/null", null, false));

		serialTraffic = [{
			input: [0xA1],
			output: [0x00, 0x00]
		}];

		serialPortWriteInvocations = [];

		// prints the passed bytes out for debugging
		when(mockSerialPort).write().then(function(bytes, callback) {
			var invocation = {
				arguments: [bytes, callback]
			};

			serialPortWriteInvocations.push(invocation);

			var output = "";
			var zeroes = "00000000";

			bytes.forEach(function(byte) {
				var str = byte.toString(2);
				str = zeroes.substring(0, 8 - str.length) + str;

				output += str + " (0x" + byte.toString(16).toUpperCase() + "), ";
			});

			LOG.info("TEST: Serial port recieved " + output.substring(0, output.length - 2));

			// invoke callback
			if(callback) {
				callback(null, bytes.length);
			}

			serialTraffic.forEach(function(traffic) {
				if(arr_equals(bytes, traffic.input)) {
					invocation.output = traffic.output;

					LOG.info("TEST: traffic.input " + traffic.input);
					LOG.info("TEST: traffic.output " + traffic.output);
					LOG.info("TEST: emitting data " + traffic.output + " to " + mockSerialPort.listeners("data").length + " listeners");
					mockSerialPort.emit("data", traffic.output);
				}
			});
		});

		this._mockSerialPort = mockSerialPort;
		this._serialPortWrapper = new ChainedModeSerialPortWrapper(mockSerialPort);

		done();
	},

	"Should invoke callback": function (test) {
		var invoked = false;

		var serialPortWrapper = new ChainedModeSerialPortWrapper(this._mockSerialPort);
		serialPortWrapper.on("open", function() {
			invoked = true;
		});

		this._mockSerialPort.emit("open");

		test.ok(invoked, "Did not invoke callback");
		test.done();
	},

	"Should write to serial port": function (test) {
		this._mockSerialPort.emit("open");

		this._serialPortWrapper.write(0x01);

		test.equal(2, serialPortWriteInvocations.length, "Did not write to port and then test for error");
		test.deepEqual([0x01], serialPortWriteInvocations[0].arguments[0], "Did not write correct bytes");
		test.deepEqual([0xA1], serialPortWriteInvocations[1].arguments[0], "Did not write correct error test bytes");
		test.done();
	},

	"Should defer write until connected": function (test) {
		var invoked = false;

		this._serialPortWrapper.write(0x01, function() {
			invoked = true;
		});

		test.ok(!invoked, "Invoked callback too early!");

		this._mockSerialPort.emit("open");

		test.ok(invoked, "Invoked callback too late!");

		test.equal(2, serialPortWriteInvocations.length, "Did not write to port and then test for error");
		test.deepEqual([0x01], serialPortWriteInvocations[0].arguments[0], "Did not write correct bytes");
		test.deepEqual([0xA1], serialPortWriteInvocations[1].arguments[0], "Did not write correct error test bytes");
		test.done();
	},

	"Should defer write and read until connected": function (test) {
		serialTraffic = [{
			input: [0x01],
			output: [0x00, 0x00]
		}];

		var invoked = false;

		this._serialPortWrapper.writeAndRead(0x01, function(data) {
			invoked = true;
		});

		test.ok(!invoked, "Invoked callback too early!");

		this._mockSerialPort.emit("open");

		test.ok(invoked, "Invoked callback too late!");

		test.equal(2, serialPortWriteInvocations.length, "Did not write and read to port and then test for error");
		test.deepEqual([0x01], serialPortWriteInvocations[0].arguments[0], "Did not write correct bytes");
		test.deepEqual([0xA1], serialPortWriteInvocations[1].arguments[0], "Did not write correct error test bytes");
		test.done();
	},

	"Should read from serial port": function (test) {
		this._mockSerialPort.emit("open");

		var traffic = {
			input: [0xCC],
			output: [0x01, 0x02]
		};

		serialTraffic.push(traffic);

		var recieved;

		this._serialPortWrapper.writeAndRead(0xCC, function(data) {
			recieved = data;
		});

		test.equal(2, serialPortWriteInvocations.length, "Did not write to port and then test for error");
		test.deepEqual([0xCC], serialPortWriteInvocations[0].arguments[0], "Did not write correct bytes");
		test.deepEqual([0xA1], serialPortWriteInvocations[1].arguments[0], "Did not write correct error test bytes");
		test.deepEqual(traffic.output, recieved, "Did not read bytes");
		test.done();
	},

	"Should read error": function (test) {
		this._mockSerialPort.emit("open");

		serialTraffic = [{
			input: [0xA1],
			output: [0x01, 0x00]
		}];

		var errorCode;
		var errorMessage;

		this._serialPortWrapper.on("error", function(code, message) {
			errorCode = code;
			errorMessage = message;
		});

		this._serialPortWrapper.write(0x01);

		test.equal(2, serialPortWriteInvocations.length, "Did not write to port and then test for error");
		test.deepEqual([0x01], serialPortWriteInvocations[0].arguments[0], "Did not write correct bytes");
		test.deepEqual([0xA1], serialPortWriteInvocations[1].arguments[0], "Did not write correct error test bytes");
		test.equal(1, errorCode, "Did not read error code");
		test.ok(errorMessage, "Did not read error message");
		test.done();
	},

	"Should defer second read until first read has completed": function (test) {
		// need more control over serial port for this test
		var mockSerialPort = spy(new SerialPort("/dev/null", null, false));
		when(mockSerialPort).write().then(function(bytes, callback) {
			if(callback) {
				callback(null, bytes.length);
			}
		});

		this._serialPortWrapper = new ChainedModeSerialPortWrapper(mockSerialPort);

		// port should be open
		mockSerialPort.emit("open");

		var invokedFirstReadOperation = false;
		var invokedSecondReadOperation = false;
		var invokedWriteOperation = false;

		// make first read request
		this._serialPortWrapper.writeAndRead(0x01, function(data) {
			invokedFirstReadOperation = true;
		});

		// no data emitted yet
		test.ok(!invokedFirstReadOperation, "Invoked first read operation callback way too early!");

		// queue up second read request
		this._serialPortWrapper.writeAndRead(0x02, function(data) {
			invokedSecondReadOperation = true;
		});

		// still no data emitted...
		test.ok(!invokedFirstReadOperation, "Invoked first read operation callback too early!");
		test.ok(!invokedSecondReadOperation, "Invoked second read operation callback too early!");

		// queue up write request
		this._serialPortWrapper.write(0x03, function(error, bytesWritten) {
			invokedWriteOperation = true;
		});

		test.ok(!invokedFirstReadOperation, "Invoked first read operation callback too early!");
		test.ok(!invokedSecondReadOperation, "Invoked second read operation callback too early!");
		test.ok(!invokedWriteOperation, "Invoked write operation callback too early!");

		// emit byte for first read
		mockSerialPort.emit("data", [ 0x01 ]);

		// emit error number for first read
		mockSerialPort.emit("data", [ 0x00, 0x00 ]);

		test.ok(invokedFirstReadOperation, "Did not invoked first read operation callback!");
		test.ok(!invokedSecondReadOperation, "Invoked second read operation callback too early!");
		test.ok(!invokedWriteOperation, "Invoked write operation callback too early!");

		// emit byte for second read
		mockSerialPort.emit("data", [ 0x01 ]);

		// emit error number for second read
		mockSerialPort.emit("data", [ 0x00, 0x00 ]);

		// emit error number for write
		mockSerialPort.emit("data", [ 0x00, 0x00 ]);

		test.ok(invokedSecondReadOperation, "Did not invoke second read operation callback!");
		test.ok(invokedWriteOperation, "Did not invoke write operation!");

		test.done();
	},

	"Should close port": function (test) {
		when(this._mockSerialPort).close().then(function(callback) {
			callback();
		});

		this._serialPortWrapper.close(function() {
			test.done();
		});
	}
};
