var PololuMaestro = require("../lib/pololumaestro"),
	SerialPortWrapper = require("../lib/serialportwrapper"),
	SerialModes = require("../lib/serialmodes"),
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
		var mockSerialPort = mock(SerialPortWrapper);

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
		});

		// calls the onData callback with the expected output
		when(mockSerialPort).writeAndRead().then(function(bytes, onData) {
			mockSerialPort.write(bytes);

			serialTraffic.forEach(function(traffic) {
				if(!onData) {
					return;
				}

				if(arr_equals(bytes, traffic.input)) {
					LOG.info("TEST: traffic.input " + traffic.input);
					LOG.info("TEST: traffic.output " + traffic.output);
					onData(traffic.output);
				}
			});
		});

		this._maestro = new PololuMaestro(mockSerialPort);

		done();
	},

	"Should set a servo target": function (test) {
		this._maestro.setTarget(2, 1500, function() {});

		test.equal(1, serialPortWriteInvocations.length, "Did not set target");
		test.deepEqual([0x84, 0x02, 0x70, 0x2E], serialPortWriteInvocations[0].arguments[0], "Did not match setTarget example from Pololu documentation");
		test.done();   	
	},
	
	"Should reject invalid servo target": function (test) {
		this._maestro.setTarget(2, 0, function() {});
		test.equal(0, serialPortWriteInvocations.length, "Did not reject servo target that was too small");
		
		this._maestro.setTarget(2, 6000, function() {});
		test.equal(0, serialPortWriteInvocations.length, "Did not reject servo target that was too big");

		test.done();   	
	},
	
	"Should set an 8 bit servo target": function (test) {
		this._maestro.set8BitTarget(2, 100, function() {});

		test.equal(1, serialPortWriteInvocations.length, "Did not set target");
		test.deepEqual([0xFF, 0x02, 0x64], serialPortWriteInvocations[0].arguments[0], "Did not match setTarget example from Pololu documentation");
		test.done();   	
	},
	
	"Should reject invalid 8 bit servo target": function (test) {
		this._maestro.set8BitTarget(2, -10, function() {});
		test.equal(0, serialPortWriteInvocations.length, "Did not reject 8 bit servo target that was too small");

		this._maestro.set8BitTarget(2, 500, function() {});
		test.equal(0, serialPortWriteInvocations.length, "Did not reject 8 bit servo target that was too big");

		test.done();   	
	},
	
	"Should set servo speed": function (test) {
		this._maestro.setSpeed(5, 140, function() {});

		test.equal(1, serialPortWriteInvocations.length, "Did not set speed");
		test.deepEqual([0x87, 0x05, 0x0C, 0x01], serialPortWriteInvocations[0].arguments[0], "Did not match setSpeed example from Pololu documentation");
		test.done();   	
	},
	
	"Should reject invalid speed": function (test) {
		this._maestro.setSpeed(2, -10, function() {});
		test.equal(0, serialPortWriteInvocations.length, "Did not reject servo speed that was too small");

		this._maestro.setSpeed(2, 500, function() {});
		test.equal(0, serialPortWriteInvocations.length, "Did not reject servo speed that was too big");

		test.done();   	
	},
	
	"Should set servo accleration": function (test) {
		this._maestro.setAcceleration(5, 140, function() {});

		test.equal(1, serialPortWriteInvocations.length, "Did not set accleration");
		test.deepEqual([0x89, 0x05, 0x0C, 0x01], serialPortWriteInvocations[0].arguments[0], "Did not get right arguments for set accleration");
		test.done();   	
	},

	"Should reject invalid accleration": function (test) {
		this._maestro.setAcceleration(2, -10, function() {});
		test.equal(0, serialPortWriteInvocations.length, "Did not reject servo accleration that was too small");

		this._maestro.setAcceleration(2, 500, function() {});
		test.equal(0, serialPortWriteInvocations.length, "Did not reject servo accleration that was too big");

		test.done();
	},
	
	"Should get servo position": function (test) {
		var expected = 10;

		serialTraffic.push({
			input: [0x90, 0x05],
			output: [0x0A, 0x00]
		});

		var position;
			
		this._maestro.getPosition(5, function(data) {
			LOG.info("getPosition callback saw: " + data);
			position = data;
		});

		test.equal(1, serialPortWriteInvocations.length, "Did not get position");
		test.equal(expected, position, "Did not get right position got " + position + " when expected " + expected);
		test.done();
	},
	
	"Should send reset": function (test) {
		this._maestro.reset();

		test.equal(1, serialPortWriteInvocations.length, "Did not send reset byte");
		test.deepEqual([ 0xA2 ], serialPortWriteInvocations[0].arguments[0], "Did not send reset byte");
		test.done();
	},
	
	"Should get servo moving state": function (test) {
		var reportedState;
		
		serialTraffic.push({
			input: [0x93, 0x01],
			output: [0x01]
		});
		
		this._maestro.getMovingState(1, function(state) {
			reportedState = state;
		});

		test.equal(1, serialPortWriteInvocations.length, "Did not send moving state byte");
		test.ok(reportedState, "Did not report moving state as true");
		test.done();
	},
	
	"Should do analog read": function (test) {
		var reportedValue;

		serialTraffic.push({
			input: [0x90, 0x05],
			output: [0x01, 0x00]
		});

		this._maestro.analogRead(5, function(value) {
			reportedValue = value;
		});

		test.equal(1, serialPortWriteInvocations.length, "Did not send analog read byte");
		test.equal(1, reportedValue, "Did not report analog read");
		test.deepEqual([ 0x90, 0x05 ], serialPortWriteInvocations[0].arguments[0], "Did not send analog read byte");
		test.done();
	},

	"Should reject analog read for pins > 11": function (test) {
		var invoked;

		this._maestro.analogRead(12, function(value) {
			invoked = true;
		});

		test.equal(0, serialPortWriteInvocations.length, "Sent analog read byte when shouldn't have");
		test.ok(!invoked, "Invoked analog read callback when shouldn't have");
		test.done();
	},
	
	"Should do digital read with true value": function (test) {
		var reportedValue;

		serialTraffic.push({
			input: [0x90, 0x0E],
			output: [0x71, 0x17]
		});

		this._maestro.digitalRead(14, function(value) {
			reportedValue = value;
		});

		test.equal(1, serialPortWriteInvocations.length, "Did not send digital read byte");
		test.ok(reportedValue, "Did not report digital read");
		test.deepEqual([ 0x90, 0x0E ], serialPortWriteInvocations[0].arguments[0], "Did not send digital read byte");
		test.done();
	},
	
	
	"Should do digital read with false value": function (test) {
		var reportedValue;

		serialTraffic.push({
			input: [0x90, 0x0E],
			output: [0x71, 0x00]
		});

		this._maestro.digitalRead(14, function(value) {
			reportedValue = value;
		});

		test.equal(1, serialPortWriteInvocations.length, "Did not send digital read byte");
		test.ok(!reportedValue, "Did not report digital read");
		test.deepEqual([ 0x90, 0x0E ], serialPortWriteInvocations[0].arguments[0], "Did not send digital read byte");
		test.done();
	},

	"Should reject digital read for pins < 12": function (test) {
		var invoked;

		this._maestro.digitalRead(5, function(value) {
			invoked = true;
		});

		test.equal(0, serialPortWriteInvocations.length, "Sent digital read byte when shouldn't have");
		test.ok(!invoked, "Invoked digital read callback when shouldn't have");
		test.done();
	},
	
	"Should do digital write with true value": function (test) {
		this._maestro.digitalWrite(5, true);

		test.equal(1, serialPortWriteInvocations.length, "Did not send digital write byte");
		test.deepEqual([ 0x84, 0x05, 0x00, 0x48 ], serialPortWriteInvocations[0].arguments[0], "Did not send digital read byte");
		test.done();
	},

	"Should do digital write with false value": function (test) {
		this._maestro.digitalWrite(5, false);

		test.equal(1, serialPortWriteInvocations.length, "Did not send digital write byte");
		test.deepEqual([ 0x84, 0x05, 0x00, 0x14 ], serialPortWriteInvocations[0].arguments[0], "Did not send digital read byte");
		test.done();
	},

	"Should do write to PWM channel": function (test) {
		this._maestro.setPWM(10, 10);

		test.equal(1, serialPortWriteInvocations.length, "Did not set PWM value");
		test.deepEqual([ 0x8A, 0x0A, 0x00, 0x0A, 0x00 ], serialPortWriteInvocations[0].arguments[0], "Did not send PWM value");
		test.done();
	},
	
	"Should send stop script": function (test) {
		this._maestro.stopScript();

		test.equal(1, serialPortWriteInvocations.length, "Did not send stop script byte");
		test.deepEqual([ 0xA4 ], serialPortWriteInvocations[0].arguments[0], "Did not send stop script byte");
		test.done();
	},
	
	"Should restart script": function (test) {
		this._maestro.restartScriptAtSubroutine(1);

		test.equal(1, serialPortWriteInvocations.length, "Did not send restart script byte");
		test.deepEqual([ 0xA7, 0x01 ], serialPortWriteInvocations[0].arguments[0], "Did not send restart script byte");
		test.done();
	},

	"Should restart script and expect output": function (test) {
		var received;
		
		serialTraffic.push({
			input: [0xA7, 0x01],
			output: [0x0A, 0x00]
		});

		this._maestro.mode = SerialModes.USB_DUAL_PORT;

		this._maestro.restartScriptAtSubroutine(1, function(data) {
			received = data;
		});

		test.equal(1, serialPortWriteInvocations.length, "Did not send restart script byte");
		test.deepEqual([ 0xA7, 0x01 ], serialPortWriteInvocations[0].arguments[0], "Did not send restart script byte");
		test.deepEqual([ 0x0A, 0x00 ], received, "Did not received expected script output");
		test.done();
	},

	"Should restart script with parameter": function (test) {
		this._maestro.restartScriptAtSubroutineWithParameter(1, 10);

		test.equal(1, serialPortWriteInvocations.length, "Did not send restart script with parameter byte");
		test.deepEqual([ 0xA8, 0x01, 0x0A, 0x00 ], serialPortWriteInvocations[0].arguments[0], "Did not send restart script with parameter byte");
		test.done();
	},

	"Should restart script with parameter and expect output": function (test) {
		var received;

		serialTraffic.push({
			input: [0xA8, 0x01, 0x0A, 0x00],
			output: [0x0A, 0x00]
		});

		this._maestro.mode = SerialModes.USB_DUAL_PORT;

		this._maestro.restartScriptAtSubroutineWithParameter(1, 10, function(data) {
			received = data;
		});

		test.equal(1, serialPortWriteInvocations.length, "Did not send restart script byte");
		test.deepEqual([ 0xA8, 0x01, 0x0A, 0x00 ], serialPortWriteInvocations[0].arguments[0], "Did not send restart script byte");
		test.deepEqual([ 0x0A, 0x00 ], received, "Did not received expected script output");
		test.done();
	},

	"Should reject restart script with invalid parameter": function (test) {
		this._maestro.restartScriptAtSubroutineWithParameter(1, -10);
		this._maestro.restartScriptAtSubroutineWithParameter(1, 17000);

		test.equal(0, serialPortWriteInvocations.length, "Sent reastart script with parameter when shouldn't have");
		test.done();
	},
	
	"Should report script status": function (test) {
		var reportedStatus;
		
		serialTraffic.push({
			input: [0xAE],
			output: [0x01]
		});

		this._maestro.getScriptStatus(function(status) {
			reportedStatus = status;
		});

		test.equal(1, serialPortWriteInvocations.length, "Did not send report script status byte");
		test.ok(reportedStatus, "Should have reported script status as running");
		test.done();
	}
};