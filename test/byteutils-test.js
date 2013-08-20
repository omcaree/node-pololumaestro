var ByteUtils = require("../lib/byteutils"),
	LOG = require("winston"),
	JsMockito = require("jsmockito").JsMockito,
	JsHamcrest = require('jshamcrest').JsHamcrest;

JsHamcrest.Integration.Nodeunit();
JsMockito.Integration.Nodeunit();

module.exports = {
	
	"Should split low and high bits for value < 254": function (test) {
		test.deepEqual([ 10, 0 ], ByteUtils.toLowAndHighBits(10), "Did not split low and high bits for value < 254");
		
		test.done();   	
	},

	"Should split low and high bits for value > 254": function (test) {
		test.deepEqual([ 0x70, 0x2E ], ByteUtils.toLowAndHighBits(6000), "Did not split low and high bits for value > 254");
		
		test.done();   	
	},

	"Should join low and high bytes for value < 254": function (test) {
		test.equal(10, ByteUtils.fromLowAndHighBits([ 10, 0 ]), "Did not join low and high bits for value < 254");

		test.done();   	
	},

	"Should join low and high bytes for value > 254": function (test) {
		test.equal(6000, ByteUtils.fromLowAndHighBits([ 0x70, 0x2E ]), "Did not join low and high bits for value > 254");

		test.done();   	
	},
	
	"Should join low and high bytes for 8 bit value < 254": function (test) {
		test.equal(10, ByteUtils.fromLowAndHigh8Bits([ 10, 0 ]), "Did not join low and high bits for 8 bit value < 254");

		test.done();   	
	},

	"Should join low and high bytes for 8 bit value > 254": function (test) {
		test.equal(6000, ByteUtils.fromLowAndHigh8Bits([ 0x70, 0x17 ]), "Did not join low and high bits for 8 bit value > 254");

		test.done();   	
	}
};

