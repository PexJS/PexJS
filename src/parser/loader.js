var Loader = function(option) {
	this.option = option;
	this.started = false;
	this.completed = false;
	this.binary = [];
	this.loadedBytes = 0;
};

Loader.prototype.load = function(src, callback) {
	// load swf file from http server using XHR
	if(this.started) {
		return;
	}
	this.started = true;
	
	if(!this.option.swfBinary) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", src);
		xhr.overrideMimeType('text/plain; charset=x-user-defined'); // binary
		xhr.onreadystatechange = (function(that) {
			return function() {
				if(xhr.status != 0 && xhr.status != 200) {
					that.option.onerror && that.option.onerror("xhr failed");
					EngineLogE("xhr failed status=" + xhr.status, xhr);
					return;
				}
				if(xhr.readyState >= 3) {
					var rt = xhr.responseText;
					var len = rt.length;
					for(var i = that.loadedBytes; i < len; i++) {
						that.binary[i] = rt.charCodeAt(i) & 0xFF; // bitmask needed
					}
					that.loadedBytes = len;
					that.completed = (xhr.readyState == 4);
					that.onprogress && that.onprogress();
					if(that.completed) {
						that.onprogress = null;
					}
				}
			};
		})(this);
		this.onprogress = callback;
		xhr.send(null);
	} else {
		this.loadedBytes = this.option.swfBinary.length;
		for(var i = 0; i < this.loadedBytes; i++) {
			this.binary[i] = this.option.swfBinary.charCodeAt(i) & 0xFF;
		}
		this.completed = true;
		callback();
		this.onprogress = null;
	}
};
