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
