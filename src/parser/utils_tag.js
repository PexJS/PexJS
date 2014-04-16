var setProperty = function(obj, name, func, delayEval) {
	if(!delayEval) {
		obj[name] = func();
		return;
	}
	
	obj.__defineGetter__(name, function(){
		delete this[name];
		return this[name] = func();
	});
};

var setProperties = function(obj, func, attributes, delayEval) {
	if(!delayEval) {
		var result = func();
		for(var key in result) {
			obj[key] = result[key];
		}
		return;
	}
	
	var len = attributes.length;
	for(var i = 0; i < len; i++) {
		// set "FIRST" property
		obj.__defineGetter__(attributes[i],
			function(ownKey) {
				return function() {
					var result = func();
					for(var key in result) {
						delete this[key];
						this[key] = result[key];
					}
					return result[ownKey];
				};
			}(attributes[i])
		);
	}
};
