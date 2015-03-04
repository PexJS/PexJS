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


var setProperty = function(obj, name, func, delayEval) {
	if(!delayEval) {
		obj[name] = func();
		return;
	}
	
	defineGetter(obj, name, function() {
		delete this[name];
		return this[name] = func();
	});
};

var setProperties = function(obj, func, attributes, delayEval) {
	if(!delayEval) {
		var result = func();
		for(var key in result) {
			obj[key] = result[key];
		}
		return;
	}
	
	var len = attributes.length;
	for(var i = 0; i < len; i++) {
		// set "FIRST" property
		defineGetter(obj, attributes[i],
			function(ownKey) {
				return function() {
					var result = func();
					for(var key in result) {
						delete this[key];
						this[key] = result[key];
					}
					return result[ownKey];
				};
			}(attributes[i])
		);
	}
};
