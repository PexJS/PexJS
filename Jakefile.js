var fs = require("fs");
var ejs = require("ejs");
var path = require("path");
var util = require("util");
var exec = require("child_process").exec;
var uglify = require("./build/tools/UglifyJS/uglify-js");

var copyright = "\"Pex: https://github.com/PexJS/PexJS\"\n";

var sourceDirectory = "src";

var filesetDirectory = "build/jsset";
var templateFile = "build/templates/template.html";
var indexTemplateFile = "build/templates/index.html";
var tokenFile = "build/obfuscator/tokens.txt";
var mappingFile = "build/obfuscator/mapping.txt";
var jsset = process.env.jsset || "normal";
var swfParser = "build/tools/parse_swf";
var versionFile = "version.txt";
var optionFile = "option.json";

var outputDirectory = "output";
var outputJsDirectory = "js";
var targetDirectory = "target";
var binDirectory = "bin";

var encodeList = ["sjis", "big5", "kr", "cn"];


var uglifyDefaultOptions = {
	ignore_eval: true,
	mangle: true,
	reserved_names: ["develop"],
	codegen_options: {
		ascii_only: true,
		remove_statements: {
			"call": [
				"console.log"
			],
			"if": [
				"develop"
			]
		}
	}
};


var mkdir = function(dir) {
	// making directory without exception if exists
	try {
		fs.mkdirSync(dir, 0755);
	} catch(e) {
		if(e.code != "EEXIST") {
			throw e;
		}
	}
};
var rmdir = function(dir) {
	if (fs.existsSync(dir)) {
		var list = fs.readdirSync(dir);
		for(var i = 0; i < list.length; i++) {
			var filename = path.join(dir, list[i]);
			var stat = fs.statSync(filename);
			
			if(filename == "." || filename == "..") {
				// pass these files
			} else if(stat.isDirectory()) {
				// rmdir recursively
				rmdir(filename);
			} else {
				// rm fiilename
				fs.unlinkSync(filename);
			}
		}
		fs.rmdirSync(dir);
	} else {
		console.warn("warn: " + dir + " not exists");
	}
};
var copyDir = function(src, dest) {
	mkdir(dest);
	var files = fs.readdirSync(src);
	for(var i = 0; i < files.length; i++) {
		var current = fs.lstatSync(path.join(src, files[i]));
		if(current.isDirectory()) {
			copyDir(path.join(src, files[i]), path.join(dest, files[i]));
		} else if(current.isSymbolicLink()) {
			var symlink = fs.readlinkSync(path.join(src, files[i]));
			fs.symlinkSync(symlink, path.join(dest, files[i]));
		} else {
			copy(path.join(src, files[i]), path.join(dest, files[i]));
		}
	}
};
var copy = function(src, dest) {
	var content = fs.readFileSync(src);
	fs.writeFileSync(dest, content);
};
var unlink = function() {
	for (var i = 0; i < arguments.length; i++) {
		var file = arguments[i];
		if (fs.existsSync(file)) {
			fs.unlinkSync(file);
		} else {
			console.warn("warn: " + file + " not exists");
		}
	}
};
var concatFiles = function(fileList, baseDir) {
	var str = "";
	for(var i = 0; i < fileList.length; i++) {
		var filename = fileList[i].trim();
		if(filename && filename.charAt(0) != "#") {
			var sourceDir = (filename).split('/');
			sourceDir.unshift(baseDir);
			var source = path.join.apply(path, sourceDir);
			if(!fs.existsSync(source)) {
				console.log(filename + " in " + jsset + ".txt does not exist. Output file will be broken but build continues");
			} else {
				str += "\n\n/*//////////////////\n";
				str += "  " + filename + "\n";
				str += "//////////////////*/\n";
				str += fs.readFileSync(source);
			}
		}
	}
	return str;
};
var copyTargetHTML = function(targets, suffix, func) {
	if (!suffix) {
		throw new Error("specify suffix");
	}
	for (var i = 0; i < targets.length; i++) {
		var filename = targets[i];
		if (filename.substring(filename.length - 4, filename.length) == ".swf") {
			var target = filename.substring(0, filename.length - 4);
			var dir = path.join(outputDirectory, target);
			var src = path.join(dir, target + ".html");
			var dst = path.join(dir, target + suffix + ".html");
			var html = fs.readFileSync(src, "utf8");
			if (typeof func === "function") {
				html = func(target, html, dir);
			}
			fs.writeFileSync(dst, html);
		}
	}

};
var createIndexHTML = function(targetList, filename, func) {
	var template = fs.readFileSync(path.join.apply(path, indexTemplateFile.split("/")));
	var html = ejs.render(template.toString(), {targetList: targetList});
	if (typeof func === "function") {
		html = func(html);
	}
	fs.writeFileSync(filename, html);
};
// the second arugment of task funciton doensn't work
// when each task has asyncronous function
var execTasks = function(tasks, callback) {
	var i = 0;
	(function() {
		var callee = arguments.callee;
		var cmd = "jake " + tasks[i];
		console.warn(cmd);
		exec(cmd, function(e, stdout, stderr) {
			if (e) {
				throw e;
			}
			i++;
			if (i < tasks.length) {
				setTimeout(callee, 0);
			} else {
				if (typeof callback === "function") {
					callback();
				}
			}
		});
	})();
};

var clone = function(obj) {
	return JSON.parse(JSON.stringify(obj));
};

// default task


desc("build pex.js on output folder");
task("default", [], function(jsName) {
	// create output directory
	mkdir(outputDirectory);
	mkdir(path.join(outputDirectory, outputJsDirectory));
	// make js file
	exec("git rev-parse HEAD", function(e, stdout) {
		var version = stdout.substring(0, 4) || "unknown";
		var d = new Date();
		var dateString = d.getFullYear() + ("00" + (d.getMonth() + 1)).slice(-2) + ("00" + d.getDate()).slice(-2);
		
		// make four js files
		for(var i = 0; i < encodeList.length; i++) {
			var language = encodeList[i];
			if(i > 0) {
				var jsFilename = "pex." + dateString + version + "." + language + ".js";
			} else {
				var jsFilename = "pex." + dateString + version + ".js";
			}
			
			// concat source files
			var data = copyright;
			data += "\"version: " + (stdout.substring(0, 7) || "unknown") + "(" + language + ")\"\n";

			var sourceFileList = (fs.readFileSync(path.join.apply(path, filesetDirectory.split("/").concat(jsset + ".txt"))) + "").split("sjis").join(language).split("\n");
			data += concatFiles(sourceFileList, sourceDirectory);
			var publicVersion = (fs.readFileSync(versionFile) + "").trim();
			data = data.replace(/#PEX_VERSION#/g, publicVersion);

			// write javascript file
			fs.writeFileSync(path.join(outputDirectory, outputJsDirectory, jsFilename), data);
			if(i == 0) {
				fs.writeFileSync(path.join(outputDirectory, outputJsDirectory, "pex.js"), data);
			} else {
				fs.writeFileSync(path.join(outputDirectory, outputJsDirectory, "pex." + language + ".js"), data);
			}
		}
		
		// search target files
		var targetList = [];
		var list = fs.readdirSync(targetDirectory);
		for(var i = 0; i < list.length; i++) {
			var filename = list[i];
			if(filename.substring(filename.length - 4, filename.length) == ".swf") {
				targetList.push(filename.substring(0, filename.length - 4));
			}
			if(filename.substring(filename.length - 3, filename.length) == ".js") {
				targetList.push(filename.substring(0, filename.length - 3));
			}
		}
		
		// create templates
		var template = fs.readFileSync(path.join.apply(path, templateFile.split("/"))).toString();
		var defaultOption = "";
		try {
			defaultOption = fs.readFileSync(path.join(targetDirectory, optionFile)).toString();
		} catch(e) {};
		for(var i = 0; i < targetList.length; i++) {
			var target = targetList[i];
			var dir = path.join(outputDirectory, target);
			mkdir(dir);
			// copy swf
			try {
				copy(path.join(targetDirectory, target + ".swf"), path.join(dir, target + ".swf"));
			} catch(e) {
				copy(path.join(targetDirectory, target + ".js"), path.join(dir, target + ".js"));
			}
			// chech json
			var option = defaultOption;
			try {
				option = fs.readFileSync(path.join(targetDirectory, target + ".json")).toString();
			} catch(e) {};
			// create html
			var html;
			try {
				html = fs.readFileSync(path.join(targetDirectory, target + ".html")).toString();
			} catch(e) {
				html = ejs.render(template, {pexname: (jsName? jsName: "pex.js"), basename: target, option: option});
			}
			var filename = path.join(dir, target + ".html");
			fs.writeFileSync(filename, html);
		}
		// create index html
		var filename = path.join(outputDirectory, "index.html");
		createIndexHTML(targetList, filename);
	});
});

desc("build pex.js on output folder");
task("min", [], function() {
	jake.Task['default'].invoke('pex.min.js');
	jake.Task['obfuscate'].invoke();
});


desc("clean output directory");
task("clean", [], function() {
	rmdir(outputDirectory);
	unlink(swfParser, swfParser + ".js");
});

desc("watch the file's status and jake automatic");
task("watch", [], function(min) {
	var changed = false;
	var fileStateHash = {};
	console.log("now watching for modifying the source code");
	(function check() {
		var fileList = [];
		// check primary files
		fileList.push(path.join.apply(path, filesetDirectory.split("/").concat(jsset + ".txt"))); // jsset/normal.txt
		fileList.push(path.join.apply(path, templateFile.split("/"))); // templates/template.html
		fileList.push(path.join.apply(path, indexTemplateFile.split("/"))); // templates/index.html
		// check src files
		var filesetFile = path.join.apply(path, filesetDirectory.split("/").concat(jsset + ".txt"));
		var sourceFileList = (fs.readFileSync(filesetFile) + "").split("\n");
		for(var i = 0; i < sourceFileList.length; i++) {
			var filename = sourceFileList[i].trim();
			if(filename && filename.charAt(0) != "#") {
				var sourceDir = ['src'].concat((filename).split('/'));
				var source = path.join.apply(path, sourceDir);
				if(source.split("sjis").length > 1) {
					for(var j = 0; j < encodeList.length; j++) {
						fileList.push(source.split("sjis").join(encodeList[j]));
					}
				} else {
					fileList.push(source);
				}
			}
		}
		// target folder's all files
		var list = fs.readdirSync(targetDirectory);
		for(var i = 0; i < list.length; i++) {
			var filename = list[i];
			fileList.push(path.join(targetDirectory, filename));
			if(filename.split("sjis").length > 1) {
				fileList.push(path.join(targetDirectory, filename));
			}
		}
		// Jakefile.js
		fileList.push("Jakefile.js");
		
		// get state of all files
		var newStateHash = {};
		var changed = false;
		for(var i = 0; i < fileList.length; i++) {
			var file = fileList[i];
			if(!fs.existsSync(file)) {
				continue;
			}
			var fileState = fs.statSync(file);
			var value = fileState.mtime + "";
			newStateHash[file] = value;
			if(fileStateHash[file] != value) {
				changed = true;
			}
		}
		
		if(changed) {
			console.log(String(new Date()) +": modified detected");
			exec("jake" + (min? " min": ""), function(e, stdout) {
				if(stdout.trim()) {
					console.log(stdout.trim());
				}
				console.log(String(new Date()) +": jake done(pex.js)");
				exec("jake obfuscate", function(e, stdout) {
					console.log(String(new Date()) +": obfuscated(pex.min.js)");
					if(stdout.trim()) {
						console.log(stdout.trim());
					}
				});
			});
		}
		fileStateHash = newStateHash;
		changed = false;
		setTimeout(check, 500);
	})();
});

desc("obfuscate pex.js");
task("obfuscate", [], function() {
	var pex = path.join(outputDirectory, outputJsDirectory, "pex.js");
	var multi = path.join(outputDirectory, outputJsDirectory, "pex.sjis.js");
	var tool = swfParser + ".js";
	var boundary = 'alert("----------boundary----------");';
	var toolExist = false;

	// update mapping.txt
	var mapping = uglify.utils.make_mapping({
		tokenfile: tokenFile,
		mapping_file: mappingFile
	});
	fs.writeFileSync(mappingFile, mapping.join("\n") + "\n");

	var removeDevelop = function(str) {
		return str.replace(/var develop=true;/, "");
	};

	var js = fs.readFileSync(pex, "utf8");
	if (fs.existsSync(tool)) {
		js += boundary + fs.readFileSync(tool, "utf8").replace(/^#!.*/, "");
		toolExist = true;
	}
	for(var i = 1; i < encodeList.length; i++) {
		js += boundary + fs.readFileSync(multi.split("sjis").join(encodeList[i]), "utf8");
	}

	var options = clone(uglifyDefaultOptions);
	options.tokenfile = tokenFile;
	options.property_maps = mapping;
	var minjs = pex.replace(/js$/, "min.js");
	var ret = uglify.utils.squeeze_it(js, options);

	var files = ret.split(boundary);
	var index = 0;
	fs.writeFileSync(minjs, removeDevelop(files[index]));
	index++;
	if(toolExist) {
		fs.writeFileSync(tool.replace(/.js$/, ""), "#!/usr/bin/env node\n" + removeDevelop(files[index]));
		fs.chmodSync(tool.replace(/.js$/, ""), "0755");
		index++;
	}
	for(var i = 1; i < encodeList.length; i++) {
		var minmultijs = multi.split("sjis").join("min." + encodeList[i]);
		fs.writeFileSync(minmultijs, removeDevelop(files[index++]));
	}

	exec("git rev-parse HEAD", function(e, stdout) {
		var version = stdout.substring(0, 4);
		if(!version) {
			return;
		}
		var d = new Date();
		var dateString = d.getFullYear() + ("00" + (d.getMonth() + 1)).slice(-2) + ("00" + d.getDate()).slice(-2);
		var jsFilename = "pex." + dateString + version + ".min.js";
		copy(minjs, path.join(outputDirectory, outputJsDirectory, jsFilename));
	});
});

desc("make tools");
task("tools", [], function() {
	// make parse_swf.js
	var jsFilename = swfParser + ".js";

	var data = "#!/usr/bin/env node\n";
	var sourceFileList = (fs.readFileSync(path.join.apply(path, filesetDirectory.split("/").concat("swf_parser.txt"))) + "").split("\n");
	data += concatFiles(sourceFileList, sourceDirectory);
	var publicVersion = (fs.readFileSync(versionFile) + "").trim();
	data = data.replace(/#PEX_VERSION#/g, publicVersion);
	exec("git rev-parse --short HEAD", function(error, stdout) {
		if(error) {
			console.error(error + "");  // convert an error object to a string
			process.exit(1);
		}
		var hash = stdout.trim();
		fs.writeFileSync(jsFilename, data.replace(/#COMMIT_HASH#/g, hash));
		fs.chmodSync(jsFilename, "0755");
	});
});

desc("make tokenfile");
task("tokenfile", [], function() {
	var jsFilename = path.join(outputDirectory, outputJsDirectory, "pex.js");

	// extract reserved names (names not to be mangled)
	var code = fs.readFileSync(jsFilename, "utf8");
	// JSON.parse cannot parse strings like "{ a: 1 }" because the keys are not quoted
	var options = eval("(" + code.match(/^var defaultOption = ({[^;]+)/m)[1] + ")");
	var reservedTokens = Object.getOwnPropertyNames(options);
	var regex = /^\s*API.prototype.(\w+)/gm;
	var match = regex.exec(code);
	while(match) {
		reservedTokens.push(match[1]);
		match = regex.exec(code);
	}

	// filter and make unique
	var props = {};
	for(var i = 0; i < reservedTokens.length; i++) {
		props[reservedTokens[i]] = 1;
	}
	reservedTokens = Object.getOwnPropertyNames(props);

	var tokens = uglify.utils.make_tokenfile_info(code, {
		reserved_names: reservedTokens,
		min_length: 2,
		tokenfile: tokenFile,
		diff: true
	});

	console.log(tokenFile);
	if(tokens.length) {
		console.log("suggestion: add tokens in the line beggining with '+'");
		console.log("            remove tokens in the line beggining with '-'");
		process.stdout.write(tokens.join("\n") + "\n");
	} else {
		console.log("there is no new token");
	}
});

desc("make bin");
task("bin", [], function() {
	execTasks(["default", "tools", "obfuscate"], function() {
		var toolDir = path.join(binDirectory, "parse_swf");
		var langDir = path.join(binDirectory, "lang");
		var jsFilename = "pex.min.js";
		var pexPath = path.join(outputDirectory, outputJsDirectory, jsFilename);
		var binParser = path.join(toolDir, "parse_swf");
		var objName = "swfObj";
		
		if (fs.existsSync(binDirectory)) {
			rmdir(binDirectory);
		}
		setTimeout(function() {
			mkdir(binDirectory);
			mkdir(toolDir);
			mkdir(langDir);

			copy(pexPath, path.join(binDirectory, "pex.min.js"));
			for(var i = 1; i < encodeList.length; i++) {
				var language = encodeList[i];
				var pexLangPath = path.join(outputDirectory, outputJsDirectory, "pex.min." + language + ".js");
				copy(pexLangPath, path.join(langDir, "pex." + language + ".min.js"));
			}
			copy(swfParser, binParser);
			fs.chmodSync(binParser, "0755");
		}, 100);
	});
});
