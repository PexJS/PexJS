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


var API = function(engine) {
	this.engine = engine;
};

API.prototype.gotoFrame = function(name, frame, sync) {
	var engine = this.engine;
	var mc = getMovieClipFromTargetName(engine.rootMC, name);
	if (!mc) {
		return false;
	}
	frame = +(mc.mcInfo.frameLabelMap[(frame + "")] || frame);
	// create action function
	if(!frame) {
		return false;	
	}
	var actions = createActionFunction([
		{code: ActionDefine.TypeActionGotoFrame, frame: frame, offset:0},
		{code: ActionDefine.TypeActionPlay, offset:4}
	]);

	if(sync || typeof(sync) === "undefined") {
		engine.vm.executeAction(mc, actions);
		return true;
	}

	// for backward compatibility
	// add action
	engine.vm.addAction(mc, actions);
 	return true;
};

API.prototype.gotoAndStop = function(name, frame, sync) {
	var engine = this.engine;
	var mc = getMovieClipFromTargetName(engine.rootMC, name);
	if (!mc) {
		return false;
	}
	frame = +(mc.mcInfo.frameLabelMap[(frame + "")] || frame);
	// create action function
	var actions = createActionFunction([
		{code: ActionDefine.TypeActionGotoFrame, frame: frame, offset:0},
		{code: ActionDefine.TypeActionStop, offset: 0}
	]);

	if(sync || typeof(sync) === "undefined") {
		engine.vm.executeAction(mc, actions);
		return true;
	}

	// for backward compatibility
	// add action
	engine.vm.addAction(mc, actions);
 	return true;
};

API.prototype.keyDown = function(key) {
	this.engine.touch.keyDown(key);
};

API.prototype.play = function(name) {
	var engine = this.engine;
	var mc = (name && getMovieClipFromTargetName(engine.rootMC, name)) || engine.rootMC;
	if (!mc) {
		return false;
	}
	mc.isPlaying = true;
	//var actions = createActionFunction([
	//	{code: ActionDefine.TypeActionPlay, offset: 0}
	//]);
	//engine.vm.addAction(mc, actions);
	return true;
};

API.prototype.stop = function(name) {
	var engine = this.engine;
	var mc = (name && getMovieClipFromTargetName(engine.rootMC, name)) || engine.rootMC;
	if (!mc) {
		return false;
	}
	var actions = createActionFunction([
		{code: ActionDefine.TypeActionStop, offset: 0}
	]);
	engine.vm.addAction(mc, actions);
	return true;
};

API.prototype.stopAll = function(name) {
	var engine = this.engine;
	var mc = (name && getMovieClipFromTargetName(engine.rootMC, name)) || engine.rootMC;
	if (!mc) {
		return false;
	}
	
	var stopMC = function(target) {
		var actions = createActionFunction([
			{code: ActionDefine.TypeActionStop, offset: 0}
		]);
		engine.vm.addAction(target, actions);

		var children = target.children;
		var len = children.length;
		for(var i = 0; i < len; i++) {
			stopMC(children[i]);
		}
	};

	stopMC(mc);
	return true;
};

API.prototype.getVariable = function(name, variableName) {
	var engine = this.engine;
	var mc = getMovieClipFromTargetName(engine.rootMC, name);
	if (!mc) {
		return undefined;
	}

	return mc.variables[variableName];
};

API.prototype.getVariables = function(name, variableNames) {
	var mc = getMovieClipFromTargetName(this.engine.rootMC, name);
	if(!mc) {
		return;
	}

	if(!variableNames) {
		return mc.variables;
	} else if(!(variableNames instanceof Array)) {
		EngineLogW("variableNames should be an Array.");
		return;
	}

	var ret = {};
	var variables = mc.variables;
	var len = variableNames.length;
	var variableName;
	for(var i = 0; i < len; i++) {
		variableName = variableNames[i];
		if(variables.hasOwnProperty(variableName)) {
			ret[variableName] = variables[variableName];
		}
	}
	return ret;
};

API.prototype.destroy = function() {
	this.engine.touch.removeAllListeners();
	var master = Master.getInstance();
	return master.removeEngine(this.engine);
};

API.prototype.setVariable = function(name, variableName, value) {
	var engine = this.engine;
	var mc = getMovieClipFromTargetName(engine.rootMC, name);
	if (!mc) {
		return false;
	}

	mc.variables[variableName] = value;
	return true;
};

API.prototype.setVariables = function(name, obj) {
	var mc = getMovieClipFromTargetName(this.engine.rootMC, name);
	if(!mc) {
		return false;
	}

	var variables = mc.variables;
	for(var variableName in obj) {
		variables[variableName] = obj[variableName];
	}
	return true;
};

var getProperty = function(that, name, propertyName) {
	var engine = that.engine;
	var mc = (name && getMovieClipFromTargetName(engine.rootMC, name));
	if (!mc) {
		return void 0;
	}

	return mc.properties[propertyName];
};

API.prototype.getCurrentFrame = function(name) {
	return getProperty(this, (name || "/"), "_currentframe");
};

API.prototype.getTotalFrames = function(name) {
	return getProperty(this, (name || "/"), "_totalframes");
};

API.prototype.getVisible = function(name) {
	return getProperty(this, (name || "/"), "_visible");
};

API.prototype.setVisible = function(name, value) {
	var engine = this.engine;
	var mc = getMovieClipFromTargetName(engine.rootMC, name);
	if (!mc) {
		return false;
	}

	var num = +value;  // convert value to a number
	if(num == 0 || num == 1) {
		mc.setProperty("_visible", num);
		return true;
	} else {
		EngineLogW("Invalid value: " + value);
		return false;
	}
};

API.prototype.setPosition = function(name, x, y) {
	var mc = getMovieClipFromTargetName(this.engine.rootMC, name);
	if (!mc) {
		return false;
	}
	mc.isLocked = true;
	mc.setProperty("_x", (+x) || 0);
	mc.setProperty("_y", (+y) || 0);
	return true;
};

// FIXME: property names will be mangled and this method won't work correctly
API.prototype.setMovieClipProperty = function(name, propName, value) {
	var engine = this.engine;
	var mc = getMovieClipFromTargetName(engine.rootMC, name);
	if (!mc) {
		return false;
	}
	switch(propName) {
	case '_xscale':
		mc.isLocked = true;
		mc.setXScale((+value) || 0);
		break;
	case '_yscale':
		mc.isLocked = true;
		mc.setYScale((+value) || 0);
		break;
	case '_rotation':
		mc.isLocked = true;
		mc.setRotation((+value) || 0);
		break;
	case '_x':
	case '_y':
	case '_alpha':
		mc.isLocked = true;
		mc.setProperty(propName, (+value) || 0);
		break;
	case '_focusrect':
	case '_highquality':
	case '_visible':
		if(value == 0 || value == 1) {
			mc.setProperty(propName, (+value));
		}
		break;
	default:
		return false;
	}
	return true;
};

API.prototype.getMovieClipProperty = function(name, propName) {
	var engine = this.engine;
	var mc = getMovieClipFromTargetName(engine.rootMC, name);
	if (mc) {
		return mc.properties[propName];
	}
};

API.prototype.ready = function(func) {
	if(!this.engine.loadCompleted) {
		this.engine.readyCallbacks.push(func);
	} else {
		func();
	}
};

API.prototype.engineStart = function() {
	this.engine.running = true;
	return true;
};

API.prototype.engineStop = function() {
	this.engine.running = false;
	return true;
};

API.prototype.getMovieClipNames = function(name) {
	var engine = this.engine;
	var mc = (name && getMovieClipFromTargetName(engine.rootMC, name)) || engine.rootMC;
	if (!mc) {
		return null;
	}
	return Object.keys(mc.childrenMap);
};

API.prototype.getFrameLabelMap = function(name) {
	var engine = this.engine;
	var mc = (name && getMovieClipFromTargetName(engine.rootMC, name)) || engine.rootMC;
	if (!mc) {
		return null;
	}
	var map = mc.mcInfo.frameLabelMap;
	var ret = {};
	for(var key in map) {
		ret[key] = map[key];
	}
	return ret;
};

API.prototype._getCacheImageInfo = function() {
	var renderer = this.engine.renderer;
	return renderer && renderer.cachedImageInfo;
};

API.prototype.replaceMovieClip = function(name, image, width, height, keepAspect, xratio, yratio) {
	var engine = this.engine;
	
	var mcList = engine.timelineList;
	for(var i = 0; i < mcList.length; i++) {
		var mc = mcList[i];
		if(mc.properties._name == name) {
			mc.replaceMovieClip(image, width, height, keepAspect, xratio, yratio);
		}
	}
	var replaceList = engine.option.replace || (engine.option.replace = []);
	for(var i = 0; i < replaceList.length; i++) {
		var replace = replaceList[i];
		if(replace.name == name) {
			replace.img = image;
			replace.width = width;
			replace.height = height;
			replace.keepAspect = keepAspect;
			replace.xratio = xratio;
			replace.yratio = yratio;
			return;
		}
	}
	replaceList.push({name: name, img: image, width: width, height: height, keepAspect: keepAspect, xratio: xratio, yratio: yratio});
	return;
};

API.prototype.getRenderingContext = function() {
	return this.engine && this.engine.renderer && this.engine.renderer.ctx;
};

API.prototype._getStatics = function() {
	return {
		_frameCount: this.engine.frameCount,
		renderCount: this.engine.renderCount
	};
};

API.prototype.getMovieClipNamesAtPoint = function(x, y) {
	var movieClipNames = [];
	x *= 20;
	y *= 20;

	var addMovieClipName = function(mc) {
		var bounds = mc.getBounds(mc.getTransformFromRoot());
		if (bounds[0] <= x && x <= bounds[1] && bounds[2] <= y && y <= bounds[3]) {
			movieClipNames.push(mc.absoluteName || "/");
			var children = mc.children;
			var len = children.length;
			for (var i = 0; i < len; i++) {
				addMovieClipName(children[i]);
			}
		}
	};
	addMovieClipName(this.engine.rootMC);

	return movieClipNames;
};

API.prototype.addEventListener = function(eventName, handler, name) {
	switch(eventName.toLowerCase()) {
	case "enterframe":
		var mc = getMovieClipFromTargetName(this.engine.rootMC, name);
		if(!mc) {
			return false;
		}
		var index = mc.onEnterFrames.indexOf(handler);
		if(index !== -1) {
			// handler is already registered
			return false;
		}
		mc.onEnterFrames.push(handler);
		break;
	case "movieclipcreate":
		var engine = this.engine;
		var index = engine.onCreateMC.indexOf(handler);
		if(index !== -1) {
			// handler is already registered
			return false;
		}
		engine.onCreateMC.push(handler);
		break;
	default:
		EngineLogW("Invalid event: " + eventName);
		break;
	}
	return true;
};

API.prototype.removeEventListener = function(eventName, handler, name) {
	switch(eventName.toLowerCase()) {
	case "enterframe":
		var mc = getMovieClipFromTargetName(this.engine.rootMC, name);
		if(!mc) {
			return false;
		}
		var index = mc.onEnterFrames.indexOf(handler);
		if(index === -1) {
			// handler is not registered
			return false;
		}
		mc.onEnterFrames.splice(index, 1);
		break;
	case "movieclipcreate":
		var engine = this.engine;
		var index = engine.onCreateMC.indexOf(handler);
		if(index === -1) {
			// handler is not registered
			return false;
		}
		engine.onCreateMC.splice(index, 1);
		break;
	default:
		EngineLogW("Invalid event: " + eventName);
		break;
	}
	return true;
};

API.prototype.redraw = function() {
	this.engine.renderer.render();
};

API.prototype.getFPS = function() {
	return this.engine.getFPS();
};

API.prototype.setFPS = function(fps) {
	this.engine.setFPS(fps);
};

API.prototype.getFrameSkipRatio = function() {
	return this.engine.getFrameSkipRatio();
};

API.prototype.setFrameSkipRatio = function(ratio) {
	return this.engine.setFrameSkipRatio(ratio);
};

API.prototype.callActions = function(name, frame) {
	var engine = this.engine;
	var mc = getMovieClipFromTargetName(engine.rootMC, name);
	if(!mc) {
		return false;
	}
	frame = +(mc.mcInfo.frameLabelMap[(frame + "")] || frame);
	// create action function
	if(!frame) {
		return false;
	}
	var actions = createActionFunction([
		{code: ActionDefine.TypeActionPush, values: [frame], offset: 0},
		{code: ActionDefine.TypeActionCall, nextOffset: 2, offset: 1},
		{code: 0, offset: 2}  // end
	]);

	engine.vm.executeAction(mc, actions);
	return true;
};

API.prototype.loadMovie = function(name, src, option) {
	var mc = getMovieClipFromTargetName(this.engine.rootMC, name);
	if(!mc) {
		return false;
	}
	mc.loadMovie(name, src, option);
};

API.prototype.showFrame = function(time) {
	var lastFrame = this.engine.lastStopFrame || 0;
	var frame = (1 + time * this.engine.frameRate) | 0;
	console.log(lastFrame, frame, (1 + time * this.engine.frameRate), time, this.engine.frameRate);
	if(lastFrame != frame) {
		this.engine.stopFrame = frame;
		this.engine.tick(Date.now());
	}
	
	return this.engine.rootMC.properties["_currentframe"];
};
