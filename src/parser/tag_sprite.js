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


var TagDefineSprite = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperties(this, function() {
		var result = {};
		var p = pos + 2;
		result.frameCount = getUI16(binary, p);
		p += 2;
		
		var tags = [];
		while(p < pos + length) {
			var feed = getUI16(binary, p);
			var size = 2;
			var tagType = feed >> 6;
			
			var tagLength = feed & 0x3F;
			if(tagLength == 0x3f) {
				tagLength = getUI32(binary, p + 2);
				size += 4;
			}
			
			var tagClass = TagFactory[tagType] || TagGeneral;
			var instance = new tagClass(binary, p + size, tagLength, tagType);
			tags.push(instance);
			p += tagLength + size;
		}
		
		result.tags = tags;
		return result;
	}, ["frameCount", "tags"], delayEval);
};
TagDefineSprite.prototype.type = TagDefine.TypeTagDefineSprite;
