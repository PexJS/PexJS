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


var makeJSON = function(tagger) {
	function isElement(e){
		if(e && e.nodeType === 1){
			return true;
			try{
				console.log("!");
				e.nodeType = e.nodeType;
			} catch(n) {
				return true;
			}
		}
		return false;
	}
	var clone = function(o) {
		if(o && o.constructor === Array) {
			var a = [];
			for(var i = 0; i < o.length; i++) {
				a.push(clone(o[i]));
			}
			return a;
		}
		if(o && typeof o == "object") {
			if(isElement(o)) {
				return "<ELEMENT>";
			}
			var ret = {};
			for(var key in o) {
				ret[key] = clone(o[key]);
			}
			return ret;
		}
		if(typeof o == "function") {
			console.log("func?", o);
		} else {
			return o;
		}
	};
	var tagList = [];
	for(var i = 0; i < tagger.tagList.length; i++) {
		var obj = {};
		var tag = tagger.tagList[i];
		tagList.push(clone(tag));
	}
	var json = JSON.stringify(tagList);
	console.log(json);
	console.log(json.length);
};
