var DualModeSerialPortWrapper = require("../lib/serialportwrapper-dualport"),
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

// holds command port behaviour
var serialTraffic = [ /*{
	input: [0xA1],
	commandPortOutput: [0x00, 0x00],
	ttlPortOutput: [0x00, 0x00]
} */];

// because we're stubbing SerialPort#write, it looks like we have to
// keep track of invocations ourselves.  Ugh.
var serialPortWriteInvocations = [];

module.exports = {
	setUp: function (done) {
		// our mock serial port object
		this._mockCommandPort = spy(new SerialPort("/dev/null", null, false));
		this._mockTtlPort = spy(new SerialPort("/dev/null", null, false));

		serialTraffic = [{
			input: [0xA1],
			commandPortOutput: [0x00, 0x00]
		}];

		serialPortWriteInvocations = [];

		// prints the passed bytes out for debugging
		when(this._mockCommandPort).write().then(function(bytes, callback) {
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
					var port, output, target;

					if(traffic.commandPortOutput) {
						port = "command";
						output = traffic.commandPortOutput;
						target = this._mockCommandPort;
					} else if(traffic.ttlPortOutput){
						port = "ttl";
						output = traffic.ttlPortOutput;
						target = this._mockTtlPort;
					}

					invocation.output = {
						port: port,
						data: output
					};

					LOG.info("TEST: traffic.input " + invocation.arguments[0]);
					LOG.info("TEST: traffic.output.port " + invocation.output.port);
					LOG.info("TEST: traffic.output.data " + invocation.output.data);
					LOG.info("TEST: emitting data to " + target.listeners("data").length + " listeners via " + port + " port");
					target.emit("data", invocation.output.data);
				}
			}.bind(this));
		}.bind(this));

		when(this._mockTtlPort).write().then(function() {
			test.fail("Should never write to TTL port");
		});

		this._serialPortWrapper = new DualModeSerialPortWrapper(this._mockCommandPort, this._mockTtlPort);

		done();
	},

	"Should invoke callback": function (test) {
		var invoked = false;

		var serialPortWrapper = new DualModeSerialPortWrapper(this._mockCommandPort, this._mockTtlPort);
		serialPortWrapper.on("open", function() {
			if(invoked) {
				test.fail("Already invoked callback");
			}

			invoked = true;
		});

		this._mockCommandPort.emit("open");
		this._mockTtlPort.emit("open");

		test.ok(invoked, "Did not invoke callback");
		test.done();
	},

	"Should write to serial port": function (test) {
		this._mockCommandPort.emit("open");
		this._mockTtlPort.emit("open");

		this._serialPortWrapper.write(0x01);

		test.equal(2, serialPortWriteInvocations.length, "Did not write to port and then test for error");
		test.deepEqual([0x01], serialPortWriteInvocations[0].arguments[0], "Did not write correct bytes");
		test.deepEqual([0xA1], serialPortWriteInvocations[1].arguments[0], "Did not write correct error test bytes");
		test.done();   	
	},
	
	"Should defer write until connected": function (test) {
		var invoked = false;

		this._serialPortWrapper.write(0x01, function() {
			if(invoked) {
				test.fail("Already invoked callback");
			}

			invoked = true;
		});

		test.ok(!invoked, "Invoked callback too early!");

		this._mockTtlPort.emit("open");
		this._mockCommandPort.emit("open");

		test.ok(invoked, "Invoked callback too late!");

		test.equal(2, serialPortWriteInvocations.length, "Did not write to port and then test for error");
		test.deepEqual([0x01], serialPortWriteInvocations[0].arguments[0], "Did not write correct bytes");
		test.deepEqual([0xA1], serialPortWriteInvocations[1].arguments[0], "Did not write correct error test bytes");
		test.done();
	},

	"Should defer write and command port read until connected": function (test) {
		serialTraffic = [{
			input: [0x01],
			commandPortOutput: [0x00, 0x00]
		}];

		var invoked = false;

		this._serialPortWrapper.writeAndRead(0x01, function(data) {
			if(invoked) {
				test.fail("Already invoked callback");
			}

			invoked = true;
		});

		test.ok(!invoked, "Invoked callback too early!");

		this._mockCommandPort.emit("open");
		this._mockTtlPort.emit("open");

		test.ok(invoked, "Invoked callback too late!");

		test.equal(2, serialPortWriteInvocations.length, "Did not write and read to port and then test for error");
		test.deepEqual([0x01], serialPortWriteInvocations[0].arguments[0], "Did not write correct bytes");
		test.deepEqual([0xA1], serialPortWriteInvocations[1].arguments[0], "Did not write correct error test bytes");
		test.equal("command", serialPortWriteInvocations[0].output.port, "Did not read from correct port");
		test.done();
	},

	"Should defer write and ttl port read until connected": function (test) {
		serialTraffic = [{
			input: [0x01],
			ttlPortOutput: [0x00, 0x00]
		}];

		var invoked = false;

		this._serialPortWrapper.writeAndRead(0x01, function(data) {
			if(invoked) {
				test.fail("Already invoked callback");
			}

			invoked = true;
		});

		test.ok(!invoked, "Invoked callback too early!");

		this._mockCommandPort.emit("open");
		this._mockTtlPort.emit("open");

		test.ok(invoked, "Invoked callback too late!");

		test.equal(2, serialPortWriteInvocations.length, "Did not write and read to port and then test for error");
		test.deepEqual([0x01], serialPortWriteInvocations[0].arguments[0], "Did not write correct bytes");
		test.deepEqual([0xA1], serialPortWriteInvocations[1].arguments[0], "Did not write correct error test bytes");
		test.equal("ttl", serialPortWriteInvocations[0].output.port, "Did not read from correct port");
		test.done();
	},

	"Should read from ttl port": function (test) {
		this._mockCommandPort.emit("open");
		this._mockTtlPort.emit("open");

		var traffic = {
			input: [0xCC],
			ttlPortOutput: [0x01, 0x02]
		};
		
		serialTraffic.push(traffic);
		
		var received;

		this._serialPortWrapper.writeAndRead(0xCC, function(data) {
			received = data;
		});

		test.equal(2, serialPortWriteInvocations.length, "Did not write to port and then test for error");
		test.deepEqual([0xCC], serialPortWriteInvocations[0].arguments[0], "Did not write correct bytes");
		test.deepEqual([0xA1], serialPortWriteInvocations[1].arguments[0], "Did not write correct error test bytes");
		test.deepEqual(traffic.ttlPortOutput, received, "Did not read bytes");
		test.equal("ttl", serialPortWriteInvocations[0].output.port, "Did not read from correct port");
		test.done();
	},

	"Should read from command port": function (test) {
		this._mockCommandPort.emit("open");
		this._mockTtlPort.emit("open");

		var traffic = {
			input: [0xCC],
			commandPortOutput: [0x01, 0x02]
		};

		serialTraffic.push(traffic);

		var received;

		this._serialPortWrapper.writeAndRead(0xCC, function(data) {
			received = data;
		});

		test.equal(2, serialPortWriteInvocations.length, "Did not write to port and then test for error");
		test.deepEqual([0xCC], serialPortWriteInvocations[0].arguments[0], "Did not write correct bytes");
		test.deepEqual([0xA1], serialPortWriteInvocations[1].arguments[0], "Did not write correct error test bytes");
		test.deepEqual(traffic.commandPortOutput, received, "Did not read bytes");
		test.equal("command", serialPortWriteInvocations[0].output.port, "Did not read from correct port");
		test.done();
	},
	
	"Should read error": function (test) {
		this._mockCommandPort.emit("open");
		this._mockTtlPort.emit("open");

		serialTraffic = [{
			input: [0xA1],
			commandPortOutput: [0x01, 0x00]
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
		var mockCommandPort = spy(new SerialPort("/dev/null", null, false));
		when(mockCommandPort).write().then(function(bytes, callback) {
			if(callback) {
				callback(null, bytes.length);
			}
		});

		var mockTtlPort = spy(new SerialPort("/dev/null", null, false));
		when(mockTtlPort).write().then(function(bytes, callback) {
			if(callback) {
				callback(null, bytes.length);
			}
		});

		this._serialPortWrapper = new DualModeSerialPortWrapper(mockCommandPort, mockTtlPort);

		// port should be open
		mockCommandPort.emit("open");
		mockTtlPort.emit("open");

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
		mockTtlPort.emit("data", [ 0x01 ]);

		// emit error number for first read
		mockCommandPort.emit("data", [ 0x00, 0x00 ]);

		test.ok(invokedFirstReadOperation, "Did not invoked first read operation callback!");
		test.ok(!invokedSecondReadOperation, "Invoked second read operation callback too early!");
		test.ok(!invokedWriteOperation, "Invoked write operation callback too early!");

		// emit byte for second read
		mockTtlPort.emit("data", [ 0x01 ]);

		// emit error number for second read
		mockCommandPort.emit("data", [ 0x00, 0x00 ]);

		// emit error number for write
		mockCommandPort.emit("data", [ 0x00, 0x00 ]);

		test.ok(invokedSecondReadOperation, "Did not invoke second read operation callback!");
		test.ok(invokedWriteOperation, "Did not invoke write operation!");

		test.done();
	},

	"Should only emit disconnected event once": function (test) {
		var count = 0;

		this._serialPortWrapper.on("disconnected", function() {
			count++;

			if(count == 2) {
				test.fail("Should only have emitted one event!");
			}
		});

		this._serialPortWrapper._connected = true;

		// once for command port
		this._serialPortWrapper._portDisconnected();

		// and then again for ttl port
		this._serialPortWrapper._portDisconnected();

		setTimeout(function() {
			test.equal(1, count);

			test.done();
		}, 1000);
	},

	"Should close both ports": function (test) {
		when(this._mockTtlPort).close().then(function(callback) {
			callback();
		});

		when(this._mockCommandPort).close().then(function(callback) {
			callback();
		});

		this._serialPortWrapper.close(function() {
			test.done();
		});
	}
};
