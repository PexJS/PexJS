var DirtyRectRenderer = function(engine) {
	// store arguments
	this.engine = engine;
	engine.rootTransform = [1, 0, 0, 1, 0, 0];
	this.container = engine.container;
	this.cachedMethod = {};
	this.cachedFunction = {};
	this.cachedClippingFunction = {};
	this.rootScale = 1;
	this.clippingId;
	this.tagListCursor = 0;  // for preloadCache

	this.lastRenderedFrameCount = -1;
	this.lastRenderedItems = {}; // id -> renderedItem
	this.dirtyRects = [];
	engine.option.debug && EngineLogD("dirty rect start");
	this.cacheController = new CacheController(engine.option.cacheMaxTotalSize);
	this.transformImageColor = engine.option.cacheColoredImage? cacheTransformImageColor(this.cacheController): transformImageColor;
};

DirtyRectRenderer.prototype.setFrame = function(rect) {
	this.twWidth = rect[1] - rect[0];
	this.twHeight = rect[3] - rect[2];
	
	if(!this.ctx) {
		// create canvas
		var canvas;
		if(this.container.tagName.toLowerCase() == "canvas") {
			canvas = this.engine.canvas = this.container;
		} else {
			canvas = this.engine.canvas = document.createElement("canvas");
			this.container.appendChild(canvas);
		}
		var width = this.twWidth / 20;
		var height = this.twHeight / 20;
		// deal with option
		var option = this.engine.option;
		var t = null;
		var ratio;
		var rw;
		var rh;
		if(option.width || option.height) {
			if(option.fixRatio) {
				ratio = (option.width && option.width / width) || (option.height && option.height / height) || 1;
				var scaledWidth = width * ratio | 0;
				var scaledHeight = height * ratio | 0;
				rw = scaledWidth / width;
				rh = scaledHeight / height;
				width = scaledWidth;
				height = scaledHeight;
			} else {
				rw = (option.width && option.width / width) || 1;
				rh = (option.height && option.height / height) || 1;
				width = option.width || width;
				height = option.height || height;
			}
			t = [rw, 0, 0, rh, 0, 0];
			ratio = (rw > rh)? rw: rh;
		} else {
			ratio = 1;
		}
		this.ratio = ratio;

		if(option.frameRect) {
			var frameRect = option.frameRect;
			width = frameRect[2] * (rw || ratio);
			height = frameRect[3] * (rh || ratio);
			if(!t) {
				t = [1, 0, 0, 1, 0, 0];
			}
			t[4] = -frameRect[0] * (rw || ratio);
			t[5] = -frameRect[1] * (rh || ratio);
		}

		// re-rendering runs whenever width or height is set, even if they are same values
		if(canvas.width != (width | 0)) {
			option.debug && EngineLogD("set canvas width to " + (width | 0));
			canvas.width = width | 0;
		}
		if(canvas.height != (height | 0)) {
			option.debug && EngineLogD("set canvas height to " + (height | 0));
			canvas.height = height | 0;
		}

		this.frameWidth = canvas.width;
		this.frameHeight = canvas.height;
		option._enableWorkaroundForUnicolor && expandCanvas(canvas);

		this.width = (t && width / t[0]) || width;
		this.height = (t && height / t[3]) || height;
		
		var ctx = canvas.getContext("2d");
		
		// for the bug on Galaxy Tab 10.1 ticket #544 - (20, 21)
		ctx.getImageData(0, 0, 1, 1); // don't delete this line
		
		this.ctx = ctx;
		if(t) {
			if(option.origin) {
				if(option.frameRect) {
					EngineLogW("option.origin is ignored because option.frameRect is specified.");
				} else {
					t[4] = option.origin[0];
					t[5] = option.origin[1];
				}
			}
			
			this.engine.rootTransform = t;
			this.rootScale = Renderer.calcScale(t);
		}

		if(this.engine.bgColor != null) {
			canvas.style.backgroundColor = stringColor(this.engine.bgColor);
		}
	}
};

DirtyRectRenderer.prototype.generateRenderItems = function(mc, currentTransform, cxformList, parentId, operation, detail) {
	var items = [];
	if(!mc) {
		mc = this.engine.rootMC;
		currentTransform = this.engine.rootTransform;
		cxformList = [];
		this.clippingId = 1;
		parentId = "";
	}
	if(!mc.properties._visible) {
		return;
	}
	if(!mc.isModifiedSince(this.lastRenderedFrameCount)) {
		return mc.cachedRenderedItems;
	}
	
	var clippedLayerList = [];
	var mcInfo = mc.mcInfo;
	var frame = mc.properties["_currentframe"];
	var engine = this.engine;
	var dictionary = mc.dictionary;
	var option = engine.option;
	
	for(var name in option.operation) {
		if(name == mc.properties["_name"]) {
			operation = option.operation[name];
		}
	}
	detail = (option.shapeDetail && option.shapeDetail[mc.properties["_name"]]) || detail;
	
	var layerList = [];
	for(var layer in mc.displayList) {
		layer < 65536 && (layerList[layerList.length] = layer);
	}
	layerList.sort(function(a, b) {return a - b;});
	var len = layerList.length;
	for(var i = 0; i < len; i++) {
		var idInfo = mc.displayList[layerList[i]];
		var id = idInfo.id;
		var placement = mcInfo.frameIdPlacementMap[frame][id];
		
		var def = dictionary[idInfo.characterId];
		
		var matrix;
		var cxform = placement.cxform;
		var currentCxformList;
		if(cxform && !(cxform[0]==256 && cxform[1]==256 && cxform[2]==256 && cxform[3]==256
                && cxform[4]==0 && cxform[5]==0 && cxform[6]==0 && cxform[7]==0)) {
			currentCxformList = cxformList.concat([cxform]); // create new array
		} else {
			currentCxformList = cxformList;
		}

		var child = mc.childrenIdMap[id];
		var absoluteId = parentId + ("0000" + id.toString(16)).slice(-4);
		if(placement.clipDepth) {
			// TODO: clipping id is very bad solution for caching. fix this.
			clippedLayerList.push([placement.clipDepth, this.clippingId]);
			items.push(this.clippingId++);
		}
		if(child) {
			if(!child.isLocked) {
				matrix = placement.matrix;
			} else {
				matrix = child.getMatrix();
			}

			Array.prototype.push.apply(items, this.generateRenderItems(child, (matrix && mulTransform(currentTransform, matrix)) || currentTransform, currentCxformList, absoluteId, operation, detail));
		} else {
			matrix = placement.matrix;
			if(matrix[0]*matrix[3] == matrix[1]*matrix[2]) continue; // det(matrix) == 0 means nothing to display

			matrix = (matrix && mulTransform(currentTransform, matrix)) || currentTransform;
			var twRect = transformRect(matrix, def.bounds);
			var rect = DirtyRectRenderer.devide20(twRect);

			var text = "";	
			if(def.type == 37) { // TagDefine.TypeTagDefineEditText
				text = getTextOfEditText(mc, def);
			}

			items.push({
				placement: placement,
				transform: matrix,
				cxformList: currentCxformList,
				absolutePlacementId: absoluteId,
				operation: operation || "source-over",
				detail: detail,
				rect: rect,
				text: text,
				dictionary: dictionary
			});
		}
		if(clippedLayerList.length) {
			var clipData = clippedLayerList[clippedLayerList.length - 1];
			var lastClip = clipData[0];
			var nextLayer = layerList[i + 1];
			if(nextLayer == null || nextLayer > lastClip) {
				// unclipping
				items.push(-clipData[1]);
				clippedLayerList.pop();
			}
		}
	}

	mc.cachedRenderedItems = items;

	return items;
};

DirtyRectRenderer.calcScale = function(m) {
    var l1 = Math.sqrt(m[0]*m[0] + m[1]*m[1]);
    var l2 = Math.sqrt(m[2]*m[2] + m[3]*m[3]);
    return Math.sqrt(l1 * l2);
};

DirtyRectRenderer.roundMatrix = function(matrix) {
	var ret = [];

	for(var i = 0; i < 4; i++) ret[i] = matrix[i];
	for(var i = 4; i < 6; i++) ret[i] = Math.round(matrix[i]);
	return ret;
};

DirtyRectRenderer.devide20 = function(rect) {
	var ret = [];
	ret[0] = Math.floor(rect[0]/20) - 1;
	ret[2] = Math.floor(rect[2]/20) - 1;

	ret[1] = Math.ceil((rect[1] - rect[0]) / 20) + ret[0] + 2;
	ret[3] = Math.ceil((rect[3] - rect[2]) / 20) + ret[2] + 2;

	return ret;
};

DirtyRectRenderer.prototype.addDirtyRect = function(rect) {
	var canvas = this.ctx.canvas;
	var width = this.frameWidth-1;
	var height = this.frameHeight-1;

	if(rect[0] > width || rect[1] < 0 || rect[2] > height || rect[3] < 0) {
		return;
	}
	var x1 = rect[0] > 0 ? rect[0] : 0;
	var x2 = rect[1] < width ? rect[1] : width;
	var y1 = rect[2] > 0 ? rect[2] : 0;
	var y2 = rect[3] < height ? rect[3] : height;

	var dirtyRects = this.dirtyRects;
	for(var i = 0; i < dirtyRects.length; i++) { // DON'T use constant as an array length.
		var r = dirtyRects[i];
		if(x2 < r[0] || r[1] < x1 || y2 < r[2] || r[3] < y1) {
			continue;
		}
		
		x1 = r[0] > x1 ? x1 : r[0];
		x2 = r[1] < x2 ? x2 : r[1];
		y1 = r[2] > y1 ? y1 : r[2];
		y2 = r[3] < y2 ? y2 : r[3];

		dirtyRects.splice(i, 1);	
		i = -1;
	}
	dirtyRects[dirtyRects.length] = [x1, x2, y1, y2];
};

DirtyRectRenderer.compareRenderItem = function(item1, item2, ignoreTranslate, ignoreColorTranslate) {
    if(compareTransform(item1.transform, item2.transform, ignoreTranslate)) {
        if(ignoreColorTranslate || compareColorTransform(item1.cxformList, item2.cxformList)) {
            if(item1.text === item2.text) {
                return true;
            }
        }
    }
    return false;
};

DirtyRectRenderer.prototype.generateImageInfo = function(def, cxformList, localDrawScale, scale, adjustLineScale, dictionary) {
	var engine = this.engine;
	var key = def.id + dictionary["name"];
	var func = (this.cachedFunction[key] || (this.cachedFunction[key] = createDrawFunction(engine, def, false, dictionary)));
	var bounds = def.bounds;
	var width = (def.bounds[1] - def.bounds[0]) / 20;
	var height = (def.bounds[3] - def.bounds[2]) / 20;
	var option = this.engine.option;
	
	var cacheMaxShapeSize = option.cacheMaxShapeSize || 2;
	if(width * (scale || 1) > this.twWidth / 20 * this.rootScale * cacheMaxShapeSize || height * (scale || 1) > this.twHeight / 20 * this.rootScale * cacheMaxShapeSize) {
		// too big to cache. return null
		//console.log(scale, width * (scale || 1), height * (scale || 1), this.rootScale, this.twWidth / 20 * this.rootScale * 2, this.twHeight / 20 * this.rootScale * 2);
		return null;
	}
	
	var canvas = CacheController.getFreeCanvas();
	canvas.width = Math.ceil(width * (scale || 1)) || 1;
	canvas.height = Math.ceil(height * (scale || 1)) || 1;
	option.debug && !option.suppressLog.drawCache && EngineLogD("create cache for [" + def.id + "] width: " + canvas.width + " height:" + canvas.height);
	var cctx = canvas.getContext("2d");
	// use canvas.width / width and canvas.height / height as each scale
	// to fit the canvas whose width and height are integer
	cctx.transform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
	cctx.transform(1, 0, 0, 1, -def.bounds[0] / 20, -def.bounds[2] / 20);//localDrawScale*=scale/1.5;
	adjustLineScale && (localDrawScale = adjustLineScale * this.rootScale);
	//console.log(localDrawScale, scale, adjustLineScale, this.rootScale);
	if(func(engine, cctx, def, null/* TODO remove this param*/, cxformList, "", changeColor, this.transformImageColor, splitString, localDrawScale, makeGlyphInfo, renderFont, null, dictionary)) {
		(canvas.width == 0 || canvas.height == 0) && (canvas.width = 1, canvas.height = 1);
		return {img: canvas, x: def.bounds[0] / 20, y: def.bounds[2] / 20, width: width, height: height, scale: scale};
	} else {
		return null;
	}
};

DirtyRectRenderer.prototype.createDirtyRects = function(items) {
	this.dirtyRects = [];

	var len = items.length;
	for(var i = 0; i < len; i++) {
		var current = items[i];
		if(typeof current === "number") continue;

		var absolutePlacementId = current.absolutePlacementId;
		var last = this.lastRenderedItems[absolutePlacementId];
		if(last) {
			if(!DirtyRectRenderer.compareRenderItem(current, last)) {
				this.addDirtyRect(current.rect);
				this.addDirtyRect(last.rect);
			}
			delete this.lastRenderedItems[absolutePlacementId];
		} else {
			this.addDirtyRect(current.rect);
		}
	}
	
	for(var id in this.lastRenderedItems) {
		this.addDirtyRect(this.lastRenderedItems[id].rect);
		delete this.lastRenderedItems[id];
	}
};

DirtyRectRenderer.prototype.preloadCache = function() {
	var engine = this.engine;
	var option = engine.option;
	var shapeDetail = option.shapeDetail;

	if(shapeDetail) {
		var cacheController = this.cacheController;
		if(shapeDetail.all && shapeDetail.all.preload) {
			option.debug && EngineLogD("preload: all");
			var tagList = engine.dataStore.tagList;
			var len = tagList.length;
			for(var i = this.tagListCursor; i < len; i++) {
				var tag = tagList[i];
				switch(tag.type) {
				case TagDefine.TypeTagDefineShape:
				case TagDefine.TypeTagDefineShape2:
				case TagDefine.TypeTagDefineShape3:
				case TagDefine.TypeTagDefineText:
				case TagDefine.TypeTagDefineText2:
				case TagDefine.TypeTagDefineEditText:
					var key = tag.id;
					var def = tag;

					// Manual inline expansion
					var method = this.cachedMethod[key] || ((shapeDetail[key] && shapeDetail[key].method) || (shapeDetail.all && shapeDetail.all.method));
					method = (def.type != 37 && method) || "func";
					this.cachedMethod[key] || ((this.cachedMethod[key] = method) && option.debug && !option.suppressLog.drawCache && EngineLogD("CacheMethod["+key+"]="+method));

					if(method == "cache") {
						var scale = (shapeDetail[key] && shapeDetail[key].cacheScale) || (shapeDetail.all && shapeDetail.all.cacheScale) || this.rootScale;
						var adjustLineScale = (shapeDetail[key] && shapeDetail[key].adjustLineScale) || (shapeDetail.all && shapeDetail.all.adjustLineScale);
						cacheController.getImageInfo[key] || cacheController.cacheImageInfo(key, this.generateImageInfo(def, [], scale, scale, null, this.engine.dictionary));
					} else {
						(this.cachedFunction[key] || (this.cachedFunction[key] = createDrawFunction(engine, def, false, this.engine.dictionary)));
					}
            		break;
				}
			}
			this.tagListCursor = len;
		} else {
			for(var key in shapeDetail) {
				var def = engine.dictionary[key];
				if(def && shapeDetail[key].preload) { // 'all' is excluded by this condition because def is always undefiend.
					if(this.cachedMethod[key]) {
						// already loaded
						continue;
					}
					option.debug && EngineLogD("preload: "+key);

					// Manual inline expansion
					var method = this.cachedMethod[key] || (shapeDetail[key].method || (shapeDetail.all && shapeDetail.all.method));
					method = (def.type != 37 && method) || "func";
					this.cachedMethod[key] || ((this.cachedMethod[key] = method) && option.debug && !option.suppressLog.drawCache && EngineLogD("CacheMethod["+key+"]="+method));

					if(method == "cache") {
						var scale = shapeDetail[key].cacheScale || (shapeDetail.all && shapeDetail.all.cacheScale) || this.rootScale;
						var adjustLineScale = (shapeDetail[key] && shapeDetail[key].adjustLineScale) || (shapeDetail.all && shapeDetail.all.adjustLineScale);
						cacheController.getImageInfo[key] || cacheController.cacheImageInfo(key, this.generateImageInfo(def, [], scale, scale, null, this.engine.dictionary));
					} else {
						this.cachedFunction[key] || (this.cachedFunction[key] = createDrawFunction(engine, def, false, this.engine.dictionary));
					}
				}
			}
		}
	}
};

DirtyRectRenderer.prototype.render = function() {
	var ctx = this.ctx;
	if(!ctx) {
		return;
	}
	// at first, flatten all movie clips
	var items = this.generateRenderItems() || [];

	this.createDirtyRects(items);

	var engine = this.engine;
	var option = engine.option;
	var dirtyRects = this.dirtyRects;
	var dlen = dirtyRects.length;

	var canvas = ctx.canvas;
	ctx.fillStyle = stringColor(this.engine.bgColor);
	for(var j = 0; j < dlen; j++) {
		var drect = dirtyRects[j];
		if(option.transparent) {
			// Android default browser of some models such as SC-06D
			// freezes if set CSS zoom and used ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height) repeatedly,
			// so use ctx.clearRect(0, 0, ctx.canvas.width + 1, ctx.canvas.height)
			// cf. PFX-57
			if(drect[0] == 0 && drect[1] + 1 == ctx.canvas.width) {
				drect[1]++;
			}
			ctx.clearRect(drect[0], drect[2], drect[1]-drect[0]+1, drect[3]-drect[2]+1);
		} else {
			// Android default browser of SCL21 seems to clear canvas
			// if use ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height) repeatedly and fastly,
			// so use ctx.fillRect(0, 0, ctx.canvas.width + 1, ctx.canvas.height)
			// cf. #479
			if(drect[0] == 0 && drect[1] + 1 == ctx.canvas.width) {
				drect[1]++;
			}
			ctx.fillRect(drect[0], drect[2], drect[1]-drect[0]+1, drect[3]-drect[2]+1);
		}
	}
	ctx.fillStyle = "rgba(0,0,0,1)";	// for avoiding android legacy browser's bug
										// it seems to be keeping alpha value inside browser
										// so overwrite alpha value with 1

	ctx.save();
	ctx.beginPath();
	for(var j = 0; j < dlen; j++) {
		var drect = dirtyRects[j];
		ctx.rect(drect[0], drect[2], drect[1]-drect[0]+1, drect[3]-drect[2]+1);
	}
	ctx.clip();

	var cacheController = this.cacheController;
	var len = items.length;
	var clippingCnt = 0;
	for(var i = 0; i < len; i++) {
		var item = items[i];

		if(typeof item === "number") {
			if(item > 0) {
				ctx.save();
			} else {
				for(; clippingCnt > 0; clippingCnt--) {
					ctx.restore();
				}
				ctx.restore();
			}
			continue;
		}
		var placement = item.placement;
		var matrix = item.transform;
		var cxformList = item.cxformList;
		var rect = item.rect;
		var text = item.text;

		var localDrawScale = DirtyRectRenderer.calcScale(matrix);
		var dictionary = item.dictionary;
		var def = dictionary[placement.characterId];
		
		var clipping = placement.clipDepth;

		var hasOverlapWithDirtyRects = false;
		for(var j = 0; j < dlen; j++) {
			var drect = dirtyRects[j];
			if(drect[1] >= rect[0] && rect[1] >= drect[0]
				&& drect[3] >= rect[2] && rect[3] >= drect[2]) {
				hasOverlapWithDirtyRects = true;
				break;
			}
		}

		if(!hasOverlapWithDirtyRects && !clipping) {
			continue;
		}
		
		ctx.globalCompositeOperation = item.operation;
		var detail = item.detail;
		
		// todo: deal with cxform
		if(clipping) {
			var operation = ctx.globalCompositeOperation;
			if (operation != "source-over") {
				// copy the canvas temporarily to avoid 'PFX-29'

				// Android default browser won't apply the changes after clipping
				// until 'restore' is called,
				// so call 'restore' to apply changes temporarily
				ctx.restore();  // state of after clip
				ctx.restore();  // state of before clip

				var copiedCanvas = CacheController.getFreeCanvas();
				copiedCanvas.width = this.frameWidth;
				copiedCanvas.height = this.frameHeight;
				copiedCanvas.getContext('2d').drawImage(canvas, 0, 0);

				// clip again
				ctx.save();
				if (clippingCnt > 0) {
					// FIXME: clipping path can be changed ('beginPath' can be called after clip)
					ctx.clip();
				} else {
					ctx.save();
					for(var j = 0; j < dlen; j++) {
						var drect = dirtyRects[j];
						ctx.rect(drect[0], drect[2], drect[1]-drect[0]+1, drect[3]-drect[2]+1);
					}
					ctx.clip();
				}
				ctx.save();
				ctx.globalCompositeOperation = operation;
			}
			ctx.transform.apply(ctx, matrix);

			var key = def.id + dictionary["name"];
			(this.cachedClippingFunction[key] || (this.cachedClippingFunction[key] = createDrawFunction(engine, def, true, dictionary)))
				(engine, ctx, def, matrix, cxformList, text, changeColor, this.transformImageColor, splitString, localDrawScale, makeGlyphInfo, renderFont, copiedCanvas, dictionary);
			if (copiedCanvas) {
				CacheController.destroyCanvas(copiedCanvas);
				copiedCanvas = null;
			}
			// Android default browser requires ctx.save before ctx.clip to clip works correctly,
			// but Android 3.x requires ctx.save also after ctx.clip
			ctx.save();
			clippingCnt++;

			ctx.transform.apply(ctx, revTransform(matrix));
		} else {
			var key = def.id + dictionary["name"];

			// get option
			var shapeDetail = option.shapeDetail;
			var method = this.cachedMethod[key]
							|| (shapeDetail && ((shapeDetail[key] && shapeDetail[key].method) || (detail && detail.method) || (shapeDetail.all && shapeDetail.all.method)));
			method = (def.type != 37 && method) || "func";
			this.cachedMethod[key] || ((this.cachedMethod[key] = method) && option.debug && !option.suppressLog.drawCache && EngineLogD("CacheMethod["+key+"]="+method));
			var drawed = false;
			if(method == "cache") {
				var imageKey = key;
				if(cxformList && cxformList.length) {
					var post = ",";
					var clen = cxformList.length;
					for(var c = 0; c < clen; c++) {
						post += cxformList[c].join();
					}
					imageKey += post;
				}
				// use cache images
				var imageInfo = cacheController.getImageInfo(imageKey);
				if(!imageInfo) {
					var scale = (shapeDetail && +((shapeDetail[key] && shapeDetail[key].cacheScale) || (detail && detail.cacheScale) || (shapeDetail.all && shapeDetail.all.cacheScale) || this.rootScale)) || localDrawScale;
					var adjustLineScale = (shapeDetail[key] && shapeDetail[key].adjustLineScale) || (detail && detail.adjustLineScale) || (shapeDetail.all && shapeDetail.all.adjustLineScale);
					imageInfo = this.generateImageInfo(def, cxformList, localDrawScale, scale, adjustLineScale, dictionary);
					imageInfo && cacheController.cacheImageInfo(imageKey, imageInfo);
					if(!imageInfo) {
						this.cachedMethod[key] = "func";
						option.shapeDetail = option.shapeDetail || {};
						option.shapeDetail[key] = "func";
						option.debug && EngineLogD("cache avoided: " + placement.characterId);
					}
				}
				if(imageInfo && imageInfo.width && imageInfo.height) {
					drawed = true;
					ctx.save();
					if(matrix[1] == 0 && matrix[2] == 0) {
						// No rotation
						var scaleX = matrix[0];
						var scaleY = matrix[3];
						var t0 = scaleX > 0 ? 1 : -1;
						var t3 = scaleY > 0 ? 1 : -1;

						var dw = Math.round(t0*imageInfo.width*scaleX);
						var dx = Math.round(t0*(imageInfo.x*scaleX + matrix[4]));
						var dh = Math.round(t3*imageInfo.height*scaleY);
						var dy = Math.round(t3*(imageInfo.y*scaleY + matrix[5]));
						ctx.transform(t0, 0, 0, t3, 0, 0);
						ctx.drawImage(imageInfo.img, dx, dy, dw, dh);
					} else {
						ctx.transform.apply(ctx, matrix);
						ctx.drawImage(imageInfo.img, imageInfo.x, imageInfo.y, imageInfo.width, imageInfo.height);
					}
					ctx.restore();
				}
			}
			if(!drawed) {
				// use function method
				var key = def.id + dictionary["name"];
				// If fail to draw the image (e.g. the image haven't been loaded yet), set items[i] to NaN, which type is number,
				// so that items[i] is not stored to lastRenderedItems
				ctx.save();
				ctx.transform.apply(ctx, matrix);
				(this.cachedFunction[key] || (this.cachedFunction[key] = createDrawFunction(engine, def, false, dictionary)))
					(engine, ctx, def, placement.matrix, cxformList, text, changeColor, this.transformImageColor, splitString, localDrawScale, makeGlyphInfo, renderFont, null, dictionary) || (items[i] = NaN);
				ctx.restore();
			}

		}
	}

	ctx.restore();
	ctx.globalCompositeOperation = "source-over";

/*
	ctx.strokeStyle = "rgb(255,0,255)";
	for(var j = 0; j < dlen; j++) {
		var drect = dirtyRects[j];
		ctx.strokeRect(drect[0], drect[2], drect[1]-drect[0], drect[3]-drect[2]);
	}
*/	
	this.lastRenderedFrameCount = this.engine.frameCount;
	this.lastRenderedItems = {};
	for(var i = 0; i < items.length; i++) {
		var item = items[i];
		if(typeof item === "number") {
			continue;
		}
		var id = item.absolutePlacementId;
		this.lastRenderedItems[id] = item;
	}


};
