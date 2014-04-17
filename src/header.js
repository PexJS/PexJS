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


;(function() {
	'use strict';
	var PEX_VERSION = "#PEX_VERSION#";

	var develop = true;

	var EngineLogD = function(error) {
		console.log.apply(console, Array.prototype.slice.apply(arguments));
	};
	var EngineLogE = function(error) {
		console.error.apply(console, Array.prototype.slice.apply(arguments));
		throw error;
	};
	var EngineLogW = function() {
		console.warn.apply(console, Array.prototype.slice.apply(arguments));
	};
	
	var Debug = function(obj1) {
		if(obj1.constructor == Array) {
			return [].concat(obj1);
		}
		var obj2 = {};
		for (var v in obj1) {
			obj2[v] = obj1[v];
		}
		return obj2;
	};
	
