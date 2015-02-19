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


var Engine = function(dataStore, container, option) {
	// store arguments
	this.dataStore = dataStore;
	this.container = (typeof container == "string")? document.getElementById(container): container;
	this.option = copyOption(option);
	
	// create renderer
	this.canvas = null;
	if(option.partialDraw) {
		this.renderer = new DirtyRectRenderer(this);
	} else {
		this.renderer = new Renderer(this);
	}
	
	this.onCreateMC = [];
	this.newMcList = [];

	// create VM
	this.vm = new VM(this);
	
	// hash mapping for objects
	this.dictionary = { "name": "" }; // characterId => def
	// hash mapping for mcInfo
	this.mcInfoLibrary = {}; // characterId -> mcInfo
	// engine setting values
	this.bgColor = null; // null means transparent
	
	// timeline check
	this.timelineList = [];
	// is Engine locked because of lack informations
	this.isLocked = false;
	
	// api
	this.api = null;

	// buttons
	this.buttonList = [];
	
	// touch controller
	this.touch = new _Touch(this);

	// ready callback
	var that = this;
	this.readyCallbacks = [];
	this.readyFunc = function() {
		var callbacks = that.readyCallbacks;
		var len = callbacks.length;
		for(var i = 0; i < len; i++) {
			callbacks[i]();
		}
		that.readyFunc = null;
	};
	
	// control frame skip
	this.noskip = false;
	this.frameSkipRatio = 0;
	this.logicalRenderCount = 0;

	// initializing
	this.initialize();
};

Engine.prototype.initialize = function() {
	var option = this.option;
	var dataStore = this.dataStore;
	// Analyzer setup
	var rootMCInfo = new MovieClipInfo();
	this.analyzser = new Analyzer(this, rootMCInfo, dataStore.tagList);
	// create root movie clip
	this.rootMC = new MovieClip(this, rootMCInfo, null, null);
	this.timelineList.push(this.rootMC);
	// set totalFrames and frameRate
	var header = dataStore.header;
	this.rootMC.properties["_totalframes"] = header.frameCount;
	this.frameRate = option.fps || header.frameRate;
	header.frameSize && this.renderer.setFrame(header.frameSize);
	this.frameCount = 0;
	this.renderCount = 0;
	// don't play if option is set
	this.running = !option.stopOnStart;

	// get rid of "darker" in globalCompositeOperation
	// https://code.google.com/p/chromium/issues/detail?id=136830
	overrideTransformImageColorFunction(option.forceDisableBlendMode, option.debug);
};

Engine.prototype.dataStoreProgress = function() {
	var dataStore = this.dataStore;
	if(dataStore.completed) {
		this.option.debug && EngineLogD("parse completed: " + (Date.now() - Pex.firstTime));
//		console.log("Root MC:", this.rootMC);
		this.loadCompleted = true;
	}
	var header = dataStore.header;
	if(this.rootMC) {
		this.rootMC.properties["_totalframes"] = header.frameCount;
	}
	this.frameRate = this.option.fps || header.frameRate;
	this.analyzser.analyze(this.dictionary);
	header.frameSize && this.renderer.setFrame(header.frameSize);
	this.renderer.preloadCache && this.renderer.preloadCache();
};

Engine.prototype.tick = function(now) {
	var currentFrame = this.frameCount;
	var endFrame;
	if(!this.stopFrame) {
		if (this.startTime) {
			endFrame = (this.frameRate * (now - this.startTime) / 1000) | 0;
			if(this.frameSkipRatio) {
				var logicalRenderCount = (endFrame * (1 - this.frameSkipRatio)) | 0;
				if(logicalRenderCount <= this.logicalRenderCount) {
					return;
				}
				this.logicalRenderCount = logicalRenderCount;
			}
		} else {
			this.startTime = now;
			endFrame = 1;
		}
	} else {
		endFrame = Number.MAX_VALUE;
	}

	if(currentFrame == endFrame || this.dataStore.loadingImageCount > 0) {
		return;
	}

	this.readyFunc && this.loadCompleted && this.readyFunc();

	if(!this.stopFrame) {
		if(!this.running) {
			return;
		}

		if (currentFrame <= 1 || (this.option.disableFrameSkip && endFrame - currentFrame > 1) || endFrame - currentFrame > 30) {
			// the first frame (currentFrame is 0) is very heavy due to initializing objects,
			// so modify startTime in the second frame (currentFrame is 1).
			// The OS seems to have been slept if the gap between endFrame and currentFrame is too large,
			// so modify startTime.
			endFrame = currentFrame + 1;
			this.startTime = now - currentFrame / this.frameRate * 1000;
		}
	}

	var rendered = false;
	var acted = false;
	var enterFrameMCs = [];
	while (currentFrame < endFrame) {
		currentFrame++;
		var timelinePos;
		if(!this.vm.running) {
			if(this.isLocked) {
				// resume the last session
				timelinePos = this.timelinePos;
			} else {
				// play all timeline
				timelinePos = this.timelineList.length - 1;
			}

			for(var i = timelinePos; i >= 0; i--) {
				var mc = this.timelineList[i];
				if(mc.isPlaying) {
					var nextFrame = 1;
					if(mc.properties._currentframe < mc.properties["_totalframes"]) {
						nextFrame = mc.properties._currentframe + 1;
					}
					if(!this.gotoFrame(mc, nextFrame)) {
						// gotoFrame failed because try to go to non-loaded frame
						this.option.debug && EngineLogD("gotoFrame: try to go to non-loading frame at mclist");
						// so lock this engine until loading the frame
						this.isLocked = true;
						this.timelinePos = i;
						return false;
					}
				}
				if(mc.onEnterFrames.length) {
					enterFrameMCs.push(mc);
				}
			}
			// complete timeline

			// call onEnterFrame
			var mcCount = enterFrameMCs.length;
			for(var i = 0; i < mcCount; i++) {
				var mc = enterFrameMCs[i];
				var name = mc.absoluteName || "/";
				var currentframe = mc.properties._currentframe;
				var onEnterFrames = mc.onEnterFrames;
				var enterFrameCount = onEnterFrames.length;
				for(var j = 0; j < enterFrameCount; j++) {
					onEnterFrames[j](this.api, name, currentframe);
				}
			}
			enterFrameMCs = [];
		}
		// execute virtual machine
		if(!this.vm.run()) {
			// vm failed because try to go to non-loaded frame
			this.option.debug && EngineLogD("gotoFrame: try to go to non-loading frame inside VM");
			return false;
		}

		// buttons should be handled after executing virtual machine
		// because it changes the visibility or shape of buttons
		if(this.option.enableButton && this.handleButton()) {
			if(!this.vm.run()) {
				// vm failed because try to go to non-loaded frame
				this.option.debug && EngineLogD("gotoFrame: try to go to non-loading frame inside VM");
				return false;
			}
		}

		if(this.onCreateMC.length) {
			var onCreateMC = this.onCreateMC;
			var handlerCount = onCreateMC.length;
			var mcList = this.newMcList;
			var mcCount = mcList.length;
			for(var i = 0; i < mcCount; i++) {
				var name = mcList[i].absoluteName || "/";
				for(var j = 0; j < handlerCount; j++) {
					onCreateMC[j](this.api, name);
				}
			}
		}
		this.newMcList = [];

		// complete tick
		this.isLocked = false;
		acted = true;

		if(this.noskip) {
			this.option.debug && EngineLogD("noskip frame and force rendering");
			this.renderer.render();
			rendered = true;
			this.noskip = false;
		}
		if(this.stopFrame) {
			var current = this.rootMC.properties["_currentframe"];
			var stop = this.stopFrame % (this.rootMC.properties["_totalframes"]);
			if(stop == 0) {
				stop = this.rootMC.properties["_totalframes"];
			}
			if(current == stop) {
				this.lastStopFrame = this.stopFrame;
				this.stopFrame = 0;
				break;
			}
		}
	}
	this.frameCount = currentFrame;
	if(!rendered) {
		this.renderer.render();
	}
	acted && this.renderCount++;
	//console.log("---------------------");
	return true;
};

Engine.prototype.handleButton = function() {
	var actionAdded = false;
	var buttonList = this.buttonList;
	for(var i = buttonList.length - 1; i >= 0; i--) {
		var button = buttonList[i];
		var buttonInfo = button.mcInfo;
		if(button.isDeleted) {
			continue;
		}

		// Are movieclips of button ancestor displayed?
/*
		var parent = button;
		while(parent) {
			if(!parent.isDisplayed()) {
				break;
			}
			parent = parent.parent;
		}
		if(parent) {
			continue;
		}
*/

		var executed = false;
		for(var key in buttonInfo.buttonActionMap) {
			if(this.touch.isKeyDown(key) && button.isDisplayed(true)) {
				this.vm.addAction(button.parent, buttonInfo.buttonActionMap[key]);
				//TODO unshift!!
				//original this.actionQueue.unshift([button.parent, button.buttonActions[key]]);
				executed = true;
				break;
			} else if(key == "press" && this.touch.mouseDown) {
				// check if the key is pressed or not
				if(button.isHit(this.touch.mouseDown.x, this.touch.mouseDown.y)) {
					// if unshift his, city_dev_f2 will not work properly
					this.vm.addAction(button.parent, buttonInfo.buttonActionMap[key]);
					executed = true;
					break;
				}
			} else if(key == "release" && this.touch.mouseRelease) {
				// check if the key is released or not
				if(button.isHit(this.touch.mouseRelease.x, this.touch.mouseRelease.y)) {
					this.vm.addAction(button.parent, buttonInfo.buttonActionMap[key]);
					executed = true;
					break;
				}
			}
		}
		if (executed) {
			actionAdded = true;
			break;
		}
	}
	this.touch.clearKeyDown();
	this.touch.clearMouseState();
	return actionAdded;
};

Engine.prototype.gotoFrame = function(mc, toFrame, privilege) {
	//console.log("[" + mc.absoluteName + "]", "gotoFrame:", toFrame, "current: " + mc.properties["_currentframe"], "loaded:" + mc.properties["_framesloaded"], "total:" + mc.properties["_totalframes"]);
	toFrame = +toFrame;
	var currentFrame = mc.properties["_currentframe"];
	
	toFrame = (toFrame < 1)? 1: toFrame;
	var doAction = true;
	if(toFrame > mc.properties["_totalframes"]) {
		toFrame = mc.properties["_totalframes"];
		doAction = false;
	}
	// try to go to same frame
	if(mc.isDeleted || toFrame === currentFrame) {
		return true;
	}
	
	// check whether the frame is loaded
	if(toFrame > mc.properties["_framesloaded"]) {
		// try to call non-loaded frame
		return false;
	}
	
	var next = false;
	if(toFrame == currentFrame + 1) {
		// use cache
		next = true;
	}
	
	var mcInfo = mc.mcInfo;
	
	// set property for mc
	mc.properties["_currentframe"] = toFrame;
	
	// search action list
	var actionFunc = mcInfo.frameActionMap[toFrame];
	if(doAction && actionFunc) {
		var len = actionFunc.length;
		for(var i = 0; i < len; i++) {
			this.vm.addAction(mc, actionFunc[i]);
		}
	}
	
	if(next) {
		// remove old objects
		var deadIdList = mcInfo.frameDeadIdList[toFrame];
		var len = deadIdList.length;
		for(var i = 0; i < len; i++) {
			mc.removeObject(deadIdList[i]);
		}
		var bornIdList = mcInfo.frameBornIdList[toFrame];
		var blen = bornIdList.length;
		// create new objects
		for(var i = 0; i < blen; i++) {
			mc.createObject(toFrame, bornIdList[i]);
		}

		// check modification
		var idModifiedMap = mcInfo.frameIdModifiedMap[toFrame];
		var changed = false;
		for(var i in idModifiedMap) {
			if(idModifiedMap[i]) {
				changed = true;	

				var child = mc.childrenIdMap[i];
				var matrix = mcInfo.frameIdPlacementMap[toFrame][i].matrix;
				if(child && !child.isLocked && matrix) {
					child.setPropertiesFromMatrix(matrix)
				}
			}
		}
		if(changed) {
			mc.lastModified = this.frameCount;
		}
		
	} else {
		// currentList and toList are sorted already
		var currentList = mcInfo.frameIdList[currentFrame];
		var currentLen = currentList.length;
		var toList = mcInfo.frameIdList[toFrame];
		var toLen = toList.length;
		var i = 0, j = 0;
		var bornIdList = [];
		var survivedIdList = [];

		// listup all deleted ids and new created ids
		while(i < toLen && j < currentLen) {
			var t = toList[i];
			var c = currentList[j];
			if(t === c) {
				survivedIdList[survivedIdList.length] = t;
				i++;
				j++;
			} else if(t < c) {
				// born at toFrame
				// check the object is born on this frame or on previous frame
				// if created on previous frame, set privilege mode
				bornIdList[bornIdList.length] = t;
				//mc.createObject(toFrame, t, mcInfo.idInfo[t].born != toFrame);
				i++;
			} else {
				// remove at toFrame
				mc.removeObject(c);
				j++;
			}
		}
		if(i != toLen) {
			while(i < toLen) {
				bornIdList.push(toList[i++]);
				//mc.createObject(toFrame, id, mcInfo.idInfo[id].born != toFrame);
			}
		} else if(j != currentLen) {
			while(j < currentLen) {
				mc.removeObject(currentList[j++]);
			}
		}
		var len = bornIdList.length;
		for(var i = 0; i < len; i++) {
			var id = bornIdList[i];
			mc.createObject(toFrame, id, mcInfo.idInfo[id].born != toFrame);
		}

		mc.lastModified = this.frameCount;

		len = survivedIdList.length;
		for(var i = 0; i < len; i++) {
			var id = survivedIdList[i];
			var child = mc.childrenIdMap[id];
			var matrix = mcInfo.frameIdPlacementMap[toFrame][id].matrix;
			if(child && !child.isLocked && matrix) {
				child.setPropertiesFromMatrix(matrix)
			}
		}
	}
	
	// process frameCallback
	var all_callbacks = this.option.frameCallback;
	var mc_callbacks = all_callbacks[mc.properties._name];
	if(!mc_callbacks) {
		mc_callbacks = all_callbacks[mc.absoluteName === "" ? "/" : mc.absoluteName];
	}
	if(mc_callbacks) {
		var labelMap = mcInfo.frameLabelMap;
		for(var key in labelMap) {
			if(toFrame == labelMap[key] && mc_callbacks[key]) {
				mc_callbacks[key](this);
			}
		}
		var callback = mc_callbacks[toFrame] || (toFrame == mc.properties["_totalframes"] && mc_callbacks["last"]);
		callback && callback(this);
	}

	if(mcInfo.noskipFrameList[toFrame]) {
		this.noskip = true;
	}

	return true;
};

Engine.prototype.getAPI = function() {
	return this.api || (this.api = new API(this));
};

Engine.prototype.getFPS = function() {
	return this.frameRate;
};

Engine.prototype.setFPS = function(fps) {
	// the next frame is calculated by 'this.frameRate * (Date.now() - this.startTime) / 1000',
	// so reset `this.startTime` if `this.startTime` is already set
	this.startTime && (this.startTime = Date.now() - this.frameCount / fps * 1000);
	this.frameRate = this.option.fps = fps;
};

Engine.prototype.getFrameSkipRatio = function() {
	return this.frameSkipRatio;
};

Engine.prototype.setFrameSkipRatio = function(ratio) {
	this.logicalRenderCount = (this.frameRate * (Date.now() - this.startTime) * (1 - ratio) / 1000) | 0;
	this.frameSkipRatio = ratio;
	return true;
};

var copyOption = function(option) {
	var clone = function(src, dst) {
		for(var prop in src) {
			var value = src[prop];
			if(value instanceof HTMLElement || value instanceof Function) {
				// e.g. HTMLImageElement for 'replace' option, function for 'frameCallback' option
				dst[prop] = value;
			} else if(value instanceof Array) {
				dst[prop] = [];
				clone(value, dst[prop]);
			} else if(value instanceof Object) {
				dst[prop] = {};
				clone(value, dst[prop]);
			} else {
				dst[prop] = value;
			}
		}
	};

	var newOption = {};
	clone(option, newOption);
	return newOption;
};
