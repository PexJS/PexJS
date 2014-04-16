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
	
