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


var getMorphGradient = function(binary, pos, records) {
	var p = pos;
	var num = binary[p];
	p++;
	for(var i = 0; i < num; i++) {
		var record = {};
		record.startRatio = binary[p];
		p++;
		record.startColor = getRGBA(binary, p);
		p += 4;
		record.endRatio = binary[p];
		p++;
		record.endColor = getRGBA(binary, p);
		p += 4;
		records.push(record);
	}
	return p - pos;
};

var parseMorphFillStyleArray = function(binary, pos, result) {
	var p = pos;
	
	var fillStyleCount = binary[p];
	p++;
	if(fillStyleCount == 0xff) {
		fillStyleCount = getUI16(binary, p);
		p += 2;
	}
	var len;
	var fillStyles = [];
	for(var i = 0; i < fillStyleCount; i++) {
		var fillStyle = {};
		
		var type = binary[p];
		p++;
		fillStyle.type = type;
		if(type == 0x00) {
			fillStyle.start = getRGBA(binary, p);
			p += 4;
			fillStyle.end = getRGBA(binary, p);
			p += 4;
		} else if(type == 0x10 || type == 0x12) {
			fillStyle.start = [];
			fillStyle.end = [];
			fillStyle.gradient = {records: []};
			len = getMatrix(binary, p, fillStyle.start);
			p += len;
			len = getMatrix(binary, p, fillStyle.end);
			p += len;
			len = getMorphGradient(binary, p, fillStyle.gradient.records);
			p += len;
		} else if(type == 0x40 || type == 0x41 || type == 0x42 || type == 0x43) {
			fillStyle.bitmapId = getUI16(binary, p);
			p += 2;
			fillStyle.startMatrix = [];
			fillStyle.endMatrix = [];
			len = getMatrix(binary, p, fillStyle.startMatrix);
			p += len;
			len = getMatrix(binary, p, fillStyle.endMatrix);
			p += len;
		} else {
			EngineLogE("DefineMorph parse: unknown type detected [" + type + "]");
		}
		
		fillStyles.push(fillStyle);
	}
	result.fillStyles = fillStyles;
	
	return p - pos;
};
var parseMorphLineStyleArray = function(binary, pos, result) {
	var p = pos;
	
	var lineStyleCount = binary[p];
	p++;
	if(lineStyleCount == 0xff) {
		lineStyleCount = getUI16(binary, p);
		p += 2;
	}
	var len;
	var lineStyles = [];
	for(var i = 0; i < lineStyleCount; i++) {
		var lineStyle = {};
		lineStyle.startWidth = getUI16(binary, p);
		p += 2;
		lineStyle.endWidth = getUI16(binary, p);
		p += 2;
		lineStyle.startColor = getRGBA(binary, p);
		p += 4;
		lineStyle.endColor = getRGBA(binary, p);
		p += 4;
		lineStyles.push(lineStyle);
	}
	result.lineStyles = lineStyles;
	return p - pos;
};

var TagDefineMorphShape = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperties(this, function() {
		var result = {};
		var p = pos + 2;
		var len;
		result.startBounds = [];
		len = getRect(binary, p, result.startBounds);
		p += len;
		result.endBounds = [];
		len = getRect(binary, p, result.endBounds);
		p += len;
		result.offset = getUI32(binary, p);
		p += 4;
		len = parseMorphFillStyleArray(binary, p, result);
		p += len;
		len = parseMorphLineStyleArray(binary, p, result);
		p += len;
		len = parseShape(binary, p, 1, result, "startEdges");
		p += len;
		len = parseShape(binary, p, 1, result, "endEdges");
		p += len;

		//
		if (result.startEdges.length - 1 == result.endEdges.length && result.endEdges[0] != EdgeDefine.TypeStyleChange) {
			result.endEdges.unshift(result.startEdges[0]);
		}

		return result;
	}, ["startBounds", "endBounds", "offset", "fillStyles", "lineStyles", "startEdges", "endEdges"], delayEval);
};
TagDefineMorphShape.prototype.type = TagDefine.TypeTagDefineMorphShape;
