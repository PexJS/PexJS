var TagPlaceObject = function(binary, pos, length, type, delayEval, dataStore, colorRange) {
	setProperties(this, function() {
		var result = {};
		result.characterId = getUI16(binary, pos);
		result.depth = getUI16(binary, pos + 2);
		result.matrix = [];
		var len = getMatrix(binary, pos + 4, result.matrix);
		var p = pos + len + 4;
		result.cxform = null;
		if(p < length) {
			result.cxform = [];
			getCxform(binary, p, result.cxform, colorRange);
		}
		console.log(result.matrix);
		console.log(result.cxform);
		EngineLogE("PlaceObjectTag is not supported");
		return result;
	}, ["characterId", "depth", "matrix", "cxform"], delayEval);
};
TagPlaceObject.prototype.type = TagDefine.TypeTagPlaceObject;

var TagPlaceObject2 = function(binary, pos, length, type, delayEval, dataStore, colorRange) {
	setProperties(this, function() {
		var result = {};
		var f = binary[pos];
		result.move = f & 0x01;
		var p = pos + 1;
		var len;
		
		result.depth = getUI16(binary, p);
		p += 2;
		result.characterId = null;
		if(f & 0x02) {
			result.characterId = getUI16(binary, p);
			p += 2;
		}
		result.matrix = null;
		if(f & 0x04) {
			result.matrix = [];
			len = getMatrix(binary, p, result.matrix);
			p += len;
		}
		result.cxform = null;
		if(f & 0x08) {
			result.cxform = [];
			len = getCxformWithAlpha(binary, p, result.cxform, colorRange);
			p += len;
		}
		result.ratio = null;
		if(f & 0x10) {
			result.ratio = getUI16(binary, p);
			p += 2;
		}
		result.name = null;
		if(f & 0x20) {
			result.name = getString(binary, p, result.name);
			p += result.name.length + 1;
		}
		result.clipDepth = null;
		if(f & 0x40) {
			result.clipDepth = getUI16(binary, p);
		}
		
		// ignore clipactions because this is for swf5 and later
		return result;
	}, ["move", "depth", "characterId", "matrix", "cxform", "ratio", "name", "clipDepth"], delayEval);
};
TagPlaceObject2.prototype.type = TagDefine.TypeTagPlaceObject2;

var TagRemoveObject2 = function(binary, pos, length, type, delayEval, dataStore) {
	setProperty(this, "depth", function() {
		return getUI16(binary, pos);
	}, delayEval);
};
TagRemoveObject2.prototype.type = TagDefine.TypeTagRemoveObject2;

var TagShowFrame = function(binary, pos, length, type) {
};
TagShowFrame.prototype.type = TagDefine.TypeTagShowFrame;

