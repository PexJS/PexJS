var CacheController = function(cacheMaxTotalSize) {
	this._cacheMaxTotalSize = cacheMaxTotalSize || 15728640;  // 15 MB
	this._cacheSize = 0;
	this._coloredImageCache = {};
	this._imageInfoCache = {};
	this._usedCanvases = [];
};

CacheController._freeCanvases = [];
CacheController.getFreeCanvas = function() {
	return CacheController._freeCanvases.pop() || document.createElement("canvas");
};

CacheController.destroyCanvas = function(canvas) {
	canvas.width = canvas.height = 16;
	CacheController._freeCanvases.push(canvas);
};

CacheController.prototype.getImageInfo = function(key) {
	return this._imageInfoCache[key];
};

CacheController.prototype.cacheImageInfo = function(key, imageInfo) {
	if(!imageInfo) {
		return;
	}
	var canvas = imageInfo.img;
	// canvas uses 4 bytes per pixel
	var size = (canvas.width * canvas.height) << 2;  // width * height * 4
	if(this._cacheSize + size > this._cacheMaxTotalSize) {
		this.clearCache();
	}
	this._imageInfoCache[key] = imageInfo;
	this._cacheSize += size;
	this._usedCanvases.push(canvas);
};

CacheController.prototype.getColoredImage = function(key, srcImage) {
	var imgList = this._coloredImageCache[key];
	if(imgList) {
		var ilen = imgList.length;
		for(var i = 0; i < ilen; i++) {
			var pair = imgList[i];
			if(pair[0] == srcImage) {
				return pair[1];
			}
		}
	}
	return null;
};

CacheController.prototype.cacheColoredImage = function(key, srcImage, coloredImage) {
	// canvas uses 4 bytes per pixel
	var size = (coloredImage.width * coloredImage.height) << 2;  // width * height * 4
	var imgList = this._coloredImageCache[key] || (this._coloredImageCache[key] = []);
	if(this._cacheSize + size > this._cacheMaxTotalSize) {
		this.clearCache();
	}
	imgList.push([srcImage, coloredImage]);
	this._cacheSize += size;
	this._usedCanvases.push(coloredImage);
};

CacheController.prototype.clearCache = function() {
	this._imageInfoCache = {};
	this._coloredImageCache = {};
	this._cacheSize = 0;

	var usedCanvases = this._usedCanvases;
	var freeCanvases = CacheController._freeCanvases;
	var canvasCnt = usedCanvases.length;
	for (var i = 0; i < canvasCnt; i++) {
		var canvas = usedCanvases[i];
		canvas.width = canvas.height = 16;
		freeCanvases.push(canvas);
	}
	this._usedCanvases = [];
};
