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


var TagJPEGTables = function(binary, pos, length, type, delayEval, dataStore) {
	setProperty(this, "jpegData", function() {
		return binary.slice(pos, pos + length);
	}, delayEval);
	// notify myself to ImageManager
	ImageManager.jpegTables = this;
};
TagJPEGTables.prototype.type = TagDefine.TypeTagJPEGTables;

var TagDefineBits = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperty(this, "img", function() {
		var jpegData = binary.slice(pos + 2, pos + length);
		if(!ImageManager.jpegTables) {
			EngineLogW("DefineBits warning: not found JPEGTables");
		}
		return ImageManager.createImageFromJpegTableAndBits(ImageManager.jpegTables, jpegData, dataStore);
	}, false);
};
TagDefineBits.prototype.type = TagDefine.TypeTagDefineBits;

var TagDefineBitsJPEG2 = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperty(this, "img", function() {
		var imageData = binary.slice(pos + 2, pos + length);
		return ImageManager.createImageFromJpeg(imageData, dataStore);
	}, false);
};
TagDefineBitsJPEG2.prototype.type = TagDefine.TypeTagDefineBitsJPEG2;

var TagDefineBitsJPEG3 = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperty(this, "img", function() {
		var p = pos + 2;
		var alphaDataOffset = getUI32(binary, p);
		p += 4;
		var jpegData = binary.slice(p, p + alphaDataOffset);
		p += alphaDataOffset;
		var bitmapAlphaData = binary.slice(p, pos + length);
		
		return ImageManager.createImageFromJpegAndAlpha(jpegData, bitmapAlphaData, dataStore);
	}, false);
};
TagDefineBitsJPEG3.prototype.type = TagDefine.TypeTagDefineBitsJPEG3;

var TagDefineBitsLossless = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperties(this, function() {
		var result = {};
		var format = binary[pos + 2];
		result.width = getUI16(binary, pos + 3);
		result.height = getUI16(binary, pos + 5);
		var p = pos + 7;
		if(format == 3) {
			var colorTableSize = binary[p] + 1;
			p++;
		}
		
		var pixelSize;
		switch(format) {
			case 3: pixelSize = 8; break;
			case 4: pixelSize = 16; break;
			case 5: pixelSize = 24; break;
		}
		result.img = ImageManager.createImageFromLossless(binary.slice(p, pos + length), pixelSize, colorTableSize, result.width, result.height, false);
		return result;
	}, ["width", "height", "img"], delayEval);
};
TagDefineBitsLossless.prototype.type = TagDefine.TypeTagDefineBitsLossless;

var TagDefineBitsLossless2 = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperties(this, function() {
		var result = {};
		var format = binary[pos + 2];
		result.width = getUI16(binary, pos + 3);
		result.height = getUI16(binary, pos + 5);
		var p = pos + 7;
		if(format == 3) {
			var colorTableSize = binary[p] + 1;
			p++;
		}
		
		var pixelSize;
		switch(format) {
			case 3: pixelSize = 8; break;
			case 4: pixelSize = 16; break;
			case 5: pixelSize = 32; break;
		}
		
		result.img = ImageManager.createImageFromLossless(binary.slice(p, pos + length), pixelSize, colorTableSize, result.width, result.height, true);
		return result;
	}, ["width", "height", "img"], delayEval);
};
TagDefineBitsLossless2.prototype.type = TagDefine.TypeTagDefineBitsLossless2;
