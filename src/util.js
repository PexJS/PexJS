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


var isHankaku = (function func(c) {
	var code = c.charCodeAt(0);
	func.reg = func.reg || new RegExp("\u005B\uFF61\uFF62\uFF63\uFF64\uFF65\uFF66\uFF67\uFF68\uFF69\uFF6A\uFF6B\uFF6C\uFF6D\uFF6E\uFF6F\uFF70\uFF71\uFF72\uFF73\uFF74\uFF75\uFF76\uFF77\uFF78\uFF79\uFF7A\uFF7B\uFF7C\uFF7D\uFF7E\uFF7F\uFF80\uFF81\uFF82\uFF83\uFF84\uFF85\uFF86\uFF87\uFF88\uFF89\uFF8A\uFF8B\uFF8C\uFF8D\uFF8E\uFF8F\uFF90\uFF91\uFF92\uFF93\uFF94\uFF95\uFF96\uFF97\uFF98\uFF99\uFF9A\uFF9B\uFF9C\uFF9D\uFF9E\uFF9F\u005D");
	return (0x20 <= code && code <= 0x7e) || func.reg.test(c);
});

var transformXY = function(t, x, y) {
	return [
		t[0] * x + t[2] * y + t[4] * 20,
		t[1] * x + t[3] * y + t[5] * 20
	];
};

var createDataStoreFromObject = function(obj, imageMap, onLoad) {
	if(PEX_VERSION.indexOf(obj.JSON_VERSION) != 0 && PEX_VERSION.indexOf(obj.JSON_VERSION) != 1) {
		EngineLogE("src object is not compatible with this Pex version. Please regenerate new one using parse_swf.");
	}

	if(!imageMap) {
		imageMap = {};
	}

	var dataStore = {
		header: obj.header,
		tagList: [],
		completed: true,
		loadingImageCount: 0
	};

	var tagList = obj.tagList;
	for(var i = 0, len = tagList.length; i < len; i++) {
		var instance = tagList[i];
		if(instance.hasOwnProperty("img")) {
			var img =  imageMap[instance.img] || document.createElement("img");
			if(!img.src) {
				img.onload = function() {
					if(--dataStore.loadingImageCount === 0) {
						onLoad && onLoad();
					}
				};
				img.src = instance.img;
				++dataStore.loadingImageCount;
			}
			instance.img = img;
		}
		dataStore.tagList.push(instance);
	}
	if(dataStore.loadingImageCount === 0) {
		onLoad && onLoad();
	}

	return dataStore;
};

var defineGetter = (function() {
	return (Object.defineProperty && !Object.prototype.__defineGetter__)
				? function(obj, name, func) {
					Object.defineProperty(obj, name, { configurable: true, get: func });
				}
				: function(obj, name, func) {
					obj.__defineGetter__(name, func);
				}
})();