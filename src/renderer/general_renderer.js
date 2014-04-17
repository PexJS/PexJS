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


var Renderer = function(engine) {
	// store arguments
	this.engine = engine;
	this.container = engine.container;
	this.cachedMethod = {};
	this.cachedFunction = {};
	this.cachedClippingFunction = {};
	this.rootScale = 1;
	this.cacheController = new CacheController(engine.option.cacheMaxTotalSize);
	this.transformImageColor = engine.option.cacheColoredImage? cacheTransformImageColor(this.cacheController): transformImageColor;
};

Renderer.calcScale = function(m) {
	var l1 = Math.sqrt(m[0]*m[0] + m[1]*m[1]);
	var l2 = Math.sqrt(m[2]*m[2] + m[3]*m[3]);
	return Math.sqrt(l1 * l2);
};

Renderer.prototype.setFrame = function(rect) {
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
				var rw = (option.width && option.width / width) || 1;
				var rh = (option.height && option.height / height) || 1;
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
		this.ctx = ctx;
		if (t) {
			if(option.origin) {
				if(option.frameRect) {
					EngineLogW("option.origin is ignored because option.frameRect is specified.");
				} else {
					t[4] = option.origin[0];
					t[5] = option.origin[1];
				}
			}
			
			ctx.transform.apply(ctx, t);
			this.engine.rootTransform = t;
			this.rootScale = Renderer.calcScale(t);
		}
	}
};

Renderer.prototype.render = function(mc, cxformList, drawScale, detail) {
	var engine = this.engine;
	var option = engine.option;
	var ctx = this.ctx;
	if(!ctx) {
		return;
	}
	if(!mc) {
		var canvas = ctx.canvas;
		if(engine.bgColor != null) {
			ctx.fillStyle = stringColor(engine.bgColor);
			// Android default browser of some models such as SCL21
			// resets its transform matrix if used ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height) repeatedly
			// cf. PFX-90
			ctx.fillRect(0, 0, this.width + 1, this.height);
		} else {
			// Android default browser of some models such as SC-06D
			// freezes if set CSS zoom and used ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height) repeatedly,
			// so use ctx.clearRect(0, 0, ctx.canvas.width + 1, ctx.canvas.height)
			// cf. PFX-57
			ctx.clearRect(0, 0, this.width + 1, this.height);
		}
		ctx.save();
		mc = this.engine.rootMC;
		cxformList = [];
	}
	if(!mc.properties._visible) {
		return;
	}
	var oldOperation = ctx.globalCompositeOperation;
	for(var name in option.operation) {
		if(name == mc.properties["_name"]) {
			ctx.globalCompositeOperation = option.operation[name];
		}
	}
	detail = (option.shapeDetail && option.shapeDetail[mc.properties["_name"]]) || detail;
	var mcInfo = mc.mcInfo;
	var frame = mc.properties["_currentframe"];
	
	var clippedLayerList = [];
	
	var layerList = [];
	for(var layer in mc.displayList) {
		layer < 65536 && (layerList[layerList.length] = layer);
	}
	layerList.sort(function(a, b) {return a - b;});
	var cacheController = this.cacheController;
	var len = layerList.length;
	var dictionary = mc.dictionary;

	for(var i = 0; i < len; i++) {
		var idInfo = mc.displayList[layerList[i]];
		var id = idInfo.id;
		var info = mcInfo.idInfo[id];
		var placement = mcInfo.frameIdPlacementMap[frame][id];
		var clipping = false;
		var localDrawScale = drawScale || this.rootScale;
		
		var def = dictionary[idInfo.characterId];
		
		if(placement.clipDepth) {
			ctx.save();
			clippedLayerList.push(placement.clipDepth);
			clipping = true;
		}
		var matrix = null;
		// set affine transform
		var child = mc.childrenIdMap[id];
		var cxform = placement.cxform;
		if(cxform && cxform[0]==256 && cxform[1]==256 && cxform[2]==256 && cxform[3]==256
				&& cxform[4]==0 && cxform[5]==0 && cxform[6]==0 && cxform[7]==0) {
			cxform = null;
		}
		cxform && cxformList.push(cxform);
		if(child) {
			var childProps = child.properties;
			// child is visible?
			if(childProps._xscale != 0 && childProps._yscale != 0) {
				if(!child.isLocked) {
					matrix = placement.matrix;
				} else {
					matrix = child.getMatrix();
				}
				if(matrix) {
					if(!clipping) ctx.save();
					ctx.transform.apply(ctx, matrix);
					localDrawScale *= Renderer.calcScale(matrix);
				}
				this.render(child, cxformList, localDrawScale, detail);
			}
		} else if(def.type == 34) { // TODO: pass button TagDefine.TypeTagDefineButton2
			matrix = placement.matrix;
			if(matrix) {
				if(!clipping) ctx.save();
				ctx.transform.apply(ctx, matrix);
				localDrawScale *= Renderer.calcScale(matrix);
			}
		} else {
			matrix = placement.matrix;
			if(matrix) {
				if(!clipping) ctx.save();
				ctx.transform.apply(ctx, matrix);
				localDrawScale *= Renderer.calcScale(matrix);
			}
			var text = "";	
			if(def.type == 37) { // TagDefine.TypeTagDefineEditText
				text = getTextOfEditText(mc, def);
			}

			// todo: deal with cxform
			var key = def.id + dictionary["name"];
			if(clipping) {
				var operation = ctx.globalCompositeOperation;
				if (operation != "source-over") {
					// copy the canvas temporarily to avoid 'PFX-29'
					// TODO: currently doesn't support clipping layer over clipping layer
					var canvas = ctx.canvas;
					var copiedCanvas = CacheController.getFreeCanvas();
					copiedCanvas.width = this.frameWidth;
					copiedCanvas.height = this.frameHeight;
					copiedCanvas.getContext('2d').drawImage(canvas, 0, 0);
					ctx.globalCompositeOperation = operation;
				}

				(this.cachedClippingFunction[key] || (this.cachedClippingFunction[key] = createDrawFunction(engine, def, true, dictionary)))
					(engine, ctx, def, placement.matrix, cxformList, text, changeColor, this.transformImageColor, splitString, localDrawScale, makeGlyphInfo, renderFont, copiedCanvas, dictionary);
				if (copiedCanvas) {
					CacheController.destroyCanvas(copiedCanvas);
					copiedCanvas = null;
				}
				// Android default browser requires ctx.save before ctx.clip to clip works correctly,
				// but Android 3.x requires ctx.save also after ctx.clip
				ctx.save();
			} else {
				// get option
				var shapeDetail = option.shapeDetail;
				var method = this.cachedMethod[key]
								|| (shapeDetail && ((shapeDetail[key] && shapeDetail[key].method) || (detail && detail.method) || (shapeDetail.all && shapeDetail.all.method)));
				this.cachedMethod[key] || (this.cachedMethod[key] = ((def.type != 37 && method) || "func"));
				var drawed = false;
				if(method == "cache") {
					if(cxformList && cxformList.length) {
						var post = ",";
						var clen = cxformList.length;
						for(var c = 0; c < clen; c++) {
							post += cxformList[c].join();
						}
						key += post;
					}
					// use cache images
					var imageInfo = cacheController.getImageInfo(key);
					if(!imageInfo) {
						var scale = (shapeDetail && +((shapeDetail[key] && shapeDetail[key].cacheScale) || (detail && detail.cacheScale) || (shapeDetail.all && shapeDetail.all.cacheScale) || this.rootScale)) || localDrawScale;
						var adjustLineScale = (shapeDetail && +((shapeDetail[key] && shapeDetail[key].adjustLineScale) || (detail && detail.adjustLineScale) || (shapeDetail.all && shapeDetail.all.adjustLineScale)));
						var adjustedScale = localDrawScale;
						//adjustLineScale && (adjustedScale *= scale * adjustLineScale / this.rootScale);
						adjustLineScale && (adjustedScale = adjustLineScale * this.rootScale);
						
						var func = createDrawFunction(engine, def, false, dictionary);
						var bounds = def.bounds;
						var width = (def.bounds[1] - def.bounds[0]) / 20;
						var height = (def.bounds[3] - def.bounds[2]) / 20;

						if(width * (scale || 1) < this.twWidth / 20 * this.rootScale * 2 && height * (scale || 1) < this.twHeight / 20 * this.rootScale * 2) {
							var canvas = CacheController.getFreeCanvas();
							canvas.width = Math.ceil(width * (scale || 1)) || 1;
							canvas.height = Math.ceil(height * (scale || 1)) || 1;
							option.debug && !option.suppressLog.drawCache && EngineLogD("create cache for [" + def.id + "] width: " + canvas.width + " height:" + canvas.height);
							var cctx = canvas.getContext("2d");
							// use canvas.width / width and canvas.height / height as each scale
							// to fit the canvas whose width and height are integer
							cctx.transform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
							cctx.transform(1, 0, 0, 1, -def.bounds[0] / 20, -def.bounds[2] / 20);
							if(func(engine, cctx, def, placement.matrix, cxformList, text, changeColor, this.transformImageColor, splitString, adjustedScale, makeGlyphInfo, renderFont, null, dictionary)) {
								imageInfo = {img: canvas, x: def.bounds[0] / 20, y: def.bounds[2] / 20, width: width, height: height, scale: scale};
								cacheController.cacheImageInfo(key, imageInfo);
							} else {
								// image is not loaded so not to draw
							}
						} else {
							this.cachedMethod[key] = "func";
							option.shapeDetail = option.shapeDetail || {};
							option.shapeDetail[key] = "func";
							option.debug && EngineLogD("cache avoided: " + idInfo.characterId);
							//console.log("came here:", idInfo.characterId, width * (scale || 1), height * (scale || 1), this.twWidth / 20 * 2, this.twHeight / 20 * 2);
						}
					}
					if(imageInfo) {
						imageInfo.width && imageInfo.height &&
						((imageInfo.scale && (ctx.drawImage(imageInfo.img, imageInfo.x, imageInfo.y, imageInfo.width, imageInfo.height) || true))
							|| ctx.drawImage(imageInfo.img, imageInfo.x, imageInfo.y));
						drawed = true;
					}
				}
				if(!drawed) {
					// use function method
					var key = def.id + ((clipping)?"c": "") + dictionary["name"];
					//console.log("key:" + key);
					(this.cachedFunction[key] || (this.cachedFunction[key] = createDrawFunction(engine, def, clipping, dictionary)))
						(engine, ctx, def, placement.matrix, cxformList, text, changeColor, this.transformImageColor, splitString, localDrawScale, makeGlyphInfo, renderFont, null, dictionary);
				}
			}
		}
		matrix && clipping ? ctx.transform.apply(ctx, revTransform(matrix)) : ctx.restore();
		cxform && cxformList.pop();
		
		if(clippedLayerList.length) {
			var lastClip = clippedLayerList[clippedLayerList.length - 1];
			var nextLayer = layerList[i + 1];
			if(nextLayer == null || nextLayer > lastClip) {
				// unclipping
				clippedLayerList.pop();
				ctx.restore();
				ctx.restore();
			}
		}
	}
	ctx.globalCompositeOperation = oldOperation;
	if(mc == this.engine.rootMC) {
		ctx.restore();
	}
};
