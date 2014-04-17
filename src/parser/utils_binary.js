// Copyright 2014 DeNA Co., Ltd.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


var getUI16 = function(binary, pos) {
	return binary[pos + 1] * 0x100 + binary[pos];
};
var getSI16 = function(binary, pos) {
	var val = binary[pos + 1] * 0x100 + binary[pos];
	if(((0x80 << 8) & val) != 0) {
		val |= (-1) << 16;
	}
	return val;
};
var getUI32 = function(binary, pos) {
	return (binary[pos + 3] << 24) | (binary[pos + 2] << 16) | (binary[pos + 1] << 8) | binary[pos];
};

var getRGB = function(binary, pos) {
	return (255 << 24) | (binary[pos] << 16) | (binary[pos + 1] << 8) | binary[pos + 2];
};
var getRGBA = function(binary, pos) {
	return (binary[pos + 3] << 24) | (binary[pos] << 16) | (binary[pos + 1] << 8) | binary[pos + 2];
};
var getARGB = function(binary, pos) {
	return (binary[pos] << 24) | (binary[pos + 1] << 16) | (binary[pos + 2] << 8) | binary[pos + 3];
};

var getString = function(binary, pos) {
	var end = pos;
	while(binary[end]) {
		end++;
	}
	return String.fromCharCode.apply(null, binary.slice(pos, end));
};
var getStringLength = function(binary, pos, length) {
	return String.fromCharCode.apply(null, binary.slice(pos, pos + length));
};
var getStringSJIS = function(binary, pos) {
	var end = pos;
	while(binary[end]) {
		end++;
	}
	var str = toStringFromShiftJIS(binary.slice(pos, end));
	return [(str === null)? "": str, end - pos + 1];
};

var sb2int = function(sb, bits) {
	if ((sb & (1 << (bits - 1))) != 0) {
		return sb - (1 << bits);
	}
	return sb;
};
var fb2double = function(fb, bits) {
	return sb2int(fb, bits) / 0x10000;
};

var getBit = function(binary, pos, start) {
	return (binary[pos + (start >> 3)] >> (7 - (start & 0x7)) ) & 1;
};

var getBits = function(binary, pos, start, length) {
	if(!length) {
		return 0;
	}
	
	var begin = (pos << 3) + start;
	var end = begin + length;
	var ta = begin >> 3;
	var r1 = begin & 0x7;
	var tb = end >> 3;
	var r2 = end & 0x7;
	
	/* ta=tb
	 * +-------+-------+-------+
	 *    b  e
	 *    <-->
	 *     x0
	 * <-->r1
	 * <----->r2
	 *
	 * ta              tb
	 * +-------+-------+-------+
	 *    b                 e
	 *    <----------------->
	 *    | x1 |  x2   | x3 |
	 * <-->r1
	 *                  <--->r2
	 */
	
	if(ta == tb) {
		// x0
		return (binary[ta] >> (8 - r2)) & ((1 << length) - 1);
	} else {
		// x1
		var result = binary[ta] & (0xFF >> r1);
		// x2
		for(var i = ta + 1; i < tb; i++) {
			result <<= 8;
			result |= binary[i];
		}
		if(r2 == 0) {
			return result;
		} else {
			return (result << r2) | (binary[tb] >> (8 - r2));
		}
	}
};

var getRect = function(binary, pos, rect) {
	var bits = binary[pos] >> 3;
	rect[0] = sb2int(getBits(binary, pos, 5, bits), bits); // xmin
	rect[1] = sb2int(getBits(binary, pos, 5 + bits, bits), bits); // xmax
	rect[2] = sb2int(getBits(binary, pos, 5 + bits * 2, bits), bits); // ymin
	rect[3] = sb2int(getBits(binary, pos, 5 + bits * 3, bits), bits); // ymax
	
	return Math.ceil((5 + bits * 4) / 8);
};

var getMatrix = function(binary, pos, matrix) {
	var hasScale = getBit(binary, pos, 0);
	var c = 1;
	var bits = 0;
	if(hasScale) {
		bits = getBits(binary, pos, c, 5);
		c += 5;
		matrix[0] = fb2double(getBits(binary, pos, c, bits), bits);
		matrix[3] = fb2double(getBits(binary, pos, c + bits, bits), bits);
		c += bits * 2;
	} else {
		matrix[0] = 1;
		matrix[3] = 1;
	}
	var hasRotate = getBit(binary, pos, c);
	c++;
	if(hasRotate) {
		bits = getBits(binary, pos, c, 5);
		c += 5;
		matrix[1] = fb2double(getBits(binary, pos, c, bits), bits);
		matrix[2] = fb2double(getBits(binary, pos, c + bits, bits), bits);
		c += bits * 2;
	} else {
		matrix[1] = 0;
		matrix[2] = 0;
	}
	
	bits = getBits(binary, pos, c, 5);
	c += 5;
	matrix[4] = sb2int(getBits(binary, pos, c, bits), bits) / 20;
	matrix[5] = sb2int(getBits(binary, pos, c + bits, bits), bits) / 20;
	c += bits * 2;
	return Math.ceil(c / 8);
};

var getCxform = function(binary, pos, colorTransform, colorRange) {
	var hasAddTerms = getBit(binary, pos, 0);
	var hasMultTerms = getBit(binary, pos, 1);
	var bits = getBits(binary, pos, 2, 4);;
	var c = 6;
	if(hasMultTerms) {
		if(colorRange) {
			// 256 which is the default value should not be changed for the performance
			var v;
			colorTransform[0] = (v = sb2int(getBits(binary, pos, c, bits), bits)) == 256? v: (v / colorRange | 0) * colorRange;
			c += bits;
			colorTransform[1] = (v = sb2int(getBits(binary, pos, c, bits), bits)) == 256? v: (v / colorRange | 0) * colorRange;
			c += bits;
			colorTransform[2] = (v = sb2int(getBits(binary, pos, c, bits), bits)) == 256? v: (v / colorRange | 0) * colorRange;
			c += bits;
		} else {
			colorTransform[0] = sb2int(getBits(binary, pos, c, bits), bits);
			c += bits;
			colorTransform[1] = sb2int(getBits(binary, pos, c, bits), bits);
			c += bits;
			colorTransform[2] = sb2int(getBits(binary, pos, c, bits), bits);
			c += bits;
		}
		colorTransform[3] = 256;
		c += bits;
	} else {
		colorTransform[0] = 256;
		colorTransform[1] = 256;
		colorTransform[2] = 256;
		colorTransform[3] = 256;
	}
	if(hasAddTerms) {
		colorTransform[4] = sb2int(getBits(binary, pos, c, bits), bits);
		c += bits;
		colorTransform[5] = sb2int(getBits(binary, pos, c, bits), bits);
		c += bits;
		colorTransform[6] = sb2int(getBits(binary, pos, c, bits), bits);
		c += bits;
		colorTransform[7] = 0;
		c += bits;
	} else {
		colorTransform[4] = 0;
		colorTransform[5] = 0;
		colorTransform[6] = 0;
		colorTransform[7] = 0;
	}
	return Math.ceil(c / 8);
};

var getCxformWithAlpha = function(binary, pos, colorTransform, colorRange) {
	var f = binary[pos];
	var hasAddTerms = f & 0x80;
	var hasMultTerms = f & 0x40;
	//var hasAddTerms = getBit(binary, pos, 0);
	//var hasMultTerms = getBit(binary, pos, 1);
	var bits = getBits(binary, pos, 2, 4);;
	var c = 6;
	if(hasMultTerms) {
		if(colorRange) {
			// 256 which is the default value should not be changed for the performance
			var v;
			colorTransform[0] = (v = sb2int(getBits(binary, pos, c, bits), bits)) == 256? v: (v / colorRange | 0) * colorRange;
			c += bits;
			colorTransform[1] = (v = sb2int(getBits(binary, pos, c, bits), bits)) == 256? v: (v / colorRange | 0) * colorRange;
			c += bits;
			colorTransform[2] = (v = sb2int(getBits(binary, pos, c, bits), bits)) == 256? v: (v / colorRange | 0) * colorRange;
			c += bits;
			colorTransform[3] = (v = sb2int(getBits(binary, pos, c, bits), bits)) == 256? v: (v / colorRange | 0) * colorRange;
			c += bits;
		} else {
			colorTransform[0] = sb2int(getBits(binary, pos, c, bits), bits);
			c += bits;
			colorTransform[1] = sb2int(getBits(binary, pos, c, bits), bits);
			c += bits;
			colorTransform[2] = sb2int(getBits(binary, pos, c, bits), bits);
			c += bits;
			colorTransform[3] = sb2int(getBits(binary, pos, c, bits), bits);
			c += bits;
		}
	} else {
		colorTransform[0] = 256;
		colorTransform[1] = 256;
		colorTransform[2] = 256;
		colorTransform[3] = 256;
	}
	if(hasAddTerms) {
		colorTransform[4] = sb2int(getBits(binary, pos, c, bits), bits);
		c += bits;
		colorTransform[5] = sb2int(getBits(binary, pos, c, bits), bits);
		c += bits;
		colorTransform[6] = sb2int(getBits(binary, pos, c, bits), bits);
		c += bits;
		colorTransform[7] = sb2int(getBits(binary, pos, c, bits), bits);
		c += bits;
	} else {
		colorTransform[4] = 0;
		colorTransform[5] = 0;
		colorTransform[6] = 0;
		colorTransform[7] = 0;
	}
	return Math.ceil(c / 8);
};

var getFloat = function(binary, pos) {
	var bits = getUI32(binary, pos);
	
	var s = (bits >> 31) & 0x1;
	var exp = (bits >> 23) & 0xFF;
	var fraction = bits & 0x7FFFFF;
	
	if(exp == 255) {
		if(fraction == 0) {
			return s == 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
		} else {
			return Number.NaN;
		}
	} else if(exp == 0 && fraction == 0) {
		return 0;
	}
	return ((s == 0)? 1: -1) * (fraction / Math.pow(2, 23) + 1) * Math.pow(2, exp - 127);
};
var getDouble = function(binary, pos) {
	var upperBits = getUI32(binary, pos);
	var lowerBits = getUI32(binary, pos + 4);
	
	var s = upperBits >>> 31 & 0x1;
	var exp = upperBits >>> 20 & 0x7FF;
	var upperFraction = upperBits & 0xFFFFF;
	var lowerFraction = lowerBits;
	return ((s == 0)? 1: -1) * (upperFraction / Math.pow(2, 20) + lowerFraction / Math.pow(2, 52) + 1) * Math.pow(2, exp - 1023);
};
var getGradient = function(binary, pos, version, gradient) {
	var p = pos;
	gradient.spreadMode = getBits(binary, pos, 0, 2);
	gradient.interpolationMode = getBits(binary, pos, 2, 2);
	var num = getBits(binary, pos, 4, 4);
	// gradient.num = num;
	p++;
	var records = [];
	for(var i = 0; i < num; i++) {
		var ratio = binary[p];
		p++;
		if(version == 3) {
			var color = getRGBA(binary, p);
			p += 4;
		} else {
			var color = getRGB(binary, p);
			p += 3;
		}
		records.push({ratio: ratio, color: color});
	}
	gradient.records = records;
	return p - pos;
};
