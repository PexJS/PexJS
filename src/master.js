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


var Master = function () {
	this.data = {};
	this.engineList = [];

	this.debug = false;
	this.suppressFPS = false;
	
	// debug: fps
	this.frame = 0;
	this.lastTick = 0;
	// start tick
	var that = this;
	(function tick() {
		setTimeout(tick, 1000 / 60);
		var now = Date.now();
		var ret = false;
		for(var i = 0; i < that.engineList.length; i++) {
			ret = that.engineList[i].tick(now) || ret;
		}
		
		// fps 
		ret && that.frame++;
		var last = that.lastTick = that.lastTick || now;
		if(now - last > 1000) {
			that.debug && !that.suppressFPS && EngineLogD("fps:" + that.frame * 1000 / (now - last));
			that.frame = 0;
			that.lastTick = now;
		}
		//setTimeout(tick, 0);
	})();
};

Master.getInstance = function() {
	var ctor = Master;
	if (ctor.__instance__) {
		return ctor.__instance__;
	}
	return ctor.__instance__ = new ctor;
};

Master.prototype.load = function(src, container, option) {
	var dataStore;
	if(typeof src == "string") {
		var name = (option && option.name) || src;
		dataStore = this.data[name];
		if(!dataStore) {
			// load the data
			if(typeof name == "string") {
				if(option && option.json) {
					EngineLogE("unimplemented json reader");
				} else {
					// use swf parser as dataStore
					var parser = new Parser(option);
					var engine = new Engine(parser, container, option);
					parser.load(src, function(that) { return function() {that.dataStoreProgress.apply(that, arguments);}; }(engine));
					if(!option || !option.solo) {
						this.data[name] = parser;
					}
					this.engineList.push(engine);
					return engine;
				}
			}
		} else {
			var engine = new Engine(dataStore, container, option);
			dataStore.addCallback(function(that) { return function() {that.dataStoreProgress.apply(that, arguments);}; }(engine));
			//this.data[name] = parser;
			this.engineList.push(engine);
			return engine;
		}
		return null;
	}

	if(typeof src == "object") {
		dataStore = createDataStoreFromObject(src, (option && option.imageMap));
		var engine = new Engine(dataStore, container, option);
		engine.dataStoreProgress();
		this.engineList.push(engine);
		return engine;
	}

	return null;
};

Master.prototype.removeEngine = function(engine) {
	var engineList = this.engineList;
	var len = engineList.length;
	for(var i = 0; i < len; i++) {
		if(engineList[i] == engine) {
			engineList.splice(i,1);
			return true;
		}
	}
	return false;
};

var Pex = function(src, container, option) {
	// save the first time
	Pex.firstTime = Pex.firstTime || Date.now();
	option = option || {};

	var master = Master.getInstance();
	master.debug = master.debug || option.debug;

	for(var key in defaultOption) {
		(key in option) || (option[key] = defaultOption[key]);
	}
	for(var key in option) {
		if(!key in defaultOption) {
			option.debug && EngineLogD("unknown option: " + key);
		}
	}
	master.suppressFPS |= option.suppressLog.fps;
	return master.load(src, container, option);
};

// publish Pex
window.Pex = Pex;
