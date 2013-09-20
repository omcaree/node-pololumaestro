/**
 * # ByteUtils
 */

/**
 * The Maestro's data protocol sends low bits first, then high bits and sometimes
 * with only the first 7 bits used per byte.
 */
var ByteUtils = {
	// Pass a value, get an array back.
	// E.g. `6000` will be returned as `[01110000, 00101110]`
	toLowAndHighBits: function(value) {
		return [value & 0x7F, (value >> 7) & 0x7F];
	},

	// Pass an array, get an value back.
	// E.g. `[01110000, 00101110]` will be returned as `6000`
	fromLowAndHighBits: function(data) {
		return ((data[1] << 7) + data[0]) & 0x7F7F;
	},

	// Pass an array, get an value back.
	// E.g. `[01110000, 00010111]` will be returned as `6000`
	fromLowAndHigh8Bits: function(data) {
		return ((data[1] << 8) + data[0]) & 0xFFFF;
	}
}

module.exports = ByteUtils;
