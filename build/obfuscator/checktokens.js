var fs = require("fs");
fs.readFile('tokens.txt', 'utf8', function(err, token) {
	fs.readFile('mapping.txt', 'utf8', function(err, mapping) {
		var tokens = token.split('\n');
		var mappings = mapping.split('\n');
		mappings.forEach(function(map) {
			var key = map.split(':')[0];
			for(var i = 0; i < tokens.length; i++) {
				if(tokens[i].trim() == key) {
					break;
				}
			}
			if(i == tokens.length) {
				console.log("bad mapping detected:" + key);
			}
		});
		tokens.forEach(function(token) {
			if(token[0] == '#') {
				return;
			}
			for(var i = 0; i < mappings.length; i++) {
				if(token.trim() == mappings[i].split(':')[0]) {
					break;
				}
			}
			if(i == mappings.length) {
				console.log("bad token detected:" + token);
			}
		});
	});
});


