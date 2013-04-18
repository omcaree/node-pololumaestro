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
var PololuMaestro = require("pololumaestro");

var maestro = new PololuMaestro("COM10");

maestro.setPWM(0,1200);
```