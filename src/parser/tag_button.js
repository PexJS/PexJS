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


var getButtonRecord = function(binary, pos, version, record) {
	var p = pos;
	var len;
	
	var f = binary[pos];
	var hasBlendMode	= f & 0x20;
	var hasFilterList	= f & 0x10;
	record.stateHitTest	= !!(f & 0x08);
	record.stateDown	= !!(f & 0x04);
	record.stateOver	= !!(f & 0x02);
	record.stateUp		= !!(f & 0x01);
	p++;
	
	record.characterId = getUI16(binary, p);
	p += 2;
	record.depth = getUI16(binary, p);
	p += 2;
	record.matrix = [];
	len = getMatrix(binary, p, record.matrix);
	p += len;
	record.colorTransform = null;
	if(version == 2) {
		record.colorTransform = [];
		len = getCxform(binary, p, record.colorTransform);
		p += len;
		if(hasFilterList) {
			EngineLogE("ButtonRecord parse error: hasFilterList is not supported in Flash 4");
		}
		if(hasBlendMode) {
			EngineLogE("ButtonRecord parse error: hasBlendMode is not supported in Flash 4");
		}
	}
	
	return p - pos;
};

var getButtonCondAction = function(binary, pos, action) {
	var p = pos;
	
	p += 2;
	var f = binary[p];
	action.idleToOverDown 		= !!(f & 0x80);
	action.outDownToIdle 		= !!(f & 0x40);
	action.outDownToOverDown	= !!(f & 0x20);
	action.overDownToOutDown	= !!(f & 0x10);
	action.overDownToOverUp		= !!(f & 0x08);
	action.overUpToOverDown		= !!(f & 0x04);
	action.overUpToIdle 		= !!(f & 0x02);
	action.idleToOverUp 		= !!(f & 0x01);
	p++;
	f = binary[p];
	action.overDownToIdle		= !!(f & 0x01);
	action.keyPress = getBits(binary, p, 0, 7);
	p++;
	
	action.actions = [];
	var len = getActionRecord(binary, p, action.actions);
	p += len;
	
	return p - pos;
};

var TagDefineButton = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperties(this, function() {
		var result = {};
		var p = pos + 2;
		var len;
		
		var characters = [];
		while(binary[p]) {
			var record = {};
			len = getButtonRecord(binary, p, 1, record);
			p += len;
			characters.push(record);
		}
		result.characters = characters;
		p++;
		
		result.actions = [];
		getActionRecord(binary, p, result.actions);
		
		return result;
	}, ["characters", "actions"], delayEval);
};
TagDefineButton.prototype.type = TagDefine.TypeTagDefineButton;

var TagDefineButton2 = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperties(this, function() {
		var result = {};
		var p = pos + 2;
		var len;
		
		// pass flags
		p++;
		
		var actionOffset = getUI16(binary, p);
		p += 2;
		
		var characters = [];
		while(binary[p]) {
			var record = {};
			len = getButtonRecord(binary, p, 2, record);
			p += len;
			characters.push(record);
		}
		result.characters = characters;
		p++;
		
		var actions = [];
		if(actionOffset) {
			var hasNext;
			do {
				var action = {};
				hasNext = getUI16(binary, p);
				len = getButtonCondAction(binary, p, action);
				p += len;
				actions.push(action);
			} while(hasNext);
		}
		result.actions = actions;
		
		return result;
	}, ["characters", "actions"], delayEval);
};
TagDefineButton2.prototype.type = TagDefine.TypeTagDefineButton2;

