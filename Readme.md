# node-pololumaestro

[![Dependency Status](https://david-dm.org/omcaree/node-pololumaestro.png)](https://david-dm.org/omcaree/node-pololumaestro)
[![devDependency Status](https://david-dm.org/omcaree/node-pololumaestro/dev-status.png)](https://david-dm.org/omcaree/node-pololumaestro#info=devDependencies)

This module allows control of the Pololu Maestro range of servo controllers from Node.js allowing your project to interact with the world!

See the [API documentation](http://omcaree.github.io/node-pololumaestro/) for more information.

## Dependencies

This module requires [node-serialport](https://github.com/voodootikigod/node-serialport) in order to communicate with the Maestro, this should be installed automatically.

It also uses [Winston](https://github.com/flatiron/winston) for logging.

## Installation

Install this module with

```shell
npm install pololumaestro
```

## Hacking

Run unit tests with:

```shell
npm test
```

A coverage report should then be available in coverage/lcov-report/index.html

Please submit tests along with new functionality

## Usage

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
	});

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

// alternatively, attempt to auto-detect:
PololuMaestro.find(PololuMaestro.SERIAL_MODES.USB_DUAL_PORT, function(error, maestro) {
	// ... do something
});
```

## Version history

### v3.0.0
 * Breaking change - the callback for PololuMaestro#find now takes arguments `error, maestro` to be more inline with node conventions
 * Not finding a Maestro no longer causes the process to exit, instead test for the error argument to PololuMaestro#find

### v2.1.2
 * Small tweak for OS X Mavericks compatibility

### v2.1.1

Updates  (contributed by [achingbrain](https://github.com/achingbrain)):
 * Adds a find method to attempt to auto-detect a connected board

### v2.1.0

Updates  (contributed by [achingbrain](https://github.com/achingbrain)):

 * Adds support for USB Dual Port mode
 * Adds generated documentation

### v2.0.0

Updates (contributed by [achingbrain](https://github.com/achingbrain)):

 * Refactored to implement full compact protocol
 * Added unit testing suite

### v1.1.0

 * Removed [serialport](https://github.com/voodootikigod/node-serialport) v1.06 dependency to be compatible with node v0.10.x (Thanks [achingbrain](https://github.com/achingbrain)!)
 * Added a "ready" event to prevent calls to setPWM being made before the serial port is open


## Upgrading

N.b. v2.0.0 breaks compatibilty with v1.1.0.  To fix up your code, change the setPWM method to setTarget.

So where you were previously setting the target of channel 0 like this:

```javascript
maestro.setPWM(0, 1500);
```

You should now use:

```javascript
maestro.setTarget(0, 1500);
```
