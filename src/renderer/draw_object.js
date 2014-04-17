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


var drawObject = function() {
	var renderShape = function() {
		// set context
		var engine;
		var context;
		
		// save paths for each styles
		var linePaths;
		var fillPaths;
		var marginPaths;
		
		// initialize
		var currentLineStyle;
		var currentFillStyle0;
		var currentFillStyle1;
		var path;
		var lineStyles;
		var fillStyles;
		
		var rev = function(path) {
			var ret = [];
			var len = path.length;
			for(var i = len - 1; i >= 0; i--) {
				var p = path[i];
				if(p.cx != null) {
					ret.push({x1: p.x2, y1: p.y2, cx: p.cx, cy: p.cy, x2: p.x1, y2: p.y1});
				} else {
					ret.push({x1: p.x2, y1: p.y2, x2: p.x1, y2: p.y1});
				}
			}
			return ret;
		};
		
		var addPath = function(clipping) {
			if(!path.length) {
				return;
			}
			if(currentLineStyle != 0) {
				linePaths[currentLineStyle - 1] = linePaths[currentLineStyle - 1] || [];
				linePaths[currentLineStyle - 1].push(path);
			} else if(currentFillStyle0 != 0 && currentFillStyle1 != 0) {
				// fill space between the object with line
				if(fillStyles[currentFillStyle0 - 1].type == FillStyleDefine.TypeSolidFill) {
					marginPaths[currentFillStyle0 - 1] = marginPaths[currentFillStyle0 - 1] || [];
					marginPaths[currentFillStyle0 - 1].push(path);
				} else if(fillStyles[currentFillStyle1 - 1].type == FillStyleDefine.TypeSolidFill) {
					marginPaths[currentFillStyle1 - 1] = marginPaths[currentFillStyle1 - 1] || [];
					marginPaths[currentFillStyle1 - 1].push(path);
				}
			}
			
			if(currentFillStyle0 != 0) {
				var pathIndex = currentFillStyle0 - 1;
				if(clipping) {
					pathIndex = 0;
				}
				fillPaths[pathIndex] = fillPaths[pathIndex] || [];
				fillPaths[pathIndex].push(path);
			}
			if(currentFillStyle1 != 0) {
				var pathIndex = currentFillStyle1 - 1;
				if(clipping) {
					pathIndex = 0;
				}
				fillPaths[pathIndex] = fillPaths[pathIndex] || [];
				// reverse all paths inside fillStyle1
				fillPaths[pathIndex].push(rev(path));
			}
			// create new path list
			path = [];
		};
		
		var closeContext = function() {
			context.push({lineStyles: lineStyles, fillStyles: fillStyles, linePaths: linePaths, fillPaths: fillPaths, marginPaths: marginPaths});
			linePaths = [];
			fillPaths = [];
			marginPaths = [];
		};
		
		var drawLineFunc = function(ctx, style, line, cxformList) {
			ctx.beginPath();
			setLineStyle(ctx, style, cxformList);
			var len = line.length;
			for(var i = 0; i < len; i++) {
				var paths = line[i];
				ctx.moveTo(paths[0].x1 / 20, paths[0].y1 / 20);
				var plen = paths.length;
				for(var j = 0; j < plen; j++) {
					var path = paths[j];
					if(path.cx != null) {
						ctx.quadraticCurveTo(path.cx / 20, path.cy / 20, path.x2 / 20, path.y2 / 20);
					} else {
						ctx.lineTo(path.x2 / 20, path.y2 / 20);
					}
				}
			}
			ctx.stroke();
		};
		
		var repairPath = function(path, rt) {
			if(!rt) {
				return path;
			}
			var xy;
			var ret = {};
			xy = transformXY(rt, path.x1, path.y1);
			ret.x1 = xy[0];
			ret.y1 = xy[1];
			xy = transformXY(rt, path.x2, path.y2);
			ret.x2 = xy[0];
			ret.y2 = xy[1];
			if(path.cx != null) {
				xy = transformXY(rt, path.cx, path.cy);
				ret.cx = xy[0];
				ret.cy = xy[1];
			}
			return ret;
		};
		
		var joinPaths = function(paths) {
			do {
				var ret = [];
				var concat = false;
				var ilen = paths.length;
				for(var i = 0; i < ilen; i++) {
					var jlen = ret.length;
					for(var j = 0; j < jlen; j++) {
						var lp = paths[i].length - 1;
						var lr = ret[j].length - 1;
						if(paths[i][0].x1 == ret[j][lr].x2 && paths[i][0].y1 == ret[j][lr].y2) {
							// paths[i] can join after ret[j]
							ret[j] = ret[j].concat(paths[i]);
							concat = true;
							break;
						} else if(ret[j][0].x1 == paths[i][lp].x2 && ret[j][0].y1 == paths[i][lp].y2) {
							// paths[i]can join before ret[j]
							ret[j] = paths[i].concat(ret[j]);
							concat = true;
							break;
						}
					}
					if(j == ret.length) {
						ret.push(paths[i]);
					}
				}
				paths = ret;
			} while(concat);
			
			return paths;
		};
		
		var setLineStyle = function(ctx, lineStyle, cxformList) {
			if(lineStyle.width != null) {
				var lw = lineStyle.width / 20;
				if (lw < 1) lw = 1;
				ctx.lineWidth = lw;
			}
			if(lineStyle.color != null) {
				ctx.strokeStyle = changeColor(cxformList, lineStyle.color);
			}
		};
		
		var setFillStyle = function(ctx, fillStyle, cxformList, dictionary) {
			var ret = null;
			switch(fillStyle.type) {
			case FillStyleDefine.TypeSolidFill:
				ctx.fillStyle = changeColor(cxformList, fillStyle.color);
				break;
			case FillStyleDefine.TypeRepeatingBitmapFill:
			case FillStyleDefine.TypeClippedBitmapFill:
			case FillStyleDefine.TypeNonSmoothedRepeatingBitmapFill:
			case FillStyleDefine.TypeNonSmoothedClipedBitmapFill:
				var t = fillStyle.matrix; // receive wrong matrix here
				ret = [t[0] / 20, t[1] / 20, t[2] / 20, t[3] / 20, t[4], t[5]];
				
				var img = dictionary[fillStyle.bitmapId].img;
				if(!img) {
					EngineLogE("setFillStyle: can't find image:", fillStyle.bitmapId);
				}
				if(cxformList.length) {
					img = transformImageColor(cxformList, img);
				}
				ctx.fillStyle = ctx.createPattern(img, "repeat");
				break;
			case FillStyleDefine.TypeLinearGradientFill:
			case FillStyleDefine.TypeRadialGradientFill:
				ret = fillStyle.matrix;
				var grad;
				if(fillStyle.type == FillStyleDefine.TypeLinearGradientFill) {
					grad = ctx.createLinearGradient(-16384 / 20, 0, 16384 / 20, 0);
				} else {
					grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 16384 / 20);
				}
				var len = fillStyle.gradient.records.length;
				for (var i = 0; i < len; i++) {
					var g = fillStyle.gradient.records[i];
					//grad.addColorStop(g.ratio / 255, transformColor(colorTransform, g.color));
					grad.addColorStop(g.ratio / 255, changeColor(cxformList, g.color));
				}
				ctx.fillStyle = grad;
				break;
			default:
				EngineLogE("renderShape.setFillStyle: unknown draw type called: " + fillStyle.type);
				break;
			}
			return ret;
		};
		
		return function(engine_, ctx, fillStyles_, lineStyles_, shapes, cxformList, clipping) {
			// initializing
			engine = engine_;
			context = [];
			fillStyles = fillStyles_;
			lineStyles = lineStyles_;
			
			linePaths = [];
			fillPaths = [];
			marginPaths = [];
			
			currentLineStyle = 0;
			currentFillStyle0 = 0;
			currentFillStyle1 = 0;
			path = [];
			
			// current position
			var x = 0;
			var y = 0;
			
			var len = shapes.length;
			for(var i = 0; i < len; i++) {
				var shape = shapes[i];
				
				switch(shape.type) {
				case EdgeDefine.TypeCurve:
					var cx = x + shape.cx;
					var cy = y + shape.cy;
					var ax = cx + shape.ax;
					var ay = cy + shape.ay;
					path.push({x1: x, y1: y, cx: cx, cy: cy, x2:ax, y2: ay});
					x = ax;
					y = ay;
					break;
				case EdgeDefine.TypeStraight:
					var ax = x + shape.x;
					var ay = y + shape.y;
					path.push({x1: x, y1: y, x2:ax, y2: ay});
					x = ax;
					y = ay;
					break;
				case EdgeDefine.TypeStyleChange:
					addPath(clipping);
					if(shape.lineStyles || shape.fillStyles) {
						// if new styles exist, once close context
						closeContext();
						// set new styles
						lineStyles = shape.lineStyles || lineStyles;
						fillStyles = shape.fillStyles || fillStyles;
					}
					if(shape.dx != null) {
						// TODO: x += shape.dx seems to be true
						x = shape.dx;
					}
					if(shape.dy != null) {
						// TODO: y += shape.dy seems to be true
						y = shape.dy;
					}
					if(shape.lineStyle != null) {
						currentLineStyle = shape.lineStyle;
					}
					if(shape.fillStyle0 != null) {
						currentFillStyle0 = shape.fillStyle0;
					}
					if(shape.fillStyle1 != null) {
						currentFillStyle1 = shape.fillStyle1;
					}
					break;
				default:
					EngineLogE("drawObject.renderShape: Unknown type detected:", shape.type);
					break;
				}
			}
			// save the last path
			addPath(clipping);
			closeContext();
			
			
			// start to draw
			ctx.lineCap = "round";
			ctx.globalCompositeOperation = "source-over";
			
			var clen = context.length;
			for(var i = 0; i < clen; i++) {
				var c = context[i];
				lineStyles = c.lineStyles;
				fillStyles = c.fillStyles;
				linePaths = c.linePaths;
				fillPaths = c.fillPaths;
				marginPaths = c.marginPaths;
				
				if(!clipping) {
					// stroke margin lines first
					var mlen = marginPaths.length;
					for(var j = 0; j < mlen; j++) {
						var line = marginPaths[j];
						if(line) {
							var style = {
								width: 1,
								color: fillStyles[j].color
							};
							drawLineFunc(ctx, style, line, cxformList);
						}
					}
				}
				
				// fill
				var flen = fillPaths.length;
				for(var j = 0; j < flen; j++) {
					var fill = fillPaths[j];
					var rt;
					if(fill) {
						fill = joinPaths(fill);
						if(!clipping) {
							var ft = setFillStyle(ctx, fillStyles[j], cxformList);
							ft && ctx.transform.apply(ctx, ft);
							rt = (ft && revTransform(ft)) || null;
						}
						if(!clipping || (i == 0 && j == 0)) {
							// when clipping, execute beginPath only first time
							ctx.beginPath();
						}
						
						var fflen = fill.length
						for(var k = 0; k < fflen; k++) {
							var paths = fill[k];
							if(paths) {
								var from = repairPath(paths[0], rt);
								ctx.moveTo(from.x1 / 20, from.y1 / 20);
								var plen = paths.length;
								for(var l = 0; l < paths.length; l++) {
									var pathRepair = repairPath(paths[l], rt);
									if(pathRepair.cx != null) {
										ctx.quadraticCurveTo(pathRepair.cx / 20, pathRepair.cy / 20, pathRepair.x2 / 20, pathRepair.y2 / 20);
									} else {
										ctx.lineTo(pathRepair.x2 / 20, pathRepair.y2 / 20);
									}
								}
							}
						}
						
						if(clipping) {
							if(i == context.length - 1 && j == fillPaths.length - 1) {
								// clip execute only the last draw
								ctx.clip();
							}
						} else {
							ctx.fill();
							rt && ctx.transform.apply(ctx, rt);
						}
					}
					
				} // fillPaths
				
				if(!clipping) {
					var llen = linePaths.length;
					for(var j = 0; j < llen; j++) {
						var line = linePaths[j];
						line && drawLineFunc(ctx, lineStyles[j], line, cxformList);
					}
				}
			} // context
			
		};
	}();
	
	var drawDefineText = function(engine, ctx, def, cxformList, clipping, dictionary) {
		def.matrix && ctx.transform.apply(ctx, def.matrix);
		
		var records = def.records;
		var font, x = 0, y = 0, height, color;
		var len = records.length;
		for(var i = 0; i < len; i++) {
			var record = records[i];
			if(record.fontId != null) {
				font = dictionary[record.fontId];
			}
			if(record.color != null) {
				color = record.color;
			}
			if(record.x != null) {
				x = record.x;
			}
			if(record.y != null) {
				y = record.y;
			}
			if(record.height != null) {
				height = record.height;
			}
			var glen = record.glyphs.length;
			for(var j = 0; j < glen; j++) {
				var glyph = record.glyphs[j];
				var ratio = height / 1024;
				ctx.transform(1, 0, 0, 1, x / 20, y / 20);
				ctx.transform(ratio, 0, 0, ratio, 0, 0);
				// renderFont: create my own fillStyle(type:0==solid_fill)
				renderShape(engine, ctx, [{color: color, type: FillStyleDefine.TypeSolidFill}], null, font.shapeTable[glyph.index], cxformList, clipping);
				
				ctx.transform(1 / ratio, 0, 0, 1 / ratio, 0, 0);
				ctx.transform(1, 0, 0, 1, -x / 20, -y / 20);
				x += glyph.advance;
			}
		}
		
		def.matrix && ctx.transform.apply(ctx, revTransform(def.matrix));
	};
	
	var drawDefineEditText = function(engine, ctx, def, cxformList, text, clipping) {
		if(def.useOutlines) {
			// TODO use font
		} else {
			var x1 = (def.bounds[0] + def.leftMargin) / 20;
			var x2 = (def.bounds[1] - def.rightMargin) / 20;
			var y1 = def.bounds[2] / 20;
			var y2 = def.bounds[3] / 20;

			ctx.beginPath();
			ctx.moveTo(x1,y1);
			ctx.moveTo(x1,y2);
			ctx.moveTo(x2,y2);
			ctx.moveTo(x2,y1);
			ctx.closePath();

			var fontHeight = def.height / 20;
			var columnHeight = (def.height + def.leading) / 20;
			var characterPerLine = ((def.wordWrap && def.multiline) ? Math.floor((x2 - x1) / fontHeight * 2) : 0);
			var drawStrings = splitString(text, characterPerLine); // TODO
			
			ctx.font = fontHeight + "px sans-serif";
			ctx.fillStyle = changeColor(cxformList, def.color); // TODO special care for device font alpha
			ctx.textBaseline = 'top';


			var x0 = 0, y0 = 0;
			switch(def.align) {
			case 1:
				// right
				ctx.textAlign='end';
				x0 = x2 - 4;
				y0 = y1 + 2;
				break;
			case 2:
				// center
				ctx.textAlign='center';
				x0 = (x1 + x2) / 2 + 2;
				y0 = y1 + 2;
				break;
			case 3:
				// TODO justify
			default:
				// left
				ctx.textAlign='start';
				x0 = x1 + 2;
				y0 = y1 + 2;
				break;
			}
			var len = drawStrings.length
			for(var i = 0; i < len; i++) {
				if(def.maxLength) {
					ctx.fillText(drawStrings[i], x0, y0, def.maxLength);
				} else {
					ctx.fillText(drawStrings[i], x0, y0);
				}
				y0 += columnHeight;
			}
		}
	};

	return function(engine, ctx, def, transform, cxformList, text, clipping) {
		switch(def.type) {
		case TagDefine.TypeTagDefineShape:
		case TagDefine.TypeTagDefineShape2:
		case TagDefine.TypeTagDefineShape3:
			// draw shape
			renderShape(engine, ctx, def.fillStyles, def.lineStyles, def.shapes, cxformList, clipping);
			break;
		case TagDefine.TypeTagDefineText:
		case TagDefine.TypeTagDefineText2:
			// draw text
			drawDefineText(engine, ctx, def, cxformList, clipping);
			break;
		case TagDefine.TypeTagDefineEditText:
			drawDefineEditText(engine, ctx, def, cxformList, text, clipping);
			break;
		}
	};
}();
