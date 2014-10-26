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


var revTransform = function(t) {
	var detT = (t[0] * t[3] - t[1] * t[2]);
	if(detT == 0) {
		EngineLogW("revTransform: detT == 0");
	}
	return [
		t[3] / detT,
		-t[1] / detT,
		-t[2] / detT,
		t[0] / detT,
		(t[2] * t[5] - t[3] * t[4]) / detT,
		(t[1] * t[4] - t[0] * t[5]) / detT
	];
};

var mulTransform = function(t1,t2) {
//
// | t1[0] t1[2] t1[4] |   | t2[0] t2[2] t2[4] |
// | t1[1] t1[3] t1[5] | * | t2[1] t2[3] t2[5] |
// | 0     0     1     |   | 0     0     1     |
//
// 	return [
//		t1[0] * t2[0] + t1[2] * t2[1],
//		t1[1] * t2[0] + t1[3] * t2[1],
//		t1[0] * t2[2] + t1[2] * t2[3],
//		t1[1] * t2[2] + t1[3] * t2[3],
//		t1[0] * t2[4] + t1[2] * t2[5] + t1[4],
//		t1[1] * t2[4] + t1[3] * t2[5] + t1[5]
//	];

	if (t1[2] == 0 && t1[1] == 0) {
		if(t2[2] == 0 && t2[1] == 0) {
			return [
				t1[0] * t2[0],
				0,
				0,
				t1[3] * t2[3],
				t1[0] * t2[4] + t1[4],
				t1[3] * t2[5] + t1[5]
			];
		} else {
			return [
				t1[0] * t2[0],
				t1[3] * t2[1],
				t1[0] * t2[2],
				t1[3] * t2[3],
				t1[0] * t2[4] + t1[4],
				t1[3] * t2[5] + t1[5]
			];
		}
	} else {
		if(t2[2] == 0 && t2[1] == 0) {
			return [
				t1[0] * t2[0],
				t1[1] * t2[0],
				t1[2] * t2[3],
				t1[3] * t2[3],
				t1[0] * t2[4] + t1[2] * t2[5] + t1[4],
				t1[1] * t2[4] + t1[3] * t2[5] + t1[5]
			];
		} else {
			return [
				t1[0] * t2[0] + t1[2] * t2[1],
				t1[1] * t2[0] + t1[3] * t2[1],
				t1[0] * t2[2] + t1[2] * t2[3],
				t1[1] * t2[2] + t1[3] * t2[3],
				t1[0] * t2[4] + t1[2] * t2[5] + t1[4],
				t1[1] * t2[4] + t1[3] * t2[5] + t1[5]
			];
		}
	}
};

var transformRect = function(trans, rect, twips) {
	var ret = [];
	
	var x1 = rect[0];
	var x2 = rect[1];
	var y1 = rect[2];
	var y2 = rect[3];

	var w = x2-x1;
	var h = y2-y1;

	var xy0 = twips ? [trans[0]*x1 + trans[2]*y1 + trans[4], trans[1]*x1 + trans[3]*y1 + trans[5]] : transformXY(trans, x1, y1);
	var dx1 = trans[0] * w;
	var dy1 = trans[1] * w;
	var dx2 = trans[2] * h;
	var dy2 = trans[3] * h;

	if(dx1 >= 0) {
		if(dx2 >= 0) {
			ret[1] = xy0[0] + dx1 + dx2;
			ret[0] = xy0[0];
		} else {
			ret[1] = xy0[0] + dx1;
			ret[0] = xy0[0] + dx2;
		}
	} else {
		if(dx2 >= 0) {
			ret[1] = xy0[0] + dx2;
			ret[0] = xy0[0] + dx1;
		} else {
			ret[1] = xy0[0];
			ret[0] = xy0[0] + dx1 + dx2;
		}
	}

	if(dy1 >= 0) {
		if(dy2 >= 0) {
			ret[3] = xy0[1] + dy1 + dy2;
			ret[2] = xy0[1];
		} else {
			ret[3] = xy0[1] + dy1;
			ret[2] = xy0[1] + dy2;
		}
	} else {
		if(dy2 >= 0) {
			ret[3] = xy0[1] + dy2;
			ret[2] = xy0[1] + dy1;
		} else {
			ret[3] = xy0[1];
			ret[2] = xy0[1] + dy1 + dy2;
		}
	}

	// ret[0] = Math.min(xy0[0], xy0[0] + dx1, xy0[0] + dx2, xy0[0] + dx1 + dx2);
	// ret[1] = Math.max(xy0[0], xy0[0] + dx1, xy0[0] + dx2, xy0[0] + dx1 + dx2);
	// ret[2] = Math.min(xy0[1], xy0[1] + dy1, xy0[1] + dy2, xy0[1] + dy1 + dy2);
	// ret[3] = Math.max(xy0[1], xy0[1] + dy1, xy0[1] + dy2, xy0[1] + dy1 + dy2);

	return ret;
};
	
var stringColor = function(val) {
	var a = [(val >> 16) & 0xFF, (val >> 8) & 0xFF, (val) & 0xFF, ((val >> 24) & 0xFF) / 255];
	
	return "rgba(" + a.join() + ")";
//	var str = "00000" + val.toString(16);
//	return "#" + str.substring(str.length - 6, str.length);
};

var compareTransform = function(t1, t2, ignoreTranslate) {
	var round100 = function(a) { return Math.round(a*100);}

    if(ignoreTranslate) {
        if(round100(t1[2]) == round100(t2[2]) && round100(t1[0]) == round100(t2[0])
            && round100(t1[3]) == round100(t2[3]) && round100(t1[1]) == round100(t2[1])) {
                return true;
        }
    } else {
        if(round100(t1[4]) == round100(t2[4]) && round100(t1[5]) == round100(t2[5])
            && round100(t1[2]) == round100(t2[2]) && round100(t1[0]) == round100(t2[0])
            && round100(t1[3]) == round100(t2[3]) && round100(t1[1]) == round100(t2[1])) {
                return true;
        }
    }
    return false;
};

var compareColorTransform = function(c1, c2) {
    if(c1.length != c2.length) {
        return false;
    }

	var len = c1.length;
    for(var i = 0; i < len; i++) {
		var c1i = c1[i];
		var c2i = c2[i];
        for(var j = 0; j < 8; j++) {
            if(c1i[j] != c2i[j]) {
                return false;
            }
        }
    }
    return true;
};

var changeColor = function(cxformList, val) {
	var len = cxformList.length;
	if(!len) {
		return stringColor(val);
	}
	
	var a = [(val >> 16) & 0xFF, (val >> 8) & 0xFF, (val) & 0xFF, (val >> 24) & 0xFF];
	for(var i = len - 1; i >= 0; i--) {
		var cxform = cxformList[i];
		a[0] = Math.max(0, Math.min(255, ((a[0]) * cxform[0] / 256) + cxform[4])) | 0;
		a[1] = Math.max(0, Math.min(255, ((a[1]) * cxform[1] / 256) + cxform[5])) | 0;
		a[2] = Math.max(0, Math.min(255, ((a[2]) * cxform[2] / 256) + cxform[6])) | 0;
		a[3] = Math.max(0, Math.min(255, ((a[3]) * cxform[3] / 256) + cxform[7]));
	}
	a[3] /= 255;
	
	return "rgba(" + a.join() + ")";
};

var cacheTransformImageColor = function(cacheController) {
	return function(cxformList, img) {
		// return if the image has not been drawn yet
		if(!img.width) {
			return img;
		}
		
		var len = cxformList.length;
		if(!len) {
			return img;
		}
		var w = img.width;
		var h = img.height;
		
		// search cache
		var key = w * h;
		for(var i = 0; i < len; i++) {
			key += "-" + cxformList[i].join();
		}
		var output = cacheController.getColoredImage(key, img);
		if(output) {
			return output;
		}
		
		// not hit
		output = transformImageColor(cxformList, img);
		
		// save cache
		cacheController.cacheColoredImage(key, img, output);
		
		// erase transformImageColor's cache
		transformImageColor.output = null;
		return output;
	}
};

var transformImageColorUsingBlendMode = function(cxformList, img) {
	// return if the image has not been drawn yet
	if(!img.width) {
		return img;
	}

	var len = cxformList.length;
	if(!len) {
		return img;
	}

	var w = img.width;
	var h = img.height;

	var output = transformImageColor.output || (transformImageColor.output = CacheController.getFreeCanvas());
	output.width = w;
	output.height = h;
	var octx = output.getContext("2d");

	if(cxformList.length === 1) {
		var cxform = cxformList[0];
		if(cxform[0] === 256 && cxform[1] === 256 && cxform[2] === 256 && cxform[4] === 0 && cxform[5] === 0 && cxform[6] === 0) {
			octx.globalAlpha = cxform[3] / 256;
			octx.drawImage(img, 0, 0);
			// Ignore cxform[7] same as original transformImageColor for the performance
			// (I think this is a bug)
			return output;
		}
	}
	octx.drawImage(img, 0, 0);

	// Remove transparency to process RGB channel and alpha channel separately
	// (blend-mode seems to remove transparency)
	octx.globalCompositeOperation = "multiply";
	octx.fillStyle = "rgba(255,255,255,1)";
	octx.fillRect(0, 0, w, h);

	var alphaCanvas = transformImageColor.alphaCanvas || (transformImageColor.alphaCanvas = CacheController.getFreeCanvas());
	alphaCanvas.width = w;
	alphaCanvas.height = h;
	var actx = alphaCanvas.getContext("2d");
	actx.drawImage(img, 0, 0);
	actx.globalCompositeOperation = "source-atop";
	actx.fillStyle = "rgba(255,255,255,1)";
	actx.fillRect(0, 0, w, h);

	for(var j = len - 1; j >= 0; j--) {
		var cxform = cxformList[j];

		// Multiply colors
		var rgbcolors = [];
		var colorChanged = false;
		for(var colorIndex = 0; colorIndex < 3; colorIndex++) {
			if(cxform[colorIndex] != 256) {
				colorChanged = true;
			}
			rgbcolors.push(cxform[colorIndex] / 256 * 255 | 0);
		}
		if(colorChanged) {
			octx.globalCompositeOperation = "multiply";
			octx.fillStyle = "rgb(" + rgbcolors.join() + ")";
			octx.fillRect(0, 0, w, h);
		}

		// Add colors
		var addedColors = [];
		var hasAdded = false;
		var subtractedColors = [];
		var hasSubtracted = false;
		for(var colorIndex = 4; colorIndex < 7; colorIndex++) {
			var colorVal = cxform[colorIndex];
			if(colorVal === 0) {
				addedColors.push(0);
				subtractedColors.push(0);
			} else if(colorVal > 0) {
				addedColors.push(colorVal);
				subtractedColors.push(0);
				hasAdded = true;
			} else {
				addedColors.push(0);
				subtractedColors.push(-colorVal);
				hasSubtracted = true;
			}
		}

		if(hasAdded) {
			octx.globalCompositeOperation = "lighter";
			octx.fillStyle = "rgba(" + addedColors.join() + ",1)";
			octx.fillRect(0, 0, w, h);
		}
		if(hasSubtracted) {
			octx.globalCompositeOperation = "difference";
			octx.fillStyle = "rgba(255,255,255,1)";
			octx.fillRect(0, 0, w, h);

			octx.globalCompositeOperation = "lighter";
			octx.fillStyle = "rgba(" + subtractedColors.join() + ",1)";
			octx.fillRect(0, 0, w, h);

			octx.globalCompositeOperation = "difference";
			octx.fillStyle = "rgba(255,255,255,1)";
			octx.fillRect(0, 0, w, h);
		}

		// Transform alpha
		if(cxform[3] < 256) {
			actx.globalCompositeOperation = "destination-in";
			actx.globalAlpha = cxform[3] / 256;
			actx.fillRect(0, 0, w, h);
		}
		if(cxform[7]) {
			// maybe work well but not supported
			// (the case where cxform[7] is a negative value is not supported)
			if(cxform[7] > 0) {
				actx.globalCompositeOperation = "lighter";
				actx.globalAlpha = cxform[7] / 255; // cxform[7] == addAlpha
				actx.fillRect(0, 0, w, h);
			}
			EngineLogW("[transformImageColor] addAlpha detected. not support");
		}
	}

	// alpha mask
	octx.globalCompositeOperation = "destination-in";
	octx.globalAlpha = 1;
	octx.drawImage(alphaCanvas, 0, 0);
	return output;
};

var transformImageColor = (function() {
	// don't define `splitRegion` not to call a function for the performance if not required
	// cf. http://jsperf.com/call-a-function-vs-assign-a-return-value-directly
	var splitRegion = null;
	if (navigator.userAgent.toLowerCase().match(/chrome\/(\d+)/) && RegExp.$1 < 27) {
		var regions;
		// Chrome 26 or before with GPU accelerated canvas doens't support 'darker'.
		// GPU accelerated canvas is disabled if the size of canvas is less than or equal to 2^16
		// (or the width or the height is larger than 2^12).
		// SBrowser (the default browser of Galaxy S4) is derived from Chrome 18
		// and this code is the workaround for SBrowser.
		var addRegions = function(dx, dy, width, height) {
			if(width * height > 65536) {
				if(width > height) {
					var halfWidth = (width * 0.5) | 0;
					addRegions(dx, dy, halfWidth, height);
					addRegions(dx + halfWidth, dy, width - halfWidth, height);
				} else {
					var halfHeight = (height * 0.5) | 0;
					addRegions(dx, dy, width, halfHeight);
					addRegions(dx, dy + halfHeight, width, height - halfHeight);
				}
			} else {
				regions.push([dx, dy, width, height]);
			}
		};

		splitRegion = function(width, height) {
			regions = [];
			// split regions to make the size less than or equal to 2^16
			addRegions(0, 0, width, height);
			return regions;
		};
	}

	var colors = ["#ff0000", "#00ff00", "#0000ff"];

	var applyColor = function(ctx, cxformList, width, height, colorIndex, color) {
		for(var j = cxformList.length - 1; j >= 0; j--) {
			var cxform = cxformList[j];
			if(cxform[colorIndex] != 256) {
				ctx.globalCompositeOperation = "source-over";
				ctx.fillStyle = "rgb(0,0,0)";
				ctx.globalAlpha = 1 - cxform[colorIndex] / 256; // mul
				ctx.fillRect(0, 0, width, height);
			}

			if(cxform[colorIndex + 4] != 0) {
				var alpha = cxform[colorIndex + 4] / 255; // add
				if(alpha < 0) {
					ctx.globalCompositeOperation = "darker";
					ctx.fillStyle = "rgb(0,0,0)";
					alpha = -alpha;
				} else {
					ctx.globalCompositeOperation = "lighter";
					ctx.fillStyle = color;
				}
				ctx.globalAlpha = alpha;
				ctx.fillRect(0, 0, width, height);
			}
		}
	};

	var tmpCanvas = document.createElement("canvas");
	tmpCanvas.width = tmpCanvas.height = 1;
	var tmpCtx = tmpCanvas.getContext("2d");
	tmpCtx.globalCompositeOperation = "difference";
	if(tmpCtx.globalCompositeOperation === "difference") {
		tmpCtx.globalCompositeOperation = "multiply";
		if(tmpCtx.globalCompositeOperation === "multiply") {
			return transformImageColorUsingBlendMode;
		}
	}

	return function(cxformList, img) {
		// return if the image has not been drawn yet
		if(!img.width) {
			return img;
		}
		
		var len = cxformList.length;
		if(!len) {
			return img;
		}
		var w = img.width;
		var h = img.height;
		
		var output = transformImageColor.output || (transformImageColor.output = CacheController.getFreeCanvas());
		output.width = w;
		output.height = h;
		var octx = output.getContext("2d");

		if(cxformList.length == 1) {
			var cxform = cxformList[0];
			if(cxform[0] == 256 && cxform[1] == 256 && cxform[2] == 256 && cxform[4] == 0 && cxform[5] == 0 && cxform[6] == 0) {
				octx.globalAlpha = cxform[3]/256;
				octx.drawImage(img, 0, 0);
				return output;
			}
		}
		
		// create alpha
		var alphaCanvas = transformImageColor.alphaCanvas || (transformImageColor.alphaCanvas = CacheController.getFreeCanvas());
		alphaCanvas.width = w;
		alphaCanvas.height = h;
		
		var actx = alphaCanvas.getContext("2d");
		actx.drawImage(img, 0, 0);
		actx.globalCompositeOperation = "source-atop";
		actx.fillStyle = "rgba(255,255,255,1)";
		actx.fillRect(0, 0, w, h);
		
		// alpha transform
		for(var j = len - 1; j >= 0; j--) {
			var cxform = cxformList[j];
			actx.globalCompositeOperation = "destination-in";
			actx.globalAlpha = Math.min(Math.max(0, cxform[3] / 256), 1); // cxform[3] === mulAlpha
			actx.fillRect(0, 0, w, h);

			if(cxform[7]) {
				actx.globalCompositeOperation = "lighter"; // wrong
				actx.fillStyle = "rgba(255,255,255,1)";
				actx.globalAlpha = cxform[7] / 255; // cxform[7] == addAlpha
				actx.fillRect(0, 0, w, h);
				EngineLogW("[transformImageColor] addAlpha detected. not support");
				// maybe work well but not supported
			}
		}
		
		var isGlay = true;
		for(var j = len - 1; j >= 0; j--) {
			var cxform = cxformList[j];
			var mul = cxform[0];
			var add = cxform[4];
			if(mul != cxform[1] || mul != cxform[2] || add != cxform[5] || add != cxform[6]) {
				isGlay = false;
				break;
			}
		}
		
		var imageRegions = (splitRegion && splitRegion(w, h)) || [[0, 0, w, h]];
		if(isGlay) {
			var color = "rgb(255,255,255)";
			if(imageRegions.length === 1) {
				octx.drawImage(img, 0, 0);
				applyColor(octx, cxformList, w, h, 0, color);
			} else {
				var regionCanvas = transformImageColor.regionCanvas || (transformImageColor.regionCanvas = CacheController.getFreeCanvas());
				var rctx = regionCanvas.getContext("2d");
				for(var i = imageRegions.length - 1; i >= 0; i--) {
					var region = imageRegions[i];
					var rx = region[0];
					var ry = region[1];
					var rw = regionCanvas.width = region[2];
					var rh = regionCanvas.height = region[3];
					rctx.drawImage(img, rx, ry, rw, rh, 0, 0, rw, rh);
					applyColor(rctx, cxformList, rw, rh, 0, color);
					octx.drawImage(regionCanvas, rx, ry);
				}
			}
		} else {
			var rgbctx = transformImageColor.rgbCtx || (transformImageColor.rgbCtx = []);
			var rgbCanvas = transformImageColor.rgbCanvas || (transformImageColor.rgbCanvas = []);
			for(var regionIndex = imageRegions.length - 1; regionIndex >= 0; regionIndex--) {
				var region = imageRegions[regionIndex];
				var rx = region[0];
				var ry = region[1];
				var rw = region[2];
				var rh = region[3];
				// create rgb
				for(var i = 0; i < 3; i++) {
					var cCanvas = rgbCanvas[i] || (rgbCanvas[i] = CacheController.getFreeCanvas());
					cCanvas.width = rw;
					cCanvas.height = rh;
					var cctx = rgbctx[i] || (rgbctx[i] = cCanvas.getContext("2d"));
					cctx.drawImage(img, rx, ry, rw, rh, 0, 0, rw, rh);
					cctx.globalCompositeOperation = "darker";
					cctx.fillStyle = colors[i];
					cctx.fillRect(0, 0, rw, rh);
				}

				// rgb transform
				octx.globalCompositeOperation = "lighter";
				for(var i = 0; i < 3; i++) {
					applyColor(rgbctx[i], cxformList, rw, rh, i, colors[i]);
					octx.drawImage(rgbCanvas[i], rx, ry);
				}
			}
		}
		
		// alpha mask
		octx.globalCompositeOperation = "destination-in";
		octx.globalAlpha = 1;
		octx.drawImage(alphaCanvas, 0, 0);
		return output;
	};
})();

var splitString = function(targetString, maxLineWidth) {
	targetString = targetString.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

	if(maxLineWidth == 0) {
		return targetString.split("\n");
	}

	var lines = [];
	var currentLine = "";
	var currentLineWidth = 0;
	var currentWordWidth = 0;
	var currentWord = "";
	var targetStrLen = targetString.length;
	for(var charIndex = 0; charIndex < targetStrLen; charIndex++) {
		var currentChar = targetString.charAt(charIndex);
		var charWidth = isHankaku(currentChar) ? 1 : 2;
		if(currentChar == "\n") {
			// Force newline for "\n"
			if(currentLineWidth + currentWordWidth > maxLineWidth) {
				lines.push(currentLine);
				lines.push(currentWord);
			} else {
				lines.push(currentLine + currentWord);
			}

			currentLine = "";
			currentLineWidth = 0;
			currentWord = "";
			currentWordWidth = 0;
		} else {
			if(currentWordWidth + charWidth > maxLineWidth) {
				if(currentLine == "") {
					lines.push(currentWord);
				} else {
					lines.push(currentLine);
					lines.push(currentWord);
					currentLine = "";
					currentLineWidth = 0;
				}
				currentWord = "";
				currentWordWidth = 0;
			}
			currentWord += currentChar;
			currentWordWidth += charWidth;
		}

		if(currentChar == " " || charIndex == targetStrLen - 1) {
			if(currentLineWidth + currentWordWidth > maxLineWidth) {
				// If currentLineWidth + latest letter is greater than maxLineWidth then go to newline and begin with it.
				lines.push(currentLine);
				currentLine = currentWord;
				currentLineWidth = currentWordWidth;
			} else {
				currentLine += currentWord;
				currentLineWidth += currentWordWidth;
			}
			currentWord = "";
			currentWordWidth = 0;
		}
	}
	lines.push(currentLine);

	return lines;
};

var getTextOfEditText = function(mc, def) {
	var text = def.initialText;

	var variableName = def.variableName;

	if(variableName) {
		var absoluteVariableName;
		if(variableName.charAt(0) == '/' || variableName.charAt(0) == '.') {
			absoluteVariableName = variableName;
		} else {
			absoluteVariableName = mc.absoluteName+":"+variableName;
		}

		var ret = getMovieClipAndTextFromSyntax(mc, absoluteVariableName);
		if(ret[0]) {
			var value = ret[0].variables[ret[1]];
			if(typeof(value) === "undefiend") {
				EngineLogW("Cannot found:"+variableName, mc, def);
			} else {
				text = value + "";
			}
		} else {
			EngineLogW("Invalid movie clip name specified:" +variableName, mc, def);
		}
	}

	return text;
}

/** フォントの描画 */
var renderFont = function(ctx, font, index, color, clippingState, colorTransform, engine) {
	var body = "";
	// fontの構造を取り出す
	var glyph = font.shapeTable[index];

	var fillStyles = [ {cmd: "SolidFill", color: color, type: FillStyleDefine.TypeSolidFill} ];
	//renderShape(ctx, null, fillStyles, glyph.shape.objects, clippingState, colorTransform, engine);
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
			if(!matrix || matrix[0] != matrix[3] || matrix[1] != 0 || matrix[2] != 0) {
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
								// Otherwise, Android default browser sometimes clear all area
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
	createShapeFunction(fillStyles, null, glyph, clippingState);//, /*colorTransform*/[], engine);

	return body;
};

var makeGlyphInfo = function(drawString, maxWidth, x1, x2, y1, y2, font, ratio, def) {
	var glyphInfo = [];

	var currentIndex = 0;
	var lines = 0;
	var strLen = drawString.length;
	var textWidth;
	var indices;
	var nextWordIndices;
	var nextWordWidth;
	while(currentIndex < strLen) {
		textWidth = 0;
		indices = [];
		nextWordIndices = [];
		nextWordWidth = 0;
		for(; currentIndex < strLen; currentIndex++) {
			var c = drawString.charCodeAt(currentIndex);
			var index = -1;
			if(def.multiline == 1 && c == 10) {  // the character is "\n"
				if(textWidth + nextWordWidth > maxWidth) {
					currentIndex -= nextWordIndices.length - 1;
					break;
				} else {
					currentIndex++;
					indices = indices.concat(nextWordIndices);
					textWidth += nextWordWidth;
				}
				break;
			}

			for(var i in font.codeTable) {
				if(font.codeTable[i] == c) {
					index = i;
					break;
				}
			}
			if(index != -1) {
				var advance = font.fontAdvanceTable[index];
				// one word larger than max width
				if(nextWordWidth + advance > maxWidth) {
					if(indices.length) {
						currentIndex -= nextWordIndices.length;
					} else {
						// one letter but larger than maxwith, line break if it's the first letter of the new line
						// otherwise, new line for the word so far
						if(advance > maxWidth && nextWordIndices.length == 0) {
							indices.push(index);
							textWidth = advance;
							currentIndex++;
							break;
						}
						indices = indices.concat(nextWordIndices);
						textWidth += nextWordWidth;
					}
					break;
				} else {
					nextWordIndices.push(index);
					nextWordWidth += advance;
				}
				// if space or end of the string then check if the line width exceeded
				if(c == 32 || currentIndex == strLen - 1) {
					if(def.multiline == 1 && def.wordWrap == 1 && textWidth + nextWordWidth > maxWidth) {
						currentIndex -= nextWordIndices.length - 1;
						break;
					}
					indices = indices.concat(nextWordIndices);
					textWidth += nextWordWidth;
					nextWordWidth = 0;
					nextWordIndices = [];
				}
			}
		}

		var align = 0;
		switch(def.align) {
		case 1:
			// right: 右によせる
			align = (x2 - x1) / ratio * 20 - textWidth;
			break;
		case 2:
		case 3:
			// center: 真ん中を計算して移動する
			align = ((x2 - x1) / ratio * 20 - textWidth) / 2;
			break;
		default:
			// left ならばやることはない
			break;
		}
		glyphInfo.push({ indices: indices, align: align / 20.0 });
	}
	return glyphInfo;
};

// Android default browser on L-05E, F-06E, and 202F with Android 4.2.2
// fills a visible canvas with a single color
// if the following conditions are met:
//  1. other visible DOM elements except HTMLCanvasElement exist on the page
//  2. the size of canvas is larger than 2^16
//  3. both of the width of the canvas and the height are smaller than 2^12
// cf. PFX-63
var expandCanvas = function(canvas) {
	var canvasWidth = canvas.width;
	var canvasHeight = canvas.height;
	if(canvasWidth * canvasHeight <= 65536 || canvasWidth >= 4096 || canvasHeight >= 4096) {
		return;
	}
	var clipper = document.createElement("div");
	clipper.style.width = canvasWidth + "px";
	clipper.style.height = canvasHeight + "px";
	clipper.style.overflow = "hidden";

	var parent = canvas.parentNode;
	parent.insertBefore(clipper, canvas);
	parent.removeChild(canvas);
	clipper.appendChild(canvas);

	if(canvasWidth > canvasHeight) {
		canvas.width = 4096;
	} else {
		canvas.height = 4096;
	}
};
