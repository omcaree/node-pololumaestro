var PololuMaestro = require("pololu-maestro");

//create new instance, specifying control com port
var maestro = new PololuMaestro("COM17");

//some initial conditions
var pwm = 2000;
var step = -10;

//wait until connection is ready
maestro.on("ready", function() {
	//cycle channel 0 indefinitly
	setInterval(function() {
		//reverse direction when limits reached
		if (pwm < 1000 || pwm > 2000) {
			step = -step;
		}
		
		//set servo position
		maestro.setPWM(0,pwm+=step);
		
	}, 20)
});