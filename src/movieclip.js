var MovieClip = function(engine, mcInfo, parent, placement, exceptional) {
	this.engine = engine;
	// Movie Clip Information
	this.mcInfo = mcInfo;
	mcInfo.onupdate = (function(that) { return function() { that.mcInfoUpdateCallback.apply(that, arguments); };})(this);
	// Display List
	this.displayList = {}; // layer -> mcInfo.idInfo
	this.displayListCount = {};
	// Properties
	this.properties = {
		_x: 0,
		_y: 0,
		_currentframe: 0,
		_totalframes: mcInfo.framesLoaded,
		_alpha: 100,
		_visible: 1,
		_width: 0,
		_height: 0,
		_target: null,
		_framesloaded: mcInfo.framesLoaded,
		_name: null,
		_droptarget: null,
		_url: null,
		_highquality: 1,
		_focusrect: 0,
		_xscale: 100,
		_yscale: 100,
		_rotation: 0,
		_rotation2: 90, // hidden param
		// transform
		_scaleX: 1,
		_scaleY: 1,
		_rotate0: 0,
		_rotate1: 0
	};
	// variables
	this.variables = {};
	
	// is this MC locked by property settings or not
	this.isLocked = false;
	
	// playing or not
	this.isPlaying = true;
	// cloned by CloneSprite or not 
	this.isCloned = false;
	// button or not
	this.isButton = false;
	// is deleted or not
	this.isDeleted = false;
	
	// parent
	this.parent = parent;
	// children
	this.children = [];
	this.childrenMap = {}; // name -> [mc, mc...]
	this.childrenIdMap = {}; // id -> mc
	// for force naming
	this.instanceNum = 0;

	// last modified frame
	this.lastModified = 0;
	this.childrenModified = { checked: -1, modified: true };
	
	this.initProperties(placement);

	// absolute name
	this.absoluteName = ((parent)?parent.absoluteName + "/" + this.properties._name : "");
	this.id = null;

	this.onEnterFrames = [];
	if(exceptional) {
		// mark this mc is exceptional mc
		this.exception = true;
	} else {
		this.engine.newMcList.push(this);
	}

	// for loadMovie
	this.dictionary = parent && parent.dictionary || engine.dictionary;
	this.mcInfoLibrary = parent && parent.mcInfoLibrary || engine.mcInfoLibrary;
};

MovieClip.prototype.mcInfoUpdateCallback = function() {
	this.properties["_framesloaded"] = this.mcInfo.framesLoaded;
	if(this.mcInfo.actualTotalFrames) this.properties["_totalframes"] = this.mcInfo.actualTotalFrames;
};

MovieClip.prototype.initProperties = function(placement) {
	var parent = this.parent;
	if(placement) {
		if(placement.name) {
			this.properties._name = placement.name;
		} else {
			// force naming
			if(parent) {
				this.properties._name = "instance" + (++parent.instanceNum);
			} else {
				this.properties._name = "instance1";
			}
		}

		this.setPropertiesFromMatrix(placement.matrix);
	}
	if(parent) {
		parent.children.push(this);
		var name = this.properties._name;
		(parent.childrenMap[name] && parent.childrenMap[name].push(this)) || (parent.childrenMap[name] = [this]);
	}
};

var createImageContainerMC = function(dictionary, img, width, height, sx, sy, xratio, yratio) {
	var ret = {};
	// convert px to twip
	width *= 20;
	height *= 20;
	var dx = xratio? width * xratio: 0;
	var dy = yratio? height * yratio: 0;

	var characterId = generateCharacterId(dictionary);
	
	
	// create image tag
	dictionary[characterId] = {
		"type": TagDefine.TypeTagDefineBitsJPEG2,
		"id": characterId,
		"img": img
	};
	characterId++;
	
	// create shape tag
	ret.shapeId = characterId;
	dictionary[ret.shapeId] = {
		"type": TagDefine.TypeTagDefineShape,
		"id": ret.shapeId,
		"bounds": [-dx, width - dx, -dy, height - dy],
		"fillStyles": [
			{ "type": 65, "bitmapId": ret.shapeId - 1, "matrix": [20, 0, 0, 20, -dx / 20, -dy / 20] }
		],
		"lineStyles": [],
		"shapes": [
			{ "type": 2, "dx": width - dx, "dy": height - dy, "fillStyle1": 1 },
			{ "type": 0, "x": -width, "y": 0 },
			{ "type": 0, "x": 0, "y": -height },
			{ "type": 0, "x": width, "y": 0 },
			{ "type": 0, "x": 0, "y": height }
		]
	};
	characterId++;
	
	// create container mc
	ret.containerId = characterId;
	dictionary[ret.containerId] = {
		"type": TagDefine.TypeTagDefineSprite,
		"id": ret.containerId,
		"frameCount": 1,
		"tags": [
			{
				"type": TagDefine.TypeTagPlaceObject2,
				"characterId": ret.shapeId,
				"depth": 1,
				"move": 0,
				"matrix": [sx, 0, 0, sy, 0, 0]
			},
			{ "type": TagDefine.TypeTagShowFrame },
			{ "type": TagDefine.TypeTagEnd }
		]
	};
	
	// placeobject tag for container mc
	ret.placement = {
		"type": TagDefine.TypeTagPlaceObject2,
		"characterId": ret.containerId,
		"depth": 1,
		"matrix": [1, 0, 0, 1, 0, 0],
		"move": 0
	};
	return ret;
};

MovieClip.prototype.replaceMovieClip = function(img, dw, dh, keepAspect, xratio, yratio) {
	// get details
	var width = img.width;
	var height = img.height;
	if(!width || !height) {
		EngineLogW("[MovieClip#replaceMovieClip] Unable to replace because image might not be loaded.");
		return false;
	}
	
	var sx = dw? (dw / width): 1;
	var sy = dh? (dh / height): 1;
	if(keepAspect) {
		sy = sx = Math.min(sx, sy);
	}
	
	// delete all current display list
	this._resetDisplayList();
	
	// stop on current frame
	this.isPlaying = false;

	var info = createImageContainerMC(this.dictionary, img, width, height, sx, sy, xratio, yratio);
	
	// save the information in idinfo
	var parentMcInfo = this.parent.mcInfo;
	parentMcInfo.idCounter++;
	var newId = parentMcInfo.idCounter;
	var idInfo = {};
	var frame = this.properties._currentframe;
	idInfo.id = newId;
	idInfo.characterId = info.containerId;
	idInfo.layer = 1;
	idInfo.born = frame;
	idInfo.placement = info.placement;
	idInfo.ownerMC = {};
	this.mcInfo.idInfo[newId] = idInfo;
	
	// regsiter placement on frame-id-placement map
	for(var i = 1; i <= this.properties._totalframes; i++) {
		this.mcInfo.frameIdPlacementMap[i][newId] = info.placement;
	}
	
	// create the container mc
	this.createObject(this.frame, newId);
	return true;
};

MovieClip.prototype.clone = function(newName, depth) {
	var parent = this.parent;
	var parentMcInfo = parent.mcInfo;
	var idInfo = parent.mcInfo.idInfo[this.id];

	// clone idInfo and set new values
	var id = idInfo.id;
	parentMcInfo.idCounter++;
	var newId = parentMcInfo.idCounter;
	var newPlacement = clone(idInfo.placement);
	newPlacement.name = newName;
	var newIdInfo = clone(idInfo);
	newIdInfo.placement = newPlacement;
	newIdInfo.id = newId;
	newIdInfo.layer = depth;

	parent.mcInfo.idInfo[newId] = newIdInfo;
	parent.createObject(null, newId);

	// clone MovieClip and set new values
	var newMC = parent.childrenIdMap[newId];
	var properties = newMC.properties;
	var name = properties._name;
	properties = clone(this.properties);
	properties._name = name;
	properties._currentframe = 1;
	newMC.isCloned = true;
	newMC.lastModified = this.engine.frameCount;

	// add the information of the cloned MovieClip to mcInfo
	var frameIdPlacementMap = parentMcInfo.frameIdPlacementMap;
	var frameLength = frameIdPlacementMap.length;
	var startFrame = 0;
	var targetFrame = 0;
	for(var currentFrame = 1; currentFrame < frameLength; currentFrame++) {
		if(frameIdPlacementMap[currentFrame] && frameIdPlacementMap[currentFrame][id]) {
			if(startFrame == 0) {
				startFrame = currentFrame;
			}
			targetFrame = currentFrame - startFrame + 1;
			frameIdPlacementMap[targetFrame][newId] = clone(frameIdPlacementMap[currentFrame][id]);
			frameIdPlacementMap[targetFrame][newId].name = newName;
		} else if(startFrame > 0) {
			// repeat frames
			targetFrame = currentFrame - startFrame + 1;
			var cycleLength = currentFrame - startFrame;
			while(targetFrame < frameLength) {
				frameIdPlacementMap[targetFrame][newId] = frameIdPlacementMap[targetFrame - cycleLength][newId];
				targetFrame++;
			}
			break;
		}
	}

	return newMC;
};

MovieClip.prototype.createObject = function(frame, id, privilege) {
	var dictionary = this.dictionary;
	var option = this.engine.option;
	var idInfo = this.mcInfo.idInfo[id];
	var characterId = idInfo.characterId;
	var obj = dictionary[characterId];
	var layer = idInfo.layer;
	
	this.lastModified = this.engine.frameCount;
	if (this.displayList[layer]) {
		var count = this.displayListCount[layer] || 0;
		++count;
		layer = layer + "." + ("000" + count).slice(-4);
		idInfo.layer = layer;
		this.displayListCount[layer] = count;
	}
	this.displayList[layer] = idInfo;
	
	var isButton = false;
	switch(obj.type) {
	case TagDefine.TypeTagDefineButton:
	case TagDefine.TypeTagDefineButton2:
		isButton = true;
		/* no brake */
	case TagDefine.TypeTagDefineSprite:
		// create new Movie Clip
		var placement = idInfo.placement;
		var engine = this.engine;
		var mcInfoLibrary = this.mcInfoLibrary;
		var mcInfo = mcInfoLibrary[characterId];
		if(!mcInfo) {
			mcInfo = new MovieClipInfo();
			var analyzer = new Analyzer(engine, mcInfo, obj.tags, obj.characters, obj.actions);
			analyzer.analyze(dictionary);
			mcInfoLibrary[characterId] = mcInfo;
		}
		var mc = new MovieClip(engine, mcInfo, this, placement);
		idInfo.ownerMC[id] = mc;
		if(isButton) {
			mc.isPlaying = false;
			mc.isButton = true;
			this.engine.buttonList.push(mc);
		}
		// register new mc
		engine.timelineList.push(mc);
		var r = engine.gotoFrame(mc, 1, false); // immediately go first frame
		// register mc
		mc.id = id;
		this.childrenIdMap[id] = mc;
		// replace img
		if(option.replace && placement.name) {
			var replaceInfoList = option.replace;
			var len = replaceInfoList.length;
			for(var i = 0; i < len; i++) {
				var replaceInfo = replaceInfoList[i];
				if(placement.name == replaceInfo.name) {
					mc.replaceMovieClip(replaceInfo.img, replaceInfo.width, replaceInfo.height, replaceInfo.keepAspect, replaceInfo.xratio, replaceInfo.yratio);
				}
			}
		}
		break;
	case TagDefine.TypeTagDefineEditText:
		// change initial text
		// change initial text
		var def = dictionary[obj.id];
		var ret = getMovieClipAndTextFromSyntax(this, def.variableName);
		var container = ret[0];
		var vname = ret[1];

		if(container) {
			if(typeof(container.variables[vname]) == "undefined") {
				if(vname) {
					container.variables[vname] = def.initialText;
				}
			} else {
				def.initialText = container.variables[vname] + "";
			}
		} else {
			this.engine.option.debug && EngineLogD("[DefineEditText:variableName] unable to access: " + def.variableName);
		}
		break;
	}
};
MovieClip.prototype.removeObject = function(id) {
	var idInfo = this.mcInfo.idInfo[id];
	var characterId = idInfo.characterId;
	var layer = idInfo.layer;
	
	this.lastModified = this.engine.frameCount;

	// remove from display list
	delete this.displayList[layer];
	
	// if object is mc, remove recursively
	var childrenIdMap = this.childrenIdMap;
	var mc = childrenIdMap[id];
	delete childrenIdMap[id];
	mc && this.removeChildMC(mc);
};

MovieClip.prototype.removeChildMC = function(mc, removeAll) {
	mc.lastModified = this.engine.frameCount;

	// remove child
	if(!removeAll) {
		var parent = mc.parent;
		parent.lastModified = this.engine.frameCount;
		var children = parent.children;
		var len = children.length;
		for(var i = 0; i < len; i++) {
			if(mc == children[i]) {
				children.splice(i, 1);
				break;
			}
		}
		var childrenMap = parent.childrenMap[mc.properties._name];
		var len = childrenMap.length;
		for(var i = 0; i < len; i++) {
			if(mc == childrenMap[i]) {
				childrenMap.splice(i, 1);
				if(childrenMap.length == 0) {
					delete parent.childrenMap[mc.properties._name];
				}
				break;
			}
		}
	}
	// call remove recursively
	var children = mc.children;
	var len = mc.children.length;
	for(var i = 0; i < len; i++) {
		mc.removeChildMC(children[i], true);
	}
	// remove from timeline
	var timelineList = this.engine.timelineList;
	var len = timelineList.length;
	for(var i = 0; i < len; i++) {
		var tl = timelineList[i];
		if(tl == mc) {
			timelineList.splice(i, 1);
			break;
		}
	}
	var buttonList = this.engine.buttonList;
	var len = buttonList.length;
	for(var i = 0; i < len; i++) {
		var button = buttonList[i];
		if(button == mc) {
			buttonList.splice(i, 1);
			break;
		}
	}
	// set deleted flag
	mc.isDeleted = true;
};

MovieClip.prototype.findChild = function(name) {
	var childrenMap = this.childrenMap;
	var list = childrenMap[name];
	if(list && list[0]) {
		return list[0];
	} else {
		// try case insensitive match if mc is not found
		name = name.toLowerCase();
		for(var childName in childrenMap) {
			if(childName.toLowerCase() == name) {
				return childrenMap[childName][0];
			}
		}
	}
	return null;
};

MovieClip.prototype.calcScaleAndRotation = function() {
	this.lastModified = this.engine.frameCount;
	var prop = this.properties;
	prop._xscale = Math.sqrt(prop._scaleX * prop._scaleX + prop._rotate0 * prop._rotate0) * 100;
	prop._yscale = Math.sqrt(prop._scaleY * prop._scaleY + prop._rotate1 * prop._rotate1) * 100;
	prop._rotation = Math.atan2(prop._rotate0, prop._scaleX) * 180 / Math.PI;
	prop._rotation2 = Math.atan2(prop._scaleY, prop._rotate1) * 180 / Math.PI;
};

MovieClip.prototype.getMatrix = function() {
	var prop = this.properties;
	return [prop._scaleX, prop._rotate0, prop._rotate1, prop._scaleY, prop._x, prop._y];
};

MovieClip.prototype.setRotation = function(value) {
	var prop = this.properties;
	var rad = (value - prop._rotation) / 180 * Math.PI;
	var c = Math.cos(rad);
	var s = Math.sin(rad);
	
	var t = [c, s, -s, c, 0, 0];
	var t1 = transformXY(t, prop._scaleX, prop._rotate0);
	var t2 = transformXY(t, prop._rotate1, prop._scaleY);
	
	prop._scaleX = t1[0];
	prop._rotate0 = t1[1];
	prop._rotate1 = t2[0];
	prop._scaleY = t2[1];
	
	this.calcScaleAndRotation();
};
MovieClip.prototype.setXScale = function(value) {
	this.lastModified = this.engine.frameCount;
	var prop = this.properties;
	var current = prop._xscale;

	if(current != 0) {
		var rate = value / current;
		prop._scaleX *= rate;
		prop._rotate0 *= rate;
		
		if(value == 0) {
			prop._rotation = adjustRotation(prop._rotation);
		} else if(value < 0) {
			// If scale is negative, rotation turns 180 degrees
			prop._rotation = Math.atan2(prop._rotate0, prop._scaleX) * 180 / Math.PI;
		}
	} else {
		var rad = prop._rotation / 180 * Math.PI;
		prop._scaleX = value / 100 * Math.cos(rad);
		prop._rotate0 = value / 100 * Math.sin(rad);
	}
	// Because of calculation error of floating point, xscale and this value don't correspond.  Calculate again.
	prop._xscale = Math.sqrt(prop._scaleX * prop._scaleX + prop._rotate0 * prop._rotate0) * 100;
};
MovieClip.prototype.setYScale = function(value) {
	this.lastModified = this.engine.frameCount;
	var prop = this.properties;
	var current = prop._yscale;
	
	if(current != 0) {
		var rate = value / current;
		prop._scaleY *= rate;
		prop._rotate1 *= rate;

		if(value == 0) {
			prop._rotation2 = adjustRotation(prop._rotation2);
		} else if(value < 0) {
			// if negative, turns 180 deg
			prop._rotation2 = Math.atan2(prop._scaleY, prop._rotate1) * 180 / Math.PI;
		}
	} else {
		var rad = prop._rotation2 / 180 * Math.PI;
		prop._scaleY = value / 100 * Math.cos(rad);
		prop._rotate1 = value / 100 * Math.sin(rad);
	}
	prop._yscale = Math.sqrt(prop._scaleY * prop._scaleY + prop._rotate1 * prop._rotate1) * 100;
};

MovieClip.prototype.setProperty = function(name, value) {
	this.lastModified = this.engine.frameCount;
	this.properties[name] = value;
};

MovieClip.prototype.setPropertiesFromMatrix = function(matrix) {
	this.properties._scaleX = matrix[0];
	this.properties._rotate0 = matrix[1];
	this.properties._rotate1 = matrix[2];
	this.properties._scaleY = matrix[3];
	this.properties._x = matrix[4];
	this.properties._y = matrix[5];

	this.calcScaleAndRotation();
};

MovieClip.prototype.getTransformFromRoot = function() {
	var parent = this.parent;
	if(this.parent) {
		var matrix = this.isLocked? this.getMatrix(): parent.mcInfo.frameIdPlacementMap[parent.properties._currentframe][this.id].matrix;
		return mulTransform(parent.getTransformFromRoot(), matrix || [1,0,0,1,0,0]);
	} else {
		return this.engine.rootTransform || [1,0,0,1,0,0];
	}
};

MovieClip.prototype.isDisplayed = function(recursive) {
	if(recursive) {
		var mc = this;
		while(mc) {
			if(!mc.isDisplayed()) {
				return false;
			}
			mc = mc.parent;
		}
		return true;
	}
	var properties = this.properties;
	return properties._visible - 0 && properties._xscale > 0 && properties._yscale > 0;
};

MovieClip.prototype.getBounds = function(transform) {
	var displayList = this.displayList;

	// TODO We should check hitState(frame=4) instead of displayed objects on button hit detection.
	// But it's difficult to find undisplayed objects on current implementation.
	var frame = this.properties._currentframe;

	var ret = [Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE]; // left, right, top, bottom\

	for(var layer in displayList) {
		var idInfo = displayList[layer];
		var id = idInfo.id;
		var placement = this.mcInfo.frameIdPlacementMap[frame][id];

		var child = this.childrenIdMap[id];
		var currentLayerBounds;
		if(child) {
			var childTransform = child.isLocked? child.getMatrix(): placement.matrix;
			currentLayerBounds = child.getBounds(childTransform);
		} else {
			var def = this.dictionary[idInfo.characterId];
			var bounds = def.bounds;
			if(bounds) {
				currentLayerBounds = placement.matrix? transformRect(placement.matrix, bounds): bounds;
			} else {
				EngineLogE("bounds not found");
			}
		}
		if(currentLayerBounds[0] < ret[0]) {
			ret[0] = currentLayerBounds[0];
		}
		if(currentLayerBounds[1] > ret[1]) {
			ret[1] = currentLayerBounds[1];
		}
		if(currentLayerBounds[2] < ret[2]) {
			ret[2] = currentLayerBounds[2];
		}
		if(currentLayerBounds[3] > ret[3]) {
			ret[3] = currentLayerBounds[3];
		}

	}

	if(Object.keys(displayList).length == 0) {
		ret = [0,0,0,0];
	}

	// Argument 'transform' is transform from base movie clip to this one. If not passed, search by myself.
	if(!transform) {
		if(this.isLocked) {
			transform = this.getMatrix();
		} else {
			var parent = this.parent;
			if(parent) {
				var parentFrame = parent.properties._currentframe;
				transform = parent.mcInfo.frameIdPlacementMap[parentFrame][this.id].matrix;
			} else {
				transform = [1, 0, 0, 1, 0, 0];
			}
		}
	}
	return transformRect(transform, ret);
};

MovieClip.prototype.isHit = function(x, y) {
	var mc = this;
	while(mc) {
		if(!mc.isDisplayed()) {
			return false;
		}
		mc = mc.parent;
	}
	x *= 20;
	y *= 20;
	var bounds = this.getBounds(this.getTransformFromRoot());
	return bounds[0] <= x && x <= bounds[1]	&& bounds[2] <= y && y <= bounds[3];
};

var adjustRotation = function(r) {
	while(r > 180) {
		r -= 360;
	}
	while(r <= -180) {
		r += 360;
	}

	if(r <= -150) {
		return(180);
	} else if(r <= -120) {
		return(-135);
	} else if(r <= -60) {
		return(-90);
	} else if(r <= -30) {
		return(-45);
	} else if(r <= 30) {
		return(0);
	} else if(r <= 60) {
		return(45);
	} else if(r <= 120) {
		return(90);
	} else if(r <= 150) {
		return(135);
	} else {
		return(180);
	}
};

MovieClip.prototype.isModifiedSince = function(frameCount) {
	var lastModified = this.lastModified;
	if(lastModified >= frameCount) {
		return true;
	}
	if(this.isChildrenModifiedSince(frameCount)) {
		return true;
	}
	var mc = this.parent;
	while(mc) {
		if(mc.lastModified >= frameCount) {
			return true;
		}
		mc = mc.parent;
	}
	return false;
};

MovieClip.prototype.isChildrenModifiedSince = function(frameCount) {
	if(this.childrenModified.checked == this.engine.frameCount) {
		return this.childrenModified.modified;
	} else {
		this.childrenModified.checked = this.engine.frameCount;
		var displayList = this.displayList;
		var dictionary = this.dictionary;
		for(var layer in displayList) {
			var idInfo = displayList[layer];
			
			// check MC
			var childMC = this.childrenIdMap[idInfo.id];
			if(childMC && childMC.isModifiedSince(frameCount)) {
				this.childrenModified.modified = true;
				return true;
			}

			// check text
			if(dictionary[idInfo.placement.characterId].type == 37) { // text
				this.childrenModified.modified = true;
				return true;
			}
		}
		this.childrenModified.modified = false;
		return false;
	}
};

MovieClip.prototype.loadMovie = function(name, src, option) {
	var dataStore;
	var analyzer;
	var that = this;
	var onProgress = function() {
		analyzer.analyze(dictionary);  // parse partially
		if(!dataStore.completed) {
			return;
		}
		if(dataStore.loadingImageCount > 0) {
			// dataStore.loadingImageCount can be greater than 0 incidentally
			// so call onProgress again
			// Otherwise, the movie won't start
			setTimeout(onProgress, 0);
			return;
		}

		that.dictionary = dictionary;
		that.mcInfoLibrary = mcInfoLibrary;

		var rect = dataStore.header.frameSize;
		var originalWidth = (rect[1] - rect[0]) / 20;
		var originalHeight = (rect[3] - rect[2]) / 20;
		var width = option.width || originalWidth;
		var height = option.height || originalHeight;
		var scaleX = width / originalWidth;
		var scaleY = height / originalHeight;
		var tx = -width * option.xratio || 0;
		var ty = -height * option.yratio || 0;

		that._startMovie(characterId, dataStore.tagList, scaleX, scaleY, tx, ty, option.name, option.onready);
	};

	// define new dictionary and mcInfoLibrary for the movie.
	// these should be set to this movieclip after the movie is loaded
	var dictionary = { "name": this.absoluteName };
	var mcInfoLibrary = {};
	var characterId = generateCharacterId(dictionary);
	var mcInfo = mcInfoLibrary[characterId] = new MovieClipInfo();

	if(typeof src == "object") {
		dataStore = createDataStoreFromObject(src, this.engine.option.imageMap, onProgress);
		analyzer = new Analyzer(this.engine, mcInfo, dataStore.tagList);
		// call Analyzer#analyze() to parse tags immediatelly for the performance
		// (it is not called until all images are loaded)
		analyzer.analyze(dictionary);
		return true;
	}

	var data = Master.getInstance().data;
	dataStore = data[src];
	if(dataStore) {
		analyzer = new Analyzer(this.engine, mcInfo, dataStore.tagList);
		// call onProgress() immediatelly because the SWF file is already loaded
		onProgress();
		return true;
	}

	dataStore = data[src] = new Parser({
		onerror: option.onerror,
		// default value of delayEval is true
		// (delayEval will be true if option.delayEval is not specified)
		delayEval: option.delayEval || (option.delayEval == null)
	});
	analyzer = new Analyzer(this.engine, mcInfo, dataStore.tagList);
	dataStore.load(src, onProgress);

	return true;
};

MovieClip.prototype._startMovie = function(characterId, tagList, scaleX, scaleY, tx, ty, name, onready) {
	var engine = this.engine;
	this._resetDisplayList();

	// stop on current frame
	this.isPlaying = false;

	var dictionary = this.dictionary;
	// create container mc
	dictionary[characterId] = {
		"type": TagDefine.TypeTagDefineSprite,
		"id": characterId,
		"frameCount": 1,
		"tags": tagList
	};

	// placeobject tag for container mc
	var placement = {
		"type": TagDefine.TypeTagPlaceObject2,
		"characterId": characterId,
		"depth": 1,
		"matrix": [scaleX, 0, 0, scaleY, tx, ty],
		"move": 0,
		"name": name || ""
	};

	// save the information in idinfo
	var newId = ++this.mcInfo.idCounter;
	var frame = this.properties._currentframe;
	this.mcInfo.idInfo[newId] = {
		id: newId,
		characterId: characterId,
		layer: 1,
		born: frame,
		placement: placement,
		ownerMC: {}
	};

	// regsiter placement on frame-id-placement map
	for(var i = 1; i <= this.properties._totalframes; i++) {
		this.mcInfo.frameIdPlacementMap[i][newId] = placement;
	}

	// create the container mc
	this.createObject(this.frame, newId, null);
	onready && onready();
};

MovieClip.prototype._resetDisplayList = function() {
	var displayList = this.displayList;
	for(var layer in displayList) {
		var idInfo = displayList[layer];
		this.removeObject(idInfo.id);
	}
};

var generateCharacterId = function(dictionary) {
	// select id
	var characterId = 0x100000000; // not to conflict existing morph shape which is equal or less than 0xFFFFFFFF
	while(dictionary[characterId]) {
		characterId++;
	}
	return characterId;
};
