node-pololumaestro
==================

This module allows control of the Pololu Maestro range of servo controllers from Node.js allowing your project to interact with the world!

Updates as of v2.0.0:
 * Refactored to implement full compact protocol
 * Added unit testing suite

Updates as of v1.1.0:
 * Removed [serialport](https://github.com/voodootikigod/node-serialport) v1.06 dependency to be compatible with node v0.10.x (Thanks [achingbrain](https://github.com/achingbrain)!)
 * Added a "ready" event to prevent calls to setPWM being made before the serial port is open

Dependencies
============
This module requires [node-serialport](https://github.com/voodootikigod/node-serialport) in order to communicate with the Maestro, this should be installed automatically.

It also uses [Winston](https://github.com/flatiron/winston) for logging.

Installation
============
Install this module with

```
npm install pololumaestro
```

Hacking
=======

Run unit tests with:

```
npm test
```

A coverage report should then be available in coverage/lcov-report/index.html

Please submit tests along with new functionality

Usage
=====

Here's a minimal example of how to use the module

```javascript
var PololuMaestro = require("pololu-maestro");

//create new instance, specifying control com port and optionally the baud rate
var maestro = new PololuMaestro("COM17", 115200);

//wait until connection is ready
maestro.on("ready", function() {
	// set target of servo on channel 1 to 1500μs
	maestro.setTarget(1, 1500);

	// set a servo on channel 1 via mini-SSC protocol
	maestro.set8BitTarget(1, 128);

	// set speed of servo on channel 1
	maestro.setSpeed(1, 140);

	// set acceleration of servo on channel 1
	maestro.setAcceleration(1, 128);

	// get the last target value sent to the servo on channel 1
	maestro.getPosition(1, function(position) {
		// position is a number
	});

	// find out if a servo is moving on channel 1
	maestro.getMovingState(1, function(state) {
		// state is a boolean
	});

	// reset all servos to home position
	maestro.reset();

	// read an analog input on channel 1
	maestro.analogRead(1, function(value) {
		// value is a number
	});

	// read a digital input on channel 12
	maestro.digitalRead(12, function(value) {
		// value is a boolean
	};

	// write to a digital output on channel 1
	maestro.digitalWrite(1, true);

	// set PWM channel value
	maestro.setPWM(onTime, period);

	// stop the currently running script
	maestro.stopScript();

	// run subroutine 1
	maestro.restartScriptAtSubroutine(1);

	// run subroutine 1 and read the result
	maestro.restartScriptAtSubroutine(1, function(data) {
		// data is a Buffer - http://nodejs.org/api/buffer.html
	});

	// pass an argument to a subroutine
	maestro.restartScriptAtSubroutineWithParameter(1, 5);

    // pass an argument to a subroute and read the result
	maestro.restartScriptAtSubroutineWithParameter(1, 5, function(data) {
		// data is a Buffer - http://nodejs.org/api/buffer.html
	});

	// find out if any scripts are currently running
	maestro.getScriptStatus(function(status) {
		// status is a boolean
	});
});
```