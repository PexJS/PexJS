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


var Analyzer = function(engine, mcInfo, tagList, buttonCharacters, buttonActions) {
	// store arguments
	this.engine = engine;
	this.mcInfo = mcInfo;
	this.tagList = tagList;
	this.buttonCharacters = buttonCharacters;
	this.buttonActions = buttonActions;
	
	// for analyzing
	this.analyzedLength = 0;
	this.frame = 1;
	this.idCounter = 0;
	this.idList = [];
	this.bornIdList = [];
	this.deadIdList = [];
	this.idPlacementMap = {};
	this.idModifiedMap = {};
	this.layerIdMap = {}; // layer(depth) -> id
};

Analyzer.prototype.analyze = function(dictionary) {
	if(this.tagList) {
		this.analyzeMovieClip(dictionary);
	} else {
		this.analyzeButton(dictionary);
	}
};

Analyzer.prototype.analyzeMovieClip = function(dictionary) {
	var engine = this.engine;
	var mcInfo = this.mcInfo;
	var tagList = this.tagList;
	
	// support on-the-fly analyzing
	var len = tagList.length;
	loop: for(var i = this.analyzedLength; i < len; i++) {
		var tag = tagList[i];
		switch(tag.type) {
		
		// Control
		case TagDefine.TypeTagEnd:
			mcInfo.actualTotalFrames = this.frame-1;
			break loop;
		case TagDefine.TypeTagSetBackgroundColor:
			!engine.option.transparent && (engine.bgColor || (engine.bgColor = tag.color));
			break;
		case TagDefine.TypeTagFrameLabel:
			mcInfo.frameLabelMap[tag.name] = this.frame;
			if(tag.name.toLowerCase() === "_noskip") {
				mcInfo.noskipFrameList[this.frame] = true;
			}
			break;
		
		// Display List
		case TagDefine.TypeTagShowFrame:
			// save current data
			var frame = this.frame;
			mcInfo.frameIdList[frame] = [].concat(this.idList);
			mcInfo.frameBornIdList[frame] = this.bornIdList;
			mcInfo.frameDeadIdList[frame] = this.deadIdList;
			mcInfo.frameIdModifiedMap[frame] = this.idModifiedMap;
			this.bornIdList = [];
			this.deadIdList = [];
			this.idModifiedMap = {};
			// save id-placement map
			var idPlacementMap = {};
			for(var key in this.idPlacementMap) {
				idPlacementMap[key] = this.idPlacementMap[key];
			}
			mcInfo.frameIdPlacementMap[frame] = idPlacementMap;
			// increment frame
			this.frame++;
			break;
		// case TagDefine.TypeTagPlaceObject: // TODO
		case TagDefine.TypeTagPlaceObject2:
			var target = tag.characterId;
			var layer = tag.depth;
			
			var id = this.layerIdMap[tag.depth];
			
			// checking morph
			var characterId = target || this.idPlacementMap[id].characterId; // target might be null
			var def = dictionary[characterId];
			if(def.type == TagDefine.TypeTagDefineMorphShape || (characterId >= 65536 && characterId <= 0xFFFFFFFF)) {
				if(characterId >= 65536) {
					def = dictionary[def.originalId];
				}
				var newTag = {};
				var olderTag = this.idPlacementMap[id];
				for(var key in tag) {
					newTag[key] = tag[key] || (olderTag && olderTag[key]);
				}
				newTag.characterId = createVirtualShapeFromMorph(engine, def, tag.ratio, dictionary);
				tag = newTag;
				target = newTag.characterId;
			}
			
			if(tag.move && !target) {
				// modify
				var oldPlacement = this.idPlacementMap[id];
				var newPlacement = {};
				for(var key in tag) {
					newPlacement[key] = tag[key];
				}
				for(var key in oldPlacement) {
					if(tag[key] == null && oldPlacement[key] != null) {
						newPlacement[key] = oldPlacement[key];
					}
				}
				this.idPlacementMap[id] = newPlacement;
				this.idModifiedMap[id] = true;
			} else {
				if(tag.move) {
					// copy information
					var oldPlacement = this.idPlacementMap[id];
					var newPlacement = {};
					for(var key in tag) {
						newPlacement[key] = tag[key];
					}
					for(var key in oldPlacement) {
						if(tag[key] == null && oldPlacement[key] != null) {
							newPlacement[key] = oldPlacement[key];
						}
					}
					tag = newPlacement;

					// remove
					this.idList.splice(this.idList.indexOf(id), 1);
					this.deadIdList.push(id);
				}
				// new character detected
				var newId = ++this.idCounter;
				this.idList.push(newId);
				this.idPlacementMap[newId] = tag;
				this.bornIdList.push(newId);
				// set id information
				var idInfo = {};
				idInfo.id = newId;
				idInfo.characterId = tag.characterId;
				idInfo.layer = tag.depth;
				idInfo.born = this.frame;
				idInfo.placement = tag;
				idInfo.ownerMC = {};
				mcInfo.idInfo[newId] = idInfo;
				// set frame,layer => id map
				this.layerIdMap[tag.depth] = newId;
			}
			break;
		case TagDefine.TypeTagRemoveObject2:
			var id = this.layerIdMap[tag.depth];
			this.idList.splice(this.idList.indexOf(id), 1);
			this.deadIdList.push(id);
			delete this.idPlacementMap[id];
			delete this.layerIdMap[tag.depth];
			break;
		
		// Action
		case TagDefine.TypeTagDoAction:
			var actionFunc = (engine.option.compileAction ? createActionFunction : createRawActionFunction)(tag.actions, engine.option.debug);
			(mcInfo.frameActionMap[this.frame] || (mcInfo.frameActionMap[this.frame] = [])).push(actionFunc);
			break;
		
		case TagDefine.TypeTagJPEGTables:
			break;
		
		case TagDefine.TypeTagDefineBits:
		case TagDefine.TypeTagDefineBitsJPEG2:
		case TagDefine.TypeTagDefineBitsJPEG3:
		case TagDefine.TypeTagDefineBitsLossless:
		case TagDefine.TypeTagDefineBitsLossless2:
		case TagDefine.TypeTagDefineShape:
		case TagDefine.TypeTagDefineShape2:
		case TagDefine.TypeTagDefineShape3:
		case TagDefine.TypeTagDefineButton:
		case TagDefine.TypeTagDefineButton2:
		case TagDefine.TypeTagDefineFont:
		case TagDefine.TypeTagDefineFont2:
		case TagDefine.TypeTagDefineText:
		case TagDefine.TypeTagDefineText2:
		case TagDefine.TypeTagDefineEditText:
		case TagDefine.TypeTagDefineMorphShape:
		case TagDefine.TypeTagDefineSprite:
			// save in dictionary
			dictionary[tag.id] = tag;
			break;
		
		default:
			EngineLogW("Analyzer: unknown tag detected [" + tag.type + "]");
			break;
		}
	}
	this.analyzedLength = len;
	mcInfo.framesLoaded = this.frame - 1;
	mcInfo.idCounter = this.idCounter;
	mcInfo.updateCallback();
};

Analyzer.prototype.analyzeButton = function(dictionary) {
	var engine = this.engine;
	var mcInfo = this.mcInfo;
	var characters = this.buttonCharacters;	
	var actions = this.buttonActions;
	
	var frameIdList = [null, [], [], [], []];
	var frameBornIdList = [null, [], [], [], []];
	var frameDeadIdList = [null, [], [], [], []];
	var frameIdPlacementMap = [null, {}, {}, {}, {}];

	var len = characters.length;
	for(var i = 0; i < len; i++) {
		var character = characters[i];
		var characterId = character.characterId;
		var def = dictionary[characterId];
		var newId = ++this.idCounter;

		var born = null;

		var dummy_placement = {
			type: TagDefine.TypeTagPlaceObject2,
			move: 0,
			depth: character.depth,
			characterId: characterId,
			matrix: character.matrix,
			cxform: character.colorTransform,
			name: null,
			clipDepth: null
		};

		if(character.stateUp) {
			frameIdList[1].push(newId);
			frameIdPlacementMap[1][newId] = dummy_placement;

			frameBornIdList[1].push(newId);
			if(!character.stateOver) {
				frameDeadIdList[2].push(newId);
			}
			if(!born) born = 1;
		}
		if(character.stateOver) {
			frameIdList[2].push(newId);
			frameIdPlacementMap[2][newId] = dummy_placement;

			if(!character.stateUp) {
				frameBornIdList[2].push(newId);
			}
			if(!character.stateDown) {
				frameDeadIdList[3].push(newId);
			}
			if(!born) born = 2;
		}
		if(character.stateDown) {
			frameIdList[3].push(newId);
			frameIdPlacementMap[3][newId] = dummy_placement;

			if(!character.stateOver) {
				frameBornIdList[3].push(newId);
			}
			if(!character.stateHitTest) {
				frameDeadIdList[4].push(newId);
			}
			if(!born) born = 3;
		}
		if(character.stateHitTest) {
			var stateOver = character.stateOver;
			for(var frameNo = 1; frameNo <= 3; frameNo++) {
				frameIdList[frameNo].push(newId);
				frameIdPlacementMap[frameNo][newId] = dummy_placement;

				if(!stateOver) {
					frameBornIdList[frameNo].push(newId);
				}
			}
			if(!born) born = 4;
		}

		var idInfo = {};
		idInfo.id = newId;
		idInfo.characterId = characterId;
		idInfo.layer = character.depth + ((born == 4)? 65536: 0);
		idInfo.born = born;
		idInfo.placement = dummy_placement;
		idInfo.ownerMC = {};
		mcInfo.idInfo[newId] = idInfo;
	}

	for(var i in actions) {
		var action = actions[i];
		if(action.keyPress) {
			mcInfo.buttonActionMap[action.keyPress] = createActionFunction(action.actions);
		}
		if(action.overUpToOverDown) {
			mcInfo.buttonActionMap["press"] = createActionFunction(action.actions);
		} else if(action.overDownToOverUp) {
			mcInfo.buttonActionMap["release"] = createActionFunction(action.actions);     // TODO: awful!!
		}
	}
	
	mcInfo.frameIdList = frameIdList;
	mcInfo.frameBornIdList = frameBornIdList;
	mcInfo.frameDeadIdList = frameDeadIdList;
	mcInfo.frameIdPlacementMap = frameIdPlacementMap;
	mcInfo.frameIdModifiedMap = [{}, {}, {}, {}];
	mcInfo.frameLabelMap = {"Up": 1, "Over": 2, "Down": 3, "Hit": 4};
	mcInfo.frameActionMap = {};
	mcInfo.framesLoaded = 3;
	mcInfo.idCounter = this.idCounter;
	mcInfo.updateCallback();
	this.analyzedLength = len;
};

var createVirtualShapeFromMorph = function(engine, obj, ratio, dictionary) {
	// ratio might be undefined
	ratio = ratio || 0;
	
	// set original characterId
	var newCharacterId = obj.id * 65536 + ratio;
	var tag = dictionary[newCharacterId];
	if(tag) {
		return newCharacterId;
	}
	
	// create virtual shape tag
	tag = {
		id: newCharacterId,
		originalId: obj.id,
		type: TagDefine.TypeTagDefineShape
	};
	
	var r = ratio / 65536;
	var s = 1 - r;
	
	// bounds
	var bounds = [];
	for(var i = 0; i < 4; i++) {
		bounds.push(obj.startBounds[i] * s + obj.endBounds[i] * r);
	}
	tag.bounds = bounds;
	
	// fillStyle
	var fillStyles = [];
	var len = obj.fillStyles.length;
	for(var i = 0; i < len; i++) {
		var fillStyle = obj.fillStyles[i];
		var fill = {gradient:{}};
		fill.type = fillStyle.type;
		if(fillStyle.type == 0x00) {
			// solid fill
			fill.color = fillStyle.start * s + fillStyle.end * r;
		} else if(fillStyle.type == 0x10 || fillStyle.type == 0x12) {
			// gradient fill
			var matrix = [];
			for(var j = 0; j < 6; j++) {
				matrix[j] = fillStyle.start[j] * s + fillStyle.end[j] * r;
			}
			fill.matrix = matrix;
			var gradient = [];
			var glen = fillStyle.gradient.records.length;
			for(var j = 0; j < glen; j++) {
				var grad = fillStyle.gradient.records[j];
				gradient[j] = {
					ratio: grad.startRatio * s + grad.endRatio * r,
					color: grad.startColor * s + grad.endColor * r
				};
			}
			fill.gradient.records = gradient;
		} else {
			EngineLogE("createVirtualShapeFromMorph: unsupported morphing param:", fillStyle.type);
		}
		fillStyles.push(fill);
	}
	tag.fillStyles = fillStyles;
	
	// lineStyle
	var lineStyles = [];
	var len = obj.lineStyles.length;
	for(var i = 0; i < len; i++) {
		var lineStyle = obj.lineStyles[i];
		var line = {
			width: lineStyle.startWidth * s + lineStyle.endWidth * r,
			color: lineStyle.startColor * s + lineStyle.endColor * r
		};
		lineStyles.push(line);
	}
	tag.lineStyles = lineStyles;
	
	// shape
	if(obj.startEdges.length > obj.endEdges.length) {
		EngineLogE("createVirtualShapeFromMorph: difference detected at startEdges and endEdges");
	}
	var olen = obj.startEdges.length;
	var shapes = [];
	for(var i = 0; i < olen; i++) {
		var startEdge = obj.startEdges[i];
		var endEdge = obj.endEdges[i];
		var edge = {};
		
		// regard line as curve, so that we handle together (P.160 on specification)
		if(startEdge.type == EdgeDefine.TypeCurve && endEdge.type == EdgeDefine.TypeStraight) {
			endEdge.type = EdgeDefine.TypeCurve;
			endEdge.ax = endEdge.cx = endEdge.x / 2;
			endEdge.ay = endEdge.cy = endEdge.y / 2;
		} else if(startEdge.type == EdgeDefine.TypeStraight && endEdge.type == EdgeDefine.TypeCurve) {
			startEdge.type = EdgeDefine.TypeCurve;
			startEdge.ax = startEdge.cx = startEdge.x / 2;
			startEdge.ay = startEdge.cy = startEdge.y / 2;
		}
		edge.type = startEdge.type;
		if(startEdge.type == EdgeDefine.TypeStyleChange) {
			edge.lineStyle = startEdge.lineStyle;
			edge.fillStyle0 = startEdge.fillStyle0;
			edge.fillStyle1 = startEdge.fillStyle1;
			edge.dx = startEdge.dx * s + endEdge.dx * r;
			edge.dy = startEdge.dy * s + endEdge.dy * r;
			edge.lineStyles = startEdge.lineStyles;
			edge.fillStyles = startEdge.fillStyles;
		} else if(startEdge.type == EdgeDefine.TypeStraight) {
			edge.x = startEdge.x * s + endEdge.x * r;
			edge.y = startEdge.y * s + endEdge.y * r;
		} else if(startEdge.type == EdgeDefine.TypeCurve) {
			edge.cx = startEdge.cx * s + endEdge.cx * r;
			edge.cy = startEdge.cy * s + endEdge.cy * r;
			edge.ax = startEdge.ax * s + endEdge.ax * r;
			edge.ay = startEdge.ay * s + endEdge.ay * r;
		} else {
			EngineLogE("createVirtualShapeFromMorph: unknown edge type:", startEdge.type);
		}
		shapes.push(edge);
	}
	tag.shapes = shapes;
	
	dictionary[newCharacterId] = tag;
	return newCharacterId;
};
