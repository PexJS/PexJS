var makeJSON = function(tagger) {
	function isElement(e){
		if(e && e.nodeType === 1){
			return true;
			try{
				console.log("!");
				e.nodeType = e.nodeType;
			} catch(n) {
				return true;
			}
		}
		return false;
	}
	var clone = function(o) {
		if(o && o.constructor === Array) {
			var a = [];
			for(var i = 0; i < o.length; i++) {
				a.push(clone(o[i]));
			}
			return a;
		}
		if(o && typeof o == "object") {
			if(isElement(o)) {
				return "<ELEMENT>";
			}
			var ret = {};
			for(var key in o) {
				ret[key] = clone(o[key]);
			}
			return ret;
		}
		if(typeof o == "function") {
			console.log("func?", o);
		} else {
			return o;
		}
	};
	var tagList = [];
	for(var i = 0; i < tagger.tagList.length; i++) {
		var obj = {};
		var tag = tagger.tagList[i];
		tagList.push(clone(tag));
	}
	var json = JSON.stringify(tagList);
	console.log(json);
	console.log(json.length);
};
