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


// static class
var ImageManager = {
	jpegTables: null,

	createImageFromLossless: function(sdata, pixelSize, tableSize, width, height, alpha) {
		var data = (new Zlib.Inflate(sdata)).decompress();
		
		var canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		var ctx = canvas.getContext('2d');
		var output = ctx.createImageData(width, height);
		var outputData = output.data;
		var outputIndex = 0;
		var inputIndex = 0;

		if (pixelSize == 8) {
			var aryR = new Array(tableSize);
			var aryG = new Array(tableSize);
			var aryB = new Array(tableSize);
			var aryA = new Array(tableSize);
			if(alpha) {
				// SWF files store multiplied values for lossless, therefore we need to convert to non-multiplied values.
				if(this.usePremultipliedAlpha) {
					// BUT, native android browser accepts multiplied values in violation of Canvas specification.
					for (var i = 0; i < tableSize; i++) {
						aryR[i] = data[inputIndex++];
						aryG[i] = data[inputIndex++];
						aryB[i] = data[inputIndex++];
						aryA[i] = data[inputIndex++];
					}
				} else {
					for (var i = 0; i < tableSize; i++) {
						var r = data[inputIndex++];
						var g = data[inputIndex++];
						var b = data[inputIndex++];
						var a = data[inputIndex++];
						if(a==255 || a==0) {
							aryR[i] = r;
							aryG[i] = g;
							aryB[i] = b;
						} else {
							var aInverse = 255/a;
							aryR[i] = ~~(r * aInverse);
							aryG[i] = ~~(g * aInverse);
							aryB[i] = ~~(b * aInverse);
						}
						aryA[i] = a;
					}
				}
			} else {
				for (var i = 0; i < tableSize; i++) {
					aryR[i] = data[inputIndex++];
					aryG[i] = data[inputIndex++];
					aryB[i] = data[inputIndex++];
					aryA[i] = 255;
				}
			}

			var paddingWidth = Math.ceil(width / 4.0) * 4;
			var buff = data.slice ? data.slice(inputIndex) : data.subarray(inputIndex);

			var colorIndex;
			for (var y = 0; y < height; y++) {
				for (var x = 0, index = y * paddingWidth; x < width; x++, index++) {
					colorIndex = buff[index] & 0xFF;
					outputData[outputIndex++] = aryR[colorIndex];
					outputData[outputIndex++] = aryG[colorIndex];
					outputData[outputIndex++] = aryB[colorIndex];
					outputData[outputIndex++] = aryA[colorIndex];
				}
			}
		} else if (pixelSize == 16) {
			var usePadding = width % 2 != 0;
			for (var y = 0; y < height; y++) {
				for (var x = 0; x < width; x++) {
					var rgb15 = (data[inputIndex] << 8) + data[inputIndex + 1];
					inputIndex += 2;
					var r5 = (rgb15 & 0x7C00) >>> 10; // 01111100 00000000
					var g5 = (rgb15 & 0x03E0) >>> 5;  // 00000011 11100000
					var b5 = (rgb15 & 0x001F) >>> 0;  // 00000000 00011111
					outputData[outputIndex++] = (r5 << 3) + (r5 >>> 2);
					outputData[outputIndex++] = (g5 << 3) + (g5 >>> 2);
					outputData[outputIndex++] = (b5 << 3) + (b5 >>> 2);
					outputData[outputIndex++] = 255;
				}
				if (usePadding) {
					inputIndex += 2;
				}
			}
		} else if (pixelSize == 24) {
			for (var y = 0; y < height; y++) {
				for (var x = 0; x < width; x++) {
					inputIndex++;
					outputData[outputIndex++] = data[inputIndex++];
					outputData[outputIndex++] = data[inputIndex++];
					outputData[outputIndex++] = data[inputIndex++];
					outputData[outputIndex++] = 255;
				}
			}
		} else if (pixelSize == 32) {
			if(this.usePremultipliedAlpha) {
				// ARGB -> RGBA
				for (var y = 0; y < height; y++) {
					for (var x = 0; x < width; x++) {
						var a = data[inputIndex++];
						outputData[outputIndex++] = data[inputIndex++];
						outputData[outputIndex++] = data[inputIndex++];
						outputData[outputIndex++] = data[inputIndex++];
						outputData[outputIndex++] = a;
					}
				}
			} else {
				// Need to convert from non-multiplied to multiplied.
				for (var y = 0; y < height; y++) {
					for (var x = 0; x < width; x++) {
						var a = data[inputIndex++];
						if(a == 255 || a == 0) {
							outputData[outputIndex++] = data[inputIndex++];
							outputData[outputIndex++] = data[inputIndex++];
							outputData[outputIndex++] = data[inputIndex++];
						} else {
							var aInverse = 255/a;
							for (var i=0; i < 3; i++) {
								var val = ~~(data[inputIndex++] * aInverse);
								outputData[outputIndex++] = 255 > val ? val:255;
							};
						}
						outputData[outputIndex++] = a;
					}
				}
			}
		}

		ctx.putImageData(output, 0, 0);
		return canvas;
	},
	createImageFromJpeg: function(sdata, dataStore) {
		var data = ImageManager.correctJpegImageData(sdata);
		return ImageManager.createImageFromJpegData(data, dataStore);
	},
	createImageFromJpegAndAlpha: function(sdata, alpha, dataStore) {
		var data = ImageManager.correctJpegImageData(sdata);
		var alphaData = (new Zlib.Inflate(alpha)).decompress();

		var b64_string = ImageManager.arrayToBase64String(data);
		var image = document.createElement("img");
		var canvas = document.createElement("canvas");
		// to check the image is loaded or not
		canvas.width = 0;
		canvas.height = 0;

		var usePremultipliedAlpha = this.usePremultipliedAlpha;
		image.onload = function() {
			var width = image.width;
			var height = image.height;

			canvas.width = width;
			canvas.height = height;
			var ctx = canvas.getContext('2d');
			ctx.drawImage(image, 0, 0);
			var imageData = ctx.getImageData(0, 0, width, height);
			var data = imageData.data;

			var len = width*height;
			var alpha;
			
			// The raw image data is already pre-multiplied by alpha/255
			if(usePremultipliedAlpha) {
				// RGB values will be divided by alpha/255 implicitly in putImageData
				// and can be larger than 255 by this implicit operation.
				// To make sure that RGB values will be not larger than 255 after putImageData,
				// reduce the values if they are larger than the alpha value
				for(var i = 0, j = 3; i < len; i++, j+=4) {
					alpha = data[j] = alphaData[i];
					if(alpha == 0) {
						data[j-1] = data[j-2] = data[j-3] = 0;
					} else if(alpha != 255) {
						if(alpha < data[j-1]) {
							data[j-1] = alpha;
						}
						if(alpha < data[j-2]) {
							data[j-2] = alpha;
						}
						if(alpha < data[j-3]) {
							data[j-3] = alpha;
						}
					}
				}
			} else {
				var aInverse;
				for(var i = 0, j = 3; i < len; i++, j+=4) {
					alpha = data[j] = alphaData[i];
					if (alpha != 255 && alpha != 0) {
						// convert premultiplied RGBA to non-premultiplied RGBA
						aInverse = 255/alpha;
						data[j-1] = ~~(data[j-1]*aInverse);
						data[j-2] = ~~(data[j-2]*aInverse);
						data[j-3] = ~~(data[j-3]*aInverse);
					}
				}
			}
			ctx.putImageData(imageData, 0, 0);
			--dataStore.loadingImageCount;
		};
		image.src = "data:image/jpeg;base64,"+ b64_string;
		++dataStore.loadingImageCount;

		// Android default browser on Android 3.x often never calls image.onload function
		// if doesn't call setTimeout function in this function (#544)
		setTimeout(function() {}, 0);

		return canvas;
	},
	createImageFromJpegTableAndBits: function(table, sdata, dataStore) {
		var data;
		if (table == null || table.length < 4) {
			data = sdata;
		} else {
			table = table.jpegData;
			data = table.slice(0, table.length - 2).concat(sdata.slice(2));
		}

		return ImageManager.createImageFromJpegData(data, dataStore);
	},
	createImageFromJpegData: function(data, dataStore) {
		var image = document.createElement("img");
		// to check the image is loaded or not
		
		image.onload = function() {
			--dataStore.loadingImageCount;
		};
		image.src = "data:image/jpeg;base64," + ImageManager.arrayToBase64String(data);
		++dataStore.loadingImageCount;

		return image;
	},
	correctJpegImageData: function(sdata) {
		var data;
		if (sdata[0] == 0xFF && sdata[1] == 0xD9 && sdata[2] == 0xFF
				&& sdata[3] == 0xD8) {
			// erroneous header
			data = sdata.slice(4);
		} else {
			data = [];
			var i = 0;
			if (sdata[i] == 0xFF && sdata[i + 1] == 0xD8) {
				data = data.concat(sdata.slice(i, i + 2));
				i += 2;
				while (i < sdata.length) {
					if (sdata[i] == 0xFF) {
						if (sdata[i + 1] == 0xD9 && sdata[i + 2] == 0xFF && sdata[i + 3] == 0xD8) {
							i += 4;
							data = data.concat(sdata.slice(i));
							break;
						} else if(sdata[i+1] == 0xDA) {
							data = data.concat(sdata.slice(i));
							break;
						} else {
							var segmentLength = (sdata[i + 2] << 8) + (sdata[i + 3] & 0xFF);
							data = data.concat(sdata.slice(i, i + segmentLength + 2));
							i += segmentLength + 2;
						}
					} else {
						EngineLogE("JPEG marker invalid: i=" + i);
					}
				}
			} else {
				EngineLogE("SOI missing");
			}
		}
		return data;
	},
	arrayToBase64String: function(arr) {
		var ret = [];
		var SIZE = 10000;

		// split to avoid error on iPhone when array size is more than 150k..200k
		var max = Math.ceil(arr.length / SIZE);
		for(var i = 0; i < max; i++) {
			ret.push(String.fromCharCode.apply(null, arr.slice(i * SIZE, Math.min((i + 1) * SIZE, arr.length))));
		}
		return btoa(ret.join(""));
	}
};

// use delayed evaluation just in case,
// because Document#createElement() might be executed
// before DOM is not initialized
ImageManager.__defineGetter__("usePremultipliedAlpha", function() {
	delete this.usePremultipliedAlpha;

	var canvas = document.createElement("canvas");
	canvas.width = canvas.height = 1;
	var ctx = canvas.getContext("2d");
	var output = ctx.createImageData(1, 1);
	var data = output.data;
	data[0] = data[3] = 128;
	ctx.putImageData(output, 0, 0);
	return this.usePremultipliedAlpha = (ctx.getImageData(0, 0, 1, 1).data[0] == 255);
});
