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


var getActionRecord = function(binary, pos, records) {
	var p = pos;
	while(true) {
		var offset = p - pos;
		var code = binary[p];
		p++;
		if(!code) {
			var instance = new ActionGeneral(binary, p);
			instance.code = 0;
			instance.offset = offset;
			records.push(instance);
			break;
		}
		var len = 0;
		if(code < 0x80) {
			var actionClass = ActionGeneral;
		} else {
			len = getUI16(binary, p);
			p += 2;
			var actionClass = ActionFactory[code] || ActionError;
		}
		var instance = new actionClass(binary, p, len, code);
		p += len;
		instance.code = code;
		instance.offset = offset;
		instance.nextOffset = p - pos;
		records.push(instance);
	}
	return p - pos;
};
var TagDoAction = function(binary, pos, length, type, delayEval, dataStore) {
	setProperty(this, "actions", function() {
		var result = [];
		getActionRecord(binary, pos, result);
		return result;
	}, delayEval);
};
TagDoAction.prototype.type = TagDefine.TypeTagDoAction;

var ActionGotoFrame = function(binary, pos, length) {
	this.frame = getUI16(binary, pos) + 1;
};
var ActionGetURL = function(binary, pos, length) {
	this.urlString = getString(binary, pos);
	this.targetString = getString(binary, pos + this.urlString.length + 1);
	console.log(this.urlString, this.targetString);
	EngineLogE("ActionGetURL is not supported");
};
var ActionWaitForFrame = function(binary, pos, length) {
	this.frame = getUI16(binary, pos);
	this.skipCount = binary[pos + 2];
	console.log(this.frame, this.skipCount);
	EngineLogE("ActionWaitForFrame is not supported");
};
var ActionSetTarget = function(binary, pos, length) {
	this.name = getString(binary, pos);
};
var ActionGoToLabel = function(binary, pos, length) {
	this.label = getString(binary, pos);
};
var ActionPush = function(binary, pos, length) {
	var c = pos;
	var result = [];
	while(c < pos + length) {
		var type = binary[c];
		c++;
		switch(type) {
		case 0:
			var ret = getStringSJIS(binary, c);
			result.push(ret[0]);
			c += ret[1];
			/*/
			var str = getString(binary, c);
			result.push(str);
			c += str.length + 1;
			*/
			break;
		case 1:
			result.push(getFloat(binary, c));
			c += 4;
			break;
		case 2:
			result.push(null);
			break;
		case 3:
			result.push(void 0); // undefined
			break;
		case 4:
			result.push(binary[c]);
			c++;
			break;
		case 5:
			result.push(binary[c] != 0);
			c++;
			EngineLogW("action push: boolean is danger. change 1/0");
			break;
		case 6:
			result.push(getDouble(binary, c));
			c += 8;
			EngineLogW("action push: double value is not tested!");
			break;
		case 7:
			result.push(getUI32(binary, c));
			c += 4;
			break;
		case 8:
			result.push(binary[c]);
			c++;
			EngineLogW("action push: unsupported push recognized");
			break;
		case 9:
			result.push(getUI16(binary, c));
			c += 2;
			EngineLogW("action push: unsupported push recognized");
			break;
		}
	}
	this.values = result;
};
var ActionJump = function(binary, pos, length) {
	this.branchOffset = getSI16(binary, pos);
};
var ActionIf = function(binary, pos, length) {
	this.branchOffset = getSI16(binary, pos);
};
var ActionCall = function(binary, pos) {
};
var ActionGotoFrame2 = function(binary, pos, length) {
	var f = binary[pos];
	this.play = f & 0x01;
	this.sceneBiasFlag = f & 0x02;
	if(this.sceneBiasFlag) {
		this.sceneBias = getUI16(binary, pos + 1);
	}
};
var ActionWaitForFrame2 = function(binary, pos, length) {
	this.skipCount = binary[pos];
	console.log(Debug(this));
	EngineLogE("ActionWaitForFrame2 is not supported");
};
var ActionGetURL2 = function(binary, pos, length) {
	this.loadTargetFlag = getBit(binary, pos, 0);
	this.loadVariablesFlag = getBit(binary, pos, 1);
	// reserved getBits(binary, pos, 2, 4) == 0
	this.sendVarsMethod = getBits(binary, pos, 6, 2);
};

var ActionGeneral = function(binary, pos) {
};
var ActionError = function(binary, pos, length, code) {
	EngineLogW("action parser: not supported action code detected [" + code +"]");
};

var ActionFactory = {
	"129": ActionGotoFrame,
	"131": ActionGetURL,
	"138": ActionWaitForFrame,
	"139": ActionSetTarget,
	"140": ActionGoToLabel,
	"150": ActionPush,
	"153": ActionJump,
	"157": ActionIf,
	"158": ActionCall,
	"159": ActionGotoFrame2,
	"141": ActionWaitForFrame2,
	"154": ActionGetURL2
};

