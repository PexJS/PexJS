var parseFillStyleArray = function(binary, pos, version, result) {
	var p = pos;
	
	var fillStyleCount = binary[p];
	p++;
	if(fillStyleCount == 0xff) {
		fillStyleCount = getUI16(binary, p);
		p += 2;
	}
	var len = 0;
	var fillStyles = [];
	for(var i = 0; i < fillStyleCount; i++) {
		var fillStyle = {};
		var type = binary[p];
		p++;
		fillStyle.type = type;
		if(type == 0x00) {
			if(version == 3) {
				fillStyle.color = getRGBA(binary, p);
				p += 4;
			} else {
				fillStyle.color = getRGB(binary, p);
				p += 3;
			}
		} else if(type == 0x10 || type == 0x12 || type == 0x13) {
			fillStyle.matrix = [];
			fillStyle.gradient = {records: []};
			len = getMatrix(binary, p, fillStyle.matrix);
			p += len;
			len = getGradient(binary, p, version, fillStyle.gradient);
			p += len;
			if(type == 0x13) {
				EngineLogE("paser fillstyle: detected swf8 structure");
			}
		} else if(type == 0x40 || type == 0x41 || type == 0x42 || type == 0x43) {
			fillStyle.bitmapId = getUI16(binary, p);
			p += 2;
			fillStyle.matrix = [];
			len = getMatrix(binary, p, fillStyle.matrix);
			p += len;
		} else {
			EngineLogE("parser fillstyle: unknown type:" + type);
		}
		fillStyles.push(fillStyle);
	}
	result.fillStyles = fillStyles;
	return p - pos;
};
var parseLineStyleArray = function(binary, pos, version, result) {
	var p = pos;
	var lineStyleCount = binary[p];
	p++;
	if(lineStyleCount == 0xff) {
		lineStyleCount = getUI16(binary, p);
		p += 2;
	}
	var lineStyles = [];
	for(var i = 0; i < lineStyleCount; i++) {
		var lineStyle = {};
		lineStyle.width = getUI16(binary, p);
		p += 2;
		if(version == 3) {
			lineStyle.color = getRGBA(binary, p);
			p += 4;
		} else {
			lineStyle.color = getRGB(binary, p);
			p += 3;
		}
		lineStyles.push(lineStyle);
	}
	result.lineStyles = lineStyles;
	return p - pos;
};
var parseShapeWithStyle = function(binary, pos, version, result) {
	var p = pos;
	var len = 0;
	len = parseFillStyleArray(binary, p, version, result);
	p += len;
	
	len = parseLineStyleArray(binary, p, version, result);
	p += len;
	
	len = parseShape(binary, p, version, result, "shapes");
	p += len;
	return p - pos;
};
var parseShape = function(binary, pos, version, result, attribute) {
	var p = pos;
	var len;
	var numFillBits = getBits(binary, p, 0, 4);
	var numLineBits = getBits(binary, p, 4, 4);
	p++;
	//result.numFillBits = numFillBits;
	//result.numLineBits = numLineBits;
	
	
	var shapeRecords;
	if(attribute) {
		shapeRecords = [];
	} else {
		shapeRecords = result;
	}
	var bits;
	var c = 0;
	while((bits = getBits(binary, p, c, 6)) != 0) {
		var record = {};
		if(bits & 0x20) {
			if(bits & 0x10) {
				// STRAIGHTEDGERECORD
				record.type = EdgeDefine.TypeStraight;
				record.x = 0;
				record.y = 0;
				c += 2;
				var numBits = getBits(binary, p, c, 4) + 2;
				c += 4;
				var generalLineFlag = getBit(binary, p, c);
				c++;
				if(generalLineFlag) {
					record.x = sb2int(getBits(binary, p, c, numBits), numBits);
					c += numBits;
					record.y = sb2int(getBits(binary, p, c, numBits), numBits);
					c += numBits;
				} else {
					var vertLineFlag = getBit(binary, p, c);
					c++;
					if(vertLineFlag) {
						record.y = sb2int(getBits(binary, p, c, numBits), numBits);
						c += numBits;
					} else {
						record.x = sb2int(getBits(binary, p, c, numBits), numBits);
						c += numBits;
					}
				}
			} else {
				// CURVEDEDGERECORD
				record.type = EdgeDefine.TypeCurve;
				c += 2;
				var numBits = getBits(binary, p, c, 4) + 2;
				c += 4;
				record.cx = sb2int(getBits(binary, p, c, numBits), numBits);
				c += numBits;
				record.cy = sb2int(getBits(binary, p, c, numBits), numBits);
				c += numBits;
				record.ax = sb2int(getBits(binary, p, c, numBits), numBits);
				c += numBits;
				record.ay = sb2int(getBits(binary, p, c, numBits), numBits);
				c += numBits;
			}
		} else {
			// STYLECHANGERECORD
			record.type = EdgeDefine.TypeStyleChange;
			c++;
			var stateNewStyles = getBit(binary, p, c);
			c++;
			var stateLineStyle = getBit(binary, p, c);
			c++;
			var stateFillStyle1 = getBit(binary, p, c);
			c++;
			var stateFillStyle0 = getBit(binary, p, c);
			c++;
			var stateMoveTo = getBit(binary, p, c);
			c++;
			if(stateMoveTo) {
				var moveBits = getBits(binary, p, c, 5);
				c += 5;
				var moveDeltaX = getBits(binary, p, c, moveBits);
				c += moveBits;
				var moveDeltaY = getBits(binary, p, c, moveBits);
				c += moveBits;
				record.dx = sb2int(moveDeltaX, moveBits);
				record.dy = sb2int(moveDeltaY, moveBits);
			}
			if(stateFillStyle0) {
				record.fillStyle0 = getBits(binary, p, c, numFillBits);
				c += numFillBits;
			}
			if(stateFillStyle1) {
				record.fillStyle1 = getBits(binary, p, c, numFillBits);
				c += numFillBits;
			}
			if(stateLineStyle) {
				record.lineStyle = getBits(binary, p, c, numLineBits);
				c += numLineBits;
			}
			if(stateNewStyles) {
				// set aliment
				p += Math.ceil(c / 8);
				c = 0;
				//record.fillStyles = {};
				//record.lineStyles = {};
				len = parseFillStyleArray(binary, p, version, record);
				p += len;
				len = parseLineStyleArray(binary, p, version, record);
				p += len;
				numFillBits = getBits(binary, p, 0, 4);
				c += 4;
				numLineBits = getBits(binary, p, 4, 4);
				c += 4;
			}
		}
		shapeRecords.push(record);
	}
	c += 6; // end record
	if(attribute) {
		result[attribute] = shapeRecords;
	}
	
	p += Math.ceil(c / 8);
	return p - pos;
};

var TagDefineShape = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperties(this, function() {
		var result = {};
		result.bounds = [];
		var len = getRect(binary, pos + 2, result.bounds);
		parseShapeWithStyle(binary, pos + 2 + len, 1, result);
		
		return result;
	}, ["bounds", "fillStyles", "lineStyles", "shapes"], delayEval);
};
TagDefineShape.prototype.type = TagDefine.TypeTagDefineShape;

var TagDefineShape2 = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperties(this, function() {
		var result = {};
		result.bounds = [];
		var len = getRect(binary, pos + 2, result.bounds);
		parseShapeWithStyle(binary, pos + 2 + len, 2, result);
		
		return result;
	}, ["bounds", "fillStyles", "lineStyles", "shapes"], delayEval);
};
TagDefineShape2.prototype.type = TagDefine.TypeTagDefineShape2;

var TagDefineShape3 = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperties(this, function() {
		var result = {};
		result.bounds = [];
		var len = getRect(binary, pos + 2, result.bounds);
		parseShapeWithStyle(binary, pos + 2 + len, 3, result);
		
		return result;
	}, ["bounds", "fillStyles", "lineStyles", "shapes"], delayEval);
};
TagDefineShape3.prototype.type = TagDefine.TypeTagDefineShape3;
