var Parser = function(option) {
	this.option = option;
	this.completed = false;
	this.loader = new Loader(option);
	this.parsedByte = 0;
	this.headerCompleted = false;
	this.header = {};
	this.tagList = [];
	this.loadingImageCount = 0;
	this.colorRange = option.colorLevels && option.colorLevels < 256 && (Math.max(1, Math.min(256 / option.colorLevels, 256)) | 0);
};

(function() {
	Parser.dealHeader = function(loader, header, onerror) {
		// about 20 bytes length so check it
		var loadedBytes = loader.loadedBytes;
		if(loadedBytes < 20) {
			return 0;
		}
		var pos = 0;
		var binary = loader.binary;
		if(binary[pos] != "F".charCodeAt(0) ||
			binary[pos + 1] != "W".charCodeAt(0) ||
			binary[pos + 2] != "S".charCodeAt(0)) {
			// signature check missed
			var errorMessage = "invalid swf signature: " + String.fromCharCode.apply(null, binary.slice(0, 3));
			onerror && onerror(errorMessage);
			EngineLogE(errorMessage);
			return 0;
		}
		header.signature = "FWS";
		pos += 3;
		header.version = binary[pos];
		if(header.version != 4) {
			EngineLogW("unsupported flash version: " + header.version);
		}
		pos++;
		header.filesize = getUI32(binary, pos);
		pos += 4;
		var rect = [];
		var len = getRect(binary, pos, rect);
		header.frameSize = rect;
		pos += len;
		header.frameRate = binary[pos + 1];	 // 8.8frames. ignore floating point
		pos += 2;
		header.frameCount = getUI16(binary, pos);
		pos += 2;
		if(loadedBytes < pos) {
			return 0;
		}
		return pos;
	};

	Parser.prototype.dealBody = function(pos, delayEval, colorRange) {
		var loader = this.loader;
		var loadedBytes = loader.loadedBytes;
		var binary = loader.binary;
		var tagList = this.tagList;

		while(pos < loadedBytes) {
			var feed = getUI16(binary, pos);
			var size = 2;
			if(isNaN(feed)) {
				// read undefined
				break;
			}
			var type = feed >> 6;
			var length = feed & 0x3F;
			if(length == 0x3f) {
				length = getUI32(binary, pos + 2);
				size += 4;
			}
			if(isNaN(length)) {
				// read undefined
				break;
			}
			if(size + length + pos > loadedBytes) {
				// too much readed
				break;
			}
			// tag is loaded successfully
			var tagClass = TagFactory[type] || TagGeneral;
			var instance = new tagClass(binary, pos + size, length, type, delayEval, this, colorRange);
			tagList.push(instance);

			pos += length + size;
		}
		return pos;
	};

	Parser.prototype.load = function(src, callback) {
		this.onprogress = (callback && [callback]) || [];
		this.loader.load(src, function(that) { return function() { that.progress.apply(that, arguments); }; }(this));
	};
	
	Parser.prototype.addCallback = function(callback) {
		if(this.completed) {
			callback();
		} else {
			this.onprogress.push(callback);
		}
	};

	Parser.prototype.progress = function() {
		var pos = this.parsedByte;

		if(!this.headerCompleted) {
			var len = Parser.dealHeader(this.loader, this.header, this.option.onerror);
			if(!len) {
				return;
			}
			pos += len;
			this.headerCompleted = true;
		}
		pos = this.dealBody(pos, this.option.delayEval, this.colorRange);

		this.completed = this.loader.completed;
		if(this.completed && pos != this.loader.loadedBytes) {
			EngineLogW("parse warning: couldn't finish to tag all binary data");
			this.option.onerror && this.option.onerror("broken binary");
		}
		this.parsedByte = pos;
		var len = this.onprogress.length;
		for(var i = 0; i < len; i++) {
			this.onprogress[i]();
		}
		if(this.completed) {
			this.onprogress = [];
		}
	};

})();
