var createDrawFunction  = function() {
	var body = "";
	var enableStyleText = false;
	var createShapeFunction = function() {

		// set context
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

		var drawLineFunc = function(style, line) {
			body += "ctx.beginPath();/**/";
			setLineStyle(style);
			var len = line.length;
			for(var i = 0; i < len; i++) {
				var paths = line[i];
				body += "/**/ctx.moveTo(" + paths[0].x1 / 20 + "," + paths[0].y1 / 20 + ");";
				var plen = paths.length;
				for(var j = 0; j < plen; j++) {
					var path = paths[j];
					if(path.cx != null) {
						body += "/**/ctx.quadraticCurveTo(" + path.cx / 20 + "," + path.cy / 20 + "," + path.x2 / 20 + "," + path.y2 / 20 + ");";
					} else {
						body += "/**/ctx.lineTo(" + path.x2 / 20 + "," + path.y2 / 20 + ");"
					}
				}
			}
			body += "ctx.stroke();/**/";
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

		var setLineStyle = function(lineStyle) {
			if(lineStyle.width != null) {
				var lw = lineStyle.width / 20;
				body += "/**/ctx.lineWidth="+lw+"*drawScale<1?/**/1/drawScale:"+lw+";";
			}
			if(lineStyle.color != null) {
				body += "/**/ctx.strokeStyle=changeColor(cxformList," + lineStyle.color + ");";
			}
		};

		var setFillStyle = function(fillStyle) {
			var ret = null;
			switch(fillStyle.type) {
			case FillStyleDefine.TypeSolidFill:
				body += "/**/ctx.fillStyle=changeColor(cxformList," + fillStyle.color + ");";
				break;
			case FillStyleDefine.TypeRepeatingBitmapFill:
			case FillStyleDefine.TypeClippedBitmapFill:
			case FillStyleDefine.TypeNonSmoothedRepeatingBitmapFill:
			case FillStyleDefine.TypeNonSmoothedClipedBitmapFill:
				var t = fillStyle.matrix; // receive wrong matrix here
				ret = [t[0] / 20, t[1] / 20, t[2] / 20, t[3] / 20, t[4], t[5]];

				body += "/**/var img=dictionary[" + fillStyle.bitmapId + "].img;/**/";
				body += "/**/if(img.width==0&&img.height==0){return false;}";	// image is not loaded so exit
				body += "if(cxformList.length) {img=transformImageColor(cxformList,img);}/**/";
				body += "ctx.fillStyle=ctx.createPattern(img,'repeat');/**/";
				break;
			case FillStyleDefine.TypeLinearGradientFill:
			case FillStyleDefine.TypeRadialGradientFill:
				ret = fillStyle.matrix;
				body += "var grad;/**/";
				if(fillStyle.type == FillStyleDefine.TypeLinearGradientFill) {
					body += "grad=ctx.createLinearGradient(-16384 / 20, 0, 16384 / 20, 0);/**/";
				} else {
					body += "grad=ctx.createRadialGradient(0, 0, 0, 0, 0, 16384 / 20);/**/";
				}
				var len = fillStyle.gradient.records.length;
				for (var i = 0; i < len; i++) {
					var g = fillStyle.gradient.records[i];
					//grad.addColorStop(g.ratio / 255, transformColor(colorTransform, g.color));
					body += "/**/grad.addColorStop(" + g.ratio / 255 + ",changeColor(cxformList/**/, " + g.color + "));";
				}
				body += "ctx.fillStyle=grad;/**/";
				break;
			default:
				EngineLogE("renderShape.setFillStyle: unknown draw type called: " + fillStyle.type);
				break;
			}
			return ret;
		};

		var makeSimpleClippedBitmapFill = function(fill, fillStyle) {
			if(fillStyle.type != FillStyleDefine.TypeClippedBitmapFill) {
				return false;
			}
			var matrix = fillStyle.matrix;
			if(!matrix || Math.abs(matrix[0]) != Math.abs(matrix[3]) || matrix[1] != 0 || matrix[2] != 0) {
				return false;
			}

			if(fill.length != 1) {
				return false;
			}
			var paths = fill[0];
			if(paths.length != 4) {
				return false;
			}
			var vectors = [];
			for(var i = 0; i < 4; i++) {
				var path = paths[i];

				if(path.cx || path.cy) return false;

				vectors[vectors.length] = {
					x: path.x2 - path.x1,
					y: path.y2 - path.y1
				};
			}

			if(	(vectors[0].x == 0 && vectors[1].y == 0 && vectors[2].x == 0 && vectors[3].y == 0
					&& vectors[0].y == -vectors[2].y && vectors[1].x == -vectors[3].x)
				||
				(vectors[0].y == 0 && vectors[1].x == 0 && vectors[2].y == 0 && vectors[3].x == 0
					&& vectors[0].x == -vectors[2].x && vectors[1].y == -vectors[3].y)) {

				var mat2 = [matrix[0]/20, matrix[1], matrix[2], matrix[3]/20, matrix[4], matrix[5]];
				var bitmapId = fillStyle.bitmapId;
				body += "/**/var img=dictionary[" + bitmapId + "].img;/**/";
				body += "/**/if(img.width==0&&img.height==0){return false;}";
				body += "if(cxformList.length) {img=transformImageColor(cxformList,img);}/**/";
				body += "/**/ctx.transform(" + mat2.join() + ");"
				body += "ctx.drawImage(img, 0, 0);/**/";
				body += "/**/ctx.transform(" + revTransform(mat2).join() + ");"
				return true;
			}
			return false;
		}

		return function(fillStyles_, lineStyles_, shapes, clipping) {
			// initializing
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
			body += "ctx.lineCap='round';/**/";
			//body += "ctx.globalCompositeOperation='source-over';/**/";

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
							drawLineFunc(style, line);
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
						if(makeSimpleClippedBitmapFill(fill, fillStyles[j])) continue;
						if(!clipping) {
							var ft = setFillStyle(fillStyles[j]);
							if(ft) {
								body += "/**/ctx.transform(" + ft.join() + ");";
							}
							rt = (ft && revTransform(ft)) || null;
						}
						if(!clipping || (i == 0 && j == 0)) {
							// when clipping, execute beginPath only first time
							body += "ctx.beginPath();/**/";
						}

						var fflen = fill.length;
						for(var k = 0; k < fflen; k++) {
							var paths = fill[k];
							if(paths) {
								var from = repairPath(paths[0], rt);
								body += "/**/ctx.moveTo(" + from.x1 / 20 + "," + from.y1 / 20 + ");";
								var plen = paths.length;
								for(var l = 0; l < paths.length; l++) {
									var pathRepair = repairPath(paths[l], rt);
									if(pathRepair.cx != null) {
										body += "/**/ctx.quadraticCurveTo(" + pathRepair.cx / 20 + "," + pathRepair.cy / 20 + "," + pathRepair.x2 / 20 + "," + pathRepair.y2 / 20 + ");";
									} else {
										body += "/**/ctx.lineTo(" + pathRepair.x2 / 20 + "," + pathRepair.y2 / 20 + ");";
									}
								}
							}
						}

						if(clipping) {
							if(i == context.length - 1 && j == fillPaths.length - 1) {
								// clip execute only the last draw
								body += "ctx.clip();/**/";
								// On Android 3.x, 4.0.x,
								// composite operations except 'source-over' doesn't work
								// if CanvasRenderingContext2D#clip() is used (PFX-29)
								// redraw the content to avoid it
								body += "if(ctx.globalCompositeOperation!='source-over'){/**/";
								body += "ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';/**/";
								// clear extra area (width + 1)
								// Otherwise, Android default browser sometimes clears all area
								body += "ctx.globalAlpha=1;ctx.clearRect(0,0,ctx.canvas.width+1,ctx.canvas.height);/**/";
								body += "ctx.drawImage(copiedCanvas,0,0);ctx.restore();}/**/";
							}
						} else {
							body += "ctx.fill();/**/";
							if(rt) {
								body += "/**/ctx.transform(" + rt.join() +");";
							}
						}
					}
				} // fillPaths

				if(!clipping) {
					var llen = linePaths.length;
					for(var j = 0; j < llen; j++) {
						var line = linePaths[j];
						line && drawLineFunc(lineStyles[j], line);
					}
				}
			} // context

		};
	}();

	var drawDefineText = function(engine, def, clipping, dictionary) {
		if(def.matrix) {
			body += "/**/ctx.transform(" + def.matrix.join() + ");";
		}

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
				body += "/**/ctx.transform(1,0,0,1," + x / 20 + "," + y / 20 + ");";
				body += "/**/ctx.transform(" + ratio + ",0,0," + ratio + ",0,0);";
				// renderFont: create my own fillStyle(type:0==solid_fill)
				createShapeFunction([{color: color, type: FillStyleDefine.TypeSolidFill}], null, font.shapeTable[glyph.index], clipping);

				body += "/**/ctx.transform(" + 1 / ratio + ",0,0," + 1 / ratio + ",0,0);";
				body += "/**/ctx.transform(1,0,0,1," + (-x / 20) + "," + (-y / 20) + ");";
				x += glyph.advance;
			}
		}

		if(def.matrix) {
			body += "/**/ctx.transform(" + revTransform(def.matrix).join() + ");";
		}
	};

	var drawDefineEditText = function(engine, def, clipping, dictionary) {
		if(def.useOutlines) {
			var x1 = def.bounds[0] / 20 + 2;
			var x2 = def.bounds[1] / 20 - 2;
			var y1 = def.bounds[2] / 20 + 2;
			var y2 = def.bounds[3] / 20 - 2;
			// defineFontをglyphFontを使って描画する
			var font = dictionary[def.fontId];
			var ratio = def.height / 1024;

			var maxWidth = (x2 - x1) / ratio * 20;
			body += "/**/var font=dictionary[def.fontId];";
			body += "/**/var glyphInfo=makeGlyphInfo(text,"+maxWidth+","+x1+","+x2+","+y1+","+y2+",font,"+ratio+",def);/**/";
			body += "/**/var len = glyphInfo.length;";
			body += "/**/for (var line = 0; line < len; line++) {";
			body += "/**/var align = glyphInfo[line].align;";
			body += "/**/var indices = glyphInfo[line].indices;";
			body += "/**/ctx.save();";
			body += "/**/ctx.transform(1,0,0,1,"+x1+","+(y1+font.fontAscent*ratio/20.0)+");";
			body += "/**/ctx.transform("+ratio+",0,0,"+ratio+",0,0);";
			body += "/**/ctx.transform(1,0,0,1,align,0);";
			body += "/**/for(var l = 0; l < indices.length; l++) {";
			body += "/**/var index = indices[l];";
			body += "/**/var clippingState = "+(clipping ? "/**/{begin: l == 0 && line == 0, end: l == indices.length - 1}" : "null") + ";";
			body += "/**/eval(renderFont(/*ctx*/null,font,index,def.color,clippingState,/*colorTransform*/null,engine));";
			body += "/**/ctx.transform(1,0,0,1,font.fontAdvanceTable[index]/20.0,0);";
			body += "}";
			body += "/**/ctx.restore();";
			body += "/**/ctx.transform(1,0,0,1,0,"+(font.fontAscent+font.fontDescent)*ratio/20.0+");";
			body += "}";
			body += "/**/ctx.transform(1,0,0,1,0,"+(-(font.fontAscent+font.fontDescent)*ratio/20.0)+"*line);";
		} else {
			var x1 = (def.bounds[0] + def.leftMargin) / 20;
			var x2 = (def.bounds[1] - def.rightMargin) / 20;
			var y1 = def.bounds[2] / 20;
			var y2 = def.bounds[3] / 20;

			body += "/**/ctx.beginPath();";
			body += "/**/ctx.moveTo("+x1+","+y1+");";
			body += "/**/ctx.lineTo("+x1+","+y2+");";
			body += "/**/ctx.lineTo("+x2+","+y2+");";
			body += "/**/ctx.lineTo("+x2+","+y1+");";
			body += "/**/ctx.closePath();";

			var fontHeight = def.height / 20;
			var columnHeight = (def.height + def.leading) / 20;
			var characterPerLine = ((def.wordWrap && def.multiline) ? Math.ceil((x2 - x1) / fontHeight * 2) : 0);

			body += "/**/ctx.font = '"+fontHeight+"px sans-serif';";
			body += "/**/ctx.fillStyle=changeColor(cxformList," + def.color + ");"; // TODO special care for device font alpha
			body += "/**/ctx.textBaseline='top';";


			var x0 = 0, y0 = 0;
			switch(def.align) {
			case 1:
				// right
				body += "/**/ctx.textAlign='end';";
				x0 = x2 - 4;
				y0 = y1 + 2;
				break;
			case 2:
				// center
				body += "/**/ctx.textAlign='center';";
				x0 = (x1 + x2) / 2 + 2;
				y0 = y1 + 2;
				break;
			case 3:
				// TODO justify
			default:
				// left
				body += "/**/ctx.textAlign='start';";
				x0 = x1 + 2;
				y0 = y1 + 2;
				break;
        	}

			if(enableStyleText) {
				body += "/**/ctx.textAlign='start';";
				// original code is here: PFX-74
				// 'text' and 'color'will be mangled,
				// so use 'te' + 'xt' to access 'text' property of the JSON
				// In addition, jsObfuscator doesn't consider unquoted tokens in object literals as properties,
				// so quote the properties to mangle them as properties
				body += "/**/var styles_=[{'offset':0}],offsetDiff=0,textProp='te'+'xt',colorProp='co'+'lor';";
				body += "/**/text=text.replace(/(?:([\\r\\n]+)|\\{(\\{.*?\\})\\})/g,function(match_,crlf,json,offset){";
				// don't count CRLF because they are removed in `splitString`
				body += "/**/if(crlf){offsetDiff-=match_.length;return match_;}";
				body += "/**/var data_=JSON.parse(json);var text=data_[textProp]||'';var textLength=text.length;var actualOffset=offset+offsetDiff;";
				body += "/**/styles_.push({'offset':actualOffset,'color':data_[colorProp]});styles_.push({'offset':actualOffset+textLength});";
				body += "/**/offsetDiff-=match_.length-textLength;return text;});";
				body += "/**/var startPos=0,offset=0,defaultColor=changeColor(cxformList," + def.color + "),style_=styles_[0],nextStyle=styles_[1],j=0,drawString,endPos,offsetWidth_,partialString;/**/";
			}
			body += "/**/var drawStrings = splitString(text,"+characterPerLine+");";
			body += "/**/var len = drawStrings.length;";
			body += "/**/for(var i = 0, y = "+y0+"/**/; i < len; i++, y+="+columnHeight+") {";
			if(enableStyleText) {
				body += "/**/drawString=drawStrings[i];endPos=drawString.length+offset;offsetWidth_=0;";
				switch(def.align) {
				case 1:
					// right
					body += "/**/offsetWidth_-=ctx.measureText(drawString).width;";
					break;
				case 2:
					// center
					body += "/**/offsetWidth_-=ctx.measureText(drawString).width*0.5;";
					break;
				case 3:
					// TODO justify
					break;
        		}
				body += "/**/while(nextStyle&&nextStyle.offset<endPos){partialString=drawString.slice(startPos,nextStyle.offset-offset);";
				if(def.maxLength) {
					// FIXME: 'def.maxLength' should be changed in conjunction with the length of text
					body += "/**/ctx.fillText(partialString,"+x0+"+offsetWidth_,y,"+def.maxLength+");";
				} else {
					body += "/**/ctx.fillText(partialString,"+x0+"+offsetWidth_,y);/**/";
				}
				body += "/**/startPos=nextStyle.offset-offset;offsetWidth_+=ctx.measureText(partialString).width;";
				body += "/**/++j;style_=styles_[j];nextStyle=styles_[j+1];ctx.fillStyle=style_.color||defaultColor;}";
				body += "/**/startPos=style_.offset-offset;if(startPos<0){startPos=0;}";
				if(def.maxLength) {
					// FIXME: 'def.maxLength' should be changed in conjunction with the length of text
					body += "/**/ctx.fillText(drawString.slice(startPos),"+x0+"+offsetWidth_,y,/**/"+def.maxLength+");";
				} else {
					body += "/**/ctx.fillText(drawString.slice(startPos),"+x0+"+offsetWidth_,y);/**/";
				}
				body += "/**/offset+=drawString.length;startPos=0;";
			} else {
				if(def.maxLength) {
					body += "/**/ctx.fillText(drawStrings[i],"+x0+",y,"+def.maxLength + ");";
				} else {
					body += "/**/ctx.fillText(drawStrings[i],"+x0+",y);";
				}
			}
			body += "/**/};"
		}
	};

	return function(engine, def, clipping, dictionary) {
		body = "";
		enableStyleText = engine.option.enableStyleText;
		switch(def.type) {
		case TagDefine.TypeTagDefineShape:
		case TagDefine.TypeTagDefineShape2:
		case TagDefine.TypeTagDefineShape3:
			// draw shape
			createShapeFunction(def.fillStyles, def.lineStyles, def.shapes, clipping);
			break;
		case TagDefine.TypeTagDefineText:
		case TagDefine.TypeTagDefineText2:
			// draw text
			drawDefineText(engine, def, clipping, dictionary);
			break;
		case TagDefine.TypeTagDefineEditText:
			drawDefineEditText(engine, def, clipping, dictionary);
			break;
		}
		body += "return true";
		return new Function("/**/engine,ctx,def,transform,cxformList,text,changeColor,transformImageColor,splitString,drawScale,makeGlyphInfo,renderFont,copiedCanvas,dictionary", body);
	};
}();
