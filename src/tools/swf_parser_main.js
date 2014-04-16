var fs = require("fs");
var Canvas = require("canvas");
var Image = function() {};  // Image#src returns a empty string if use Canvas.Image

var window = global;
var document = {
	createElement: function(name) {
		if (name == "canvas") {
			return new Canvas();
		} else if (name == "img") {
			return new Image();
		} else {
			throw "not supported";
		}
	}
};

var navigator = {
	userAgent: "iPhone" // Default
};

var btoa = function(str) {
	return (new Buffer(str, "binary")).toString("base64");
};

// var canvas = document.createElement("canvas");
// var ctx = canvas.getContext("2d");
// ctx.fillStyle = "rgba(0, 0, 0, 0)";
// ctx.fillRect(0, 0, 1, 1);
// canvas.toDataURL();
var emptyImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACWCAYAAABkW7XSAAAEYklEQVR4Xu3UAQkAAAwCwdm/9HI83BLIOdw5AgQIRAQWySkmAQIEzmB5AgIEMgIGK1OVoAQIGCw/QIBARsBgZaoSlAABg+UHCBDICBisTFWCEiBgsPwAAQIZAYOVqUpQAgQMlh8gQCAjYLAyVQlKgIDB8gMECGQEDFamKkEJEDBYfoAAgYyAwcpUJSgBAgbLDxAgkBEwWJmqBCVAwGD5AQIEMgIGK1OVoAQIGCw/QIBARsBgZaoSlAABg+UHCBDICBisTFWCEiBgsPwAAQIZAYOVqUpQAgQMlh8gQCAjYLAyVQlKgIDB8gMECGQEDFamKkEJEDBYfoAAgYyAwcpUJSgBAgbLDxAgkBEwWJmqBCVAwGD5AQIEMgIGK1OVoAQIGCw/QIBARsBgZaoSlAABg+UHCBDICBisTFWCEiBgsPwAAQIZAYOVqUpQAgQMlh8gQCAjYLAyVQlKgIDB8gMECGQEDFamKkEJEDBYfoAAgYyAwcpUJSgBAgbLDxAgkBEwWJmqBCVAwGD5AQIEMgIGK1OVoAQIGCw/QIBARsBgZaoSlAABg+UHCBDICBisTFWCEiBgsPwAAQIZAYOVqUpQAgQMlh8gQCAjYLAyVQlKgIDB8gMECGQEDFamKkEJEDBYfoAAgYyAwcpUJSgBAgbLDxAgkBEwWJmqBCVAwGD5AQIEMgIGK1OVoAQIGCw/QIBARsBgZaoSlAABg+UHCBDICBisTFWCEiBgsPwAAQIZAYOVqUpQAgQMlh8gQCAjYLAyVQlKgIDB8gMECGQEDFamKkEJEDBYfoAAgYyAwcpUJSgBAgbLDxAgkBEwWJmqBCVAwGD5AQIEMgIGK1OVoAQIGCw/QIBARsBgZaoSlAABg+UHCBDICBisTFWCEiBgsPwAAQIZAYOVqUpQAgQMlh8gQCAjYLAyVQlKgIDB8gMECGQEDFamKkEJEDBYfoAAgYyAwcpUJSgBAgbLDxAgkBEwWJmqBCVAwGD5AQIEMgIGK1OVoAQIGCw/QIBARsBgZaoSlAABg+UHCBDICBisTFWCEiBgsPwAAQIZAYOVqUpQAgQMlh8gQCAjYLAyVQlKgIDB8gMECGQEDFamKkEJEDBYfoAAgYyAwcpUJSgBAgbLDxAgkBEwWJmqBCVAwGD5AQIEMgIGK1OVoAQIGCw/QIBARsBgZaoSlAABg+UHCBDICBisTFWCEiBgsPwAAQIZAYOVqUpQAgQMlh8gQCAjYLAyVQlKgIDB8gMECGQEDFamKkEJEDBYfoAAgYyAwcpUJSgBAgbLDxAgkBEwWJmqBCVAwGD5AQIEMgIGK1OVoAQIGCw/QIBARsBgZaoSlAABg+UHCBDICBisTFWCEiBgsPwAAQIZAYOVqUpQAgQMlh8gQCAjYLAyVQlKgIDB8gMECGQEDFamKkEJEDBYfoAAgYyAwcpUJSgBAgbLDxAgkBEwWJmqBCVAwGD5AQIEMgIGK1OVoAQIGCw/QIBARsBgZaoSlACBB1YxAJfjJb2jAAAAAElFTkSuQmCC";

// console.log will be removed by the obfuscator, but console.log.apply won't,
// so define a utility function to output messages to stdout easily
var print = function() {
	console.log.apply(console, arguments);
};

var main = function(input, output, varName, isReduceLines, reduceThreshold, colorRange, withQuotes) {
	var header = {};
	var tagList = [];

	var buffer = fs.readFileSync(input);
	var binary = Array.prototype.slice.call(buffer, 0);
	var loader = { loadedBytes: binary.length, binary: binary };

	var parser = new Parser({});

	var pos = Parser.dealHeader(loader, header);
	parser.loader = loader;
	parser.tagList = tagList;
	parser.dealBody(pos, false, colorRange);

	var walkTags = function(tagList, funcs) {
		for (var i = 0; i < tagList.length; i++) {
			var tag = tagList[i];
			for (var j = 0; j < funcs.length; j++) {
				var func = funcs[j];
				func(tag);
			}
			if (tag.hasOwnProperty("tags")) {
				walkTags(tag.tags, funcs);
			}
		}
	};

	var makeOwnProperty = function(propName) {
		return function(tag) {
			tag[propName] = tag.__proto__[propName];
		};
	};
	var convertImageToString = function(propName) {
		return function(tag) {
			var obj = tag[propName];
			if (obj instanceof Canvas) {
				if (tag.type != TagDefine.TypeTagDefineBitsJPEG2 && tag.type != TagDefine.TypeTagDefineBitsJPEG3) {
					tag[propName] = obj.toDataURL();
				} else {
					console.warn("warning: JPEG with alpha is not supported and use empty image");
					tag[propName] = emptyImage;
				}
			} else if (obj instanceof Image) {
				tag[propName] = obj.src;
			}
		};
	};

	// make 'type' own property for JSON.stringify and convert img and canvas to data URI scheme
	walkTags(tagList, [makeOwnProperty("type"), convertImageToString("img")]);

	if(isReduceLines) {
		reduceLines(tagList, reduceThreshold);
	}

	var json = JSON.stringify({JSON_VERSION: PEX_VERSION.split(".").slice(0,2).join("."), header: header, tagList: tagList});
	if (withQuotes) {
		json = "'" + json + "'";
	}
	if (varName) {
		json = "var " + varName + "=" + json + ";";
	}

	if (output) {
		fs.writeFileSync(output, json);
	} else {
		process.stdout.write(json);
	}
};

var showUsage = function() {
	var script = __filename.replace(/.*\//, "");
	var usage = [
		"parse SWF files and output JSON",
		"",
		"  node " + script + " [ options ] filename",
		"",
		"    -h, --help - show this usage",
		"    -o FILENAME, --output FILENAME - output the result into FILENAME (default: stdout)",
		"    --var VARIABLE_NAME - prepend 'var VARIABLE_NAME=' and append ';' to the output",
		"    --android - parse SWF for Android if transparent PNGs are used",
		"    --reduce-lines THRESHOLD - reduce lines by Douglas-Peucker method. Unit of THRESHOLD is twips.",
		"    --color-levels N - The number of values for each color channel in color. (default: 16)",
		"                       The minimum value of N is 1 and the maximum value is 256, which means true color.",
		"    --with-quotes - quote the output JSON",
		"    --version - show the version",
	];
	console.error(usage.join("\n") + "\n");
};

(function() {
	var opts = process.argv.slice(2);
	var script = __filename.replace(/.*\//, "");
	var colorRange = 16;
	while (opts.length > 0) {
		var v = opts.shift();
		switch (v) {
		case "-h":
		case "--help":
			showUsage();
			process.exit(1);
			break;
		case "-o":
		case "--output":
			var output = opts.shift();
			if (!output) {
				console.error(script + ": output file is not specified");
				process.exit(1);
			}
			break;
		case "--var":
			var varName = opts.shift();
			if (!varName) {
				console.error(script + ": variable name is not specified");
				process.exit(1);
			}
			break;
		case "--reduce-lines":
			var isReduceLines = true;
			var reduceThreshold = opts.shift();
			break;
		case "--android":
			navigator.userAgent = "Android";
			break;
		case "--color-levels":
			// use 'eval' to parse strings like 'null'
			var n = eval(opts.shift());
			colorRange = n && n < 256 && (Math.max(1, Math.min(256 / n, 256)) | 0);
			break;
		case "--with-quotes":
			var withQuotes = true;
			break;
		case "--version":
			print(script + " #PEX_VERSION# (#COMMIT_HASH#)");
			process.exit(0);
			break;
		default:
			if (v.substring(0, 1) == "-") {
				console.error(script + ": invalid option '" + v + "'");
				process.exit(1);
			}
			var input = v;
		}
	}

	if (!input) {
		showUsage();
		process.exit(1);
	}
	main(input, output, varName, isReduceLines, reduceThreshold, colorRange, withQuotes);
})();
