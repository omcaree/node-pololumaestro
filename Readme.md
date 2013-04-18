node-pololumaestro
==================

This module allows control of the Pololu Maestro range of servo controllers from Node.js allowing your project to interact with the world!

Dependancies
============
This module requires node-serialport in order to comminucate with the Maestro, this should be installed automatically.

Installation
============
Install this module with

```
npm install pololumaestro
```

Usage
=====

Here's a minimal example of how to use the module

```javascript
var PololuMaestro = require("pololu-maestro");

//create new instance, specifying control com port
var maestro = new PololuMaestro("COM17");

//some initial conditions
var pwm = 2000;
var step = -10;

//cycle channel 1 indefinitly
setInterval(function() {
	//reverse direction when limits reached
	if (pwm < 1000 || pwm > 2000) {
		step = -step;
	}
	
	//set servo position
	maestro.setPWM(0,pwm+=step);
	
}, 20)
```