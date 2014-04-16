var RawRenderer = function(engine) {
	// store arguments
	this.engine = engine;
	this.container = engine.container;
};

RawRenderer.prototype.setFrame = function(rect) {
	this.twWidth = rect[1] - rect[0];
	this.twHeight = rect[3] - rect[2];
	
	if(!this.ctx) {
		// create canvas
		var canvas;
		if(this.container.tagName.toLowerCase() == "canvas") {
			canvas = this.container;
		} else {
			canvas = document.createElement("canvas");
			this.container.appendChild(canvas);
		}
		canvas.width = this.twWidth / 20;
		canvas.height = this.twHeight / 20;
		var ctx = canvas.getContext("2d");
		ctx.fillStyle = "#f00";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		this.ctx = ctx;
	}
};

RawRenderer.prototype.render = function(mc, cxformList) {
	var engine = this.engine;
	var ctx = this.ctx;
	if(!ctx) {
		return;
	}
	if(!mc) {
		var canvas = ctx.canvas;
		if(engine.bgColor != null) {
			ctx.fillStyle = stringColor(engine.bgColor);
			ctx.fillRect(0, 0, canvas.width, canvas.height);
		} else {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		}
		ctx.save();
		mc = this.engine.rootMC;
		cxformList = [];
	}
	var mcInfo = mc.mcInfo;
	var frame = mc.properties["_currentframe"];
	
	var clippedLayerList = [];
	
	var layerList = [];
	for(var layer in mc.displayList) {
		layerList[layerList.length] = layer;
	}
	layerList.sort(function(a, b) {return a - b;});
	var len = layerList.length;
	for(var i = 0; i < len; i++) {
		var idInfo = mc.displayList[layerList[i]];
		var id = idInfo.id;
		var info = mcInfo.idInfo[id];
		var placement = mcInfo.frameIdPlacementMap[frame][id];
		var clipping = false;
		if(placement.clipDepth) {
			ctx.save();
			clippedLayerList.push(placement.clipDepth);
			clipping = true;
		}
		var matrix;
		// set affine transform
		var child = mc.childrenIdMap[id];
		var cxform = placement.cxform;
		cxform && cxformList.push(cxform);
		if(child) {
			if(!child.isLocked) {
				matrix = placement.matrix;
			} else {
				matrix = child.getMatrix();
			}
			matrix && ctx.transform.apply(ctx, matrix);
			this.render(child, cxformList);
		} else {
			matrix = placement.matrix;
			matrix && ctx.transform.apply(ctx, matrix);
			var def = this.engine.dictionary[info.characterId];

			var text = "";
			if(def.type == 37) {
				text = getTextOfEditText(mc, def);
			}
			//if(info.characterId <= 4)
			//drawObject(engine, ctx, this.engine.dictionary[info.characterId], placement.matrix, placement.cxform, (info.characterId <= 3)?"":"2", clipping);
			drawObject(engine, ctx, def, placement.matrix, cxformList, text, clipping);
		}
		matrix && ctx.transform.apply(ctx, revTransform(matrix));
		cxform && cxformList.pop();
		
		if(clippedLayerList.length) {
			var lastClip = clippedLayerList[clippedLayerList.length - 1];
			var nextLayer = layerList[i + 1];
			if(nextLayer == null || nextLayer > lastClip) {
				// unclipping
				clippedLayerList.pop();
				ctx.restore();
			}
		}
	}
	if(mc == this.engine.rootMC) {
		ctx.restore();
	}
};

var Renderer = RawRenderer;
