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
		var isTypedArraySupported = window.DataView;
		xhr.open("GET", src);
		if(isTypedArraySupported) {
			// TypedArray supported
			xhr.responseType = 'arraybuffer';
		} else {
			xhr.overrideMimeType('text/plain; charset=x-user-defined'); // binary
		}
		xhr.onreadystatechange = (function(that) {
			return function() {
				if(xhr.status != 0 && xhr.status != 200) {
					that.option.onerror && that.option.onerror("xhr failed");
					EngineLogE("xhr failed status=" + xhr.status, xhr);
					return;
				}
				if(xhr.readyState >= 3) {
					var len = 0;
					if(isTypedArraySupported) {
						if(xhr.response) {
							var dataView = new DataView(xhr.response);
							len = xhr.response.byteLength;
							for(var i = that.loadedBytes; i < len; i++) {
								that.binary[i] = dataView.getUint8(i);
							}
						}
					} else {
						var rt = xhr.responseText;
						len = rt.length;
						for(var i = that.loadedBytes; i < len; i++) {
							that.binary[i] = rt.charCodeAt(i) & 0xFF; // bitmask needed
						}
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
