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


var getTextRecord = function(binary, pos, version, glyphBits, advanceBits, record) {
	var p = pos;
	
	var f = binary[p];
	var flagHasFont		= f & 0x08;
	var flagHasColor	= f & 0x04;
	var flagHasYOffset	= f & 0x02;
	var flagHasXOffset	= f & 0x01;
	p++;
	
	record.fontId = null;
	if(flagHasFont) {
		record.fontId = getUI16(binary, p);
		p += 2;
	}
	record.color = null;
	if(flagHasColor) {
		if(version == 2) {
			record.color = getRGBA(binary, p);
			p += 4;
		} else {
			record.color = getRGB(binary, p);
			p += 3;
		}
	}
	record.x = null;
	if(flagHasXOffset) {
		record.x = getSI16(binary, p);
		p += 2;
	}
	record.y = null;
	if(flagHasYOffset) {
		record.y = getSI16(binary, p);
		p += 2;
	}
	record.height = null;
	if(flagHasFont) {
		record.height = getUI16(binary, p);
		p += 2;
	}
	var count = binary[p];
	p++;
	var c = 0;
	var glyphs = [];
	for(var i = 0; i < count; i++) {
		var glyph = {};
		glyph.index = getBits(binary, p, c, glyphBits);
		c += glyphBits;
		glyph.advance = sb2int(getBits(binary, p, c, advanceBits), advanceBits);
		c += advanceBits;
		glyphs.push(glyph);
	}
	record.glyphs = glyphs;
	p += Math.ceil(c / 8);
	
	return p - pos;
};

var TagDefineFont = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperty(this, "shapes", function() {
		var p = pos + 2;
		
		var count = getUI16(binary, p);
		p += count;
		count /= 2;
		
		var shapeTable = [];
		var len;
		for(var i = 0; i < count; i++) {
			var shape = [];
			len = parseShape(binary, p, 1, shape);
			p += len;
			shapeTable.push(shape);
		}
		return shapeTable;
	}, delayEval);
};
TagDefineFont.prototype.type = TagDefine.TypeTagDefineFont;

var TagDefineFont2 = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperties(this, function() {
		var result = {};
		var p = pos + 2;
		var len;
		
		var f = binary[p];
		var fontFlagsHasLayout		= f & 0x80;
		var fontFlagsShiftJIS		= f & 0x40;
		var fontFlagsSmallText		= f & 0x20;
		var fontFlagsANSI			= f & 0x10;
		var fontFlagsWideOffsets	= f & 0x08;
		var fontFlagsWideCodes		= f & 0x04;
		var fontFlagsItalic			= f & 0x02;
		var fontFlagsBlod			= f & 0x01;
		p++;
		// pass language code
		p++;
		var fontNameLen = binary[p];
		p++;
		//var fontName = getStringLength(binary, p, fontNameLen);
		p += fontNameLen;
		var numGlyphs = getUI16(binary, p);
		p += 2;
		if(fontFlagsWideOffsets) { // FontFlagWideOffsets
			p += 4 * (numGlyphs + 1);
		} else {
			p += 2 * (numGlyphs + 1);
		}
		var shapeTable = [];
		for(var i = 0; i < numGlyphs; i++) {
			var shape = [];
			len = parseShape(binary, p, 1, shape);
			p += len;
			shapeTable.push(shape);
		}
		result.shapeTable = shapeTable;
		var codeTable = [];
		for(var i = 0; i < numGlyphs; i++) {
			var lower = binary[p];
			p++;
			var upper = 0;
			if(fontFlagsWideCodes) {
				upper = binary[p];
				p++;
			}
			if(upper == 0) {
				codeTable.push(lower);
			} else {
				var s = toStringFromShiftJIS([upper, lower]);
				codeTable.push(s.charCodeAt(0));
			}
		}
		result.codeTable = codeTable;
		result.fontAscent = null;
		result.fontDescent = null;
		result.fontLeading = null;
		result.fontAdvanceTable = null;
		if(fontFlagsHasLayout) {
			result.fontAscent = getUI16(binary, p);
			p += 2;
			result.fontDescent = getUI16(binary, p);
			p += 2;
			result.fontLeading = getUI16(binary, p);
			p += 2;
			var fontAdvanceTable = [];
			for(var i = 0; i < numGlyphs; i++) {
				fontAdvanceTable.push(getUI16(binary, p));
				p += 2;
			}
			result.fontAdvanceTable = fontAdvanceTable;
			for(var i = 0; i < numGlyphs; i++) {
				// omit
				var rect = [];
				len = getRect(binary, p, rect);
				p += len;
			}
			var kerningCount = getUI16(binary, p);
			p += 2;
			if(kerningCount != 0) {
				EngineLogW("DefineFont2 parse: wrong format detected");
			}
		}
		return result;
	}, ["shapeTable", "codeTable", "fontAscent", "fontDescent", "fontLeading", "fontAdvanceTable"], delayEval);
};
TagDefineFont2.prototype.type = TagDefine.TypeTagDefineFont2;

var TagDefineText = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperties(this, function() {
		var result = {};
		var p = pos + 2;
		var len;
		
		result.bounds = [];
		len = getRect(binary, p, result.bounds);
		p += len;
		
		result.matrix = [];
		len = getMatrix(binary, p, result.matrix);
		p += len;
		
		var glyphBits = binary[p];
		p++;
		var advanceBits = binary[p];
		p++;
		var records = [];
		while(binary[p]) {
			var record = {};
			len = getTextRecord(binary, p, 1, glyphBits, advanceBits, record);
			p += len;
			records.push(record);
		}
		result.records = records;
		return result;
	}, ["bounds", "matrix", "records"], delayEval);
};
TagDefineText.prototype.type = TagDefine.TypeTagDefineText;

var TagDefineText2 = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperties(this, function() {
		var result = {};
		var p = pos + 2;
		var len;
		
		result.bounds = [];
		len = getRect(binary, p, result.bounds);
		p += len;
		
		result.matrix = [];
		len = getMatrix(binary, p, result.matrix);
		p += len;
		
		var glyphBits = binary[p];
		p++;
		var advanceBits = binary[p];
		p++;
		var records = [];
		while(binary[p]) {
			var record = {};
			len = getTextRecord(binary, p, 2, glyphBits, advanceBits, record);
			p += len;
			records.push(record);
		}
		result.records = records;
		return result;
	}, ["bounds", "matrix", "records"], delayEval);
};
TagDefineText2.prototype.type = TagDefine.TypeTagDefineText2;

var TagDefineEditText = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperties(this, function() {
		var result = {};
		var p = pos + 2;
		var len;
		
		result.bounds = [];
		len = getRect(binary, p, result.bounds);
		p += len;
		
		var f = binary[p];
		var hasText			= f & 0x80;
		result.wordWrap		= !!(f & 0x40);
		result.multiline	= !!(f & 0x20);
		var password		= f & 0x10;
		var readonly		= f & 0x08;
		var hasTextColor	= f & 0x04;
		var hasMaxLength	= f & 0x02;
		var hasFont			= f & 0x01;
		p++;
		f = binary[p];
		var hasFontClass	= f & 0x80;
		var autoSize		= f & 0x40;
		var hasLayout		= f & 0x20;
		var noSelect		= f & 0x10;
		var border			= f & 0x08;
		var wasStatic		= f & 0x04;
		var html			= f & 0x02;
		result.useOutlines	= !!(f & 0x01);
		p++;
		
		result.fontId = null;
		if(hasFont) {
			result.fontId = getUI16(binary, p);
			p += 2;
		}
		if(hasFontClass) {
			var fontClass = getString(binary, p);
			p += fontClass.length;
		}
		result.height = null;
		if(hasFont) {
			result.height = getUI16(binary, p);
			p += 2;
		}
		result.color = null;
		if(hasTextColor) {
			result.color = getRGBA(binary, p);
			p += 4;
		}
		result.maxLength = null;
		if(hasMaxLength) {
			result.maxLength = getUI16(binary, p);
			p += 2;
		}
		result.align = null;
		result.leftMargin = null;
		result.rightMargin = null;
		result.indent = null;
		result.leading = null;
		if(hasLayout) {
			result.align = binary[p];
			p++;
			result.leftMargin = getUI16(binary, p);
			p += 2;
			result.rightMargin = getUI16(binary, p);
			p += 2;
			result.indent = getUI16(binary, p);
			p += 2;
			result.leading = getSI16(binary, p);
			p += 2;
		}
		result.variableName = getString(binary, p);
		p += result.variableName.length+1;
		result.initialText = hasText? getStringSJIS(binary, p)[0] : "";
		return result;
	}, ["bounds", "wordWrap", "multiline", "useOutlines", "fontId", "height", "color", "maxLength", "align", "leftMargin", "rightMargin", "indent", "leading", "variableName", "initialText"], delayEval);
};
TagDefineEditText.prototype.type = TagDefine.TypeTagDefineEditText;
