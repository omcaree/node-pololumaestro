
var ByteUtils = {
	toLowAndHighBits: function(value) {
		return [value & 0x7F, (value >> 7) & 0x7F];
	},

	fromLowAndHighBits: function(data) {
		return ((data[1] << 7) + data[0]) & 0x7F7F;
	},

	fromLowAndHigh8Bits: function(data) {
		return ((data[1] << 8) + data[0]) & 0xFFFF;
	}
}

module.exports = ByteUtils;
