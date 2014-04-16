var Loader = function() {
	this.started = false;
	this.completed = false;
	this.binary = [];
	this.loadedBytes = 0;
};

Loader.prototype.load = function(src, callback) {
	// load swf file from local file
	if(this.started) {
		return;
	}
	this.started = true;

	var fs = require("fs");

	// TODO use fs.read in order to read partially
	fs.readFile(src, (function(that) {
		return function(err, data) {
			if(err) {
				EngineLogE("fs.readFile failed" + err);
				return;
			}

			that.binary = new Array(data.length);
			for(var i = 0; i < data.length; i++) that.binary[i] = data[i];
			that.completed = true;
			that.loadedBytes = data.length;
			that.onprogress && that.onprogress();
		};
	})(this));
};
