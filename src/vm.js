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


var VM = function(engine) {
	// store arguments
	this.engine = engine;
	// prepare exceptional mc
	this.exceptionalMC = new MovieClip(engine, new MovieClipInfo(), null, null, true);
	
	// action list
	this.actionList = [];
	this.privilegeActionList = [];
	
	// contexts
	this.running = false;
	this.actionStack = [];
	this.contextStack = [];
	this.currentContext = null;
};

VM.prototype.addAction = function(mc, actions, privilege) {
	var actionStack = this.actionStack;
	if(actionStack && privilege) {
		debugger;
	}
	
	var list = actionStack || (privilege? this.privilegeActionList: this.actionList);
	list[list.length] = [mc, actions];
};

VM.prototype.executeAction = function(mc, actions, privilege) {
	if (mc.properties._currentframe == 0) {
		// e.g. called from the callback function of API#ready()
		this.addAction(mc, actions, privilege);
		return true;
	}

	var context = this.currentContext;
	var actionStack = this.actionStack;
	var contextStack = this.contextStack;
	// save the current arrays and make them empty
	// not to affect running executions
	// For example, the function of FSCommand2 can call API#gotoFrame()
	var currentActionStack = actionStack.splice(0, actionStack.length);
	var currentContextStack = contextStack.splice(0, contextStack.length);

	this.addAction(mc, actions, privilege);
	var isOk = this.run();
	if(!isOk) {
		// vm failed because try to go to non-loaded frame
		this.engine.option.debug && EngineLogD("gotoFrame: try to go to non-loading frame inside VM");
	}
	// restore variables
	this.currentContext = context;
	// use push not to change the reference of 'this.actionStack'
	actionStack.push.apply(actionStack, currentActionStack);
	contextStack.push.apply(contextStack, currentContextStack);

	return isOk;
};

VM.prototype.run = function() {
	var privilegeActionList = this.privilegeActionList;
	var actionList = this.actionList;
	var actionStack = this.actionStack;
	var contextStack = this.contextStack;
	// set all actions into actionList
	privilegeActionList.length && (actionStack = privilegeActionList, this.privilegeActionList = []);
	actionList.length && (actionStack.push.apply(actionStack, actionList), this.actionList = []);
	
	// running flag set
	var prevRunning = this.running;  // called from VM#executeActoin() if 'running' is 'true'
	this.running = true;
	// restore last context (resume from failed status)
	var context = this.currentContext;
	this.currentContext = null;
	while(actionStack.length) {
		var actionInfo = actionStack[0];
		var mc = actionInfo[0];
		context = context || {pc: 0, mc: mc, originalMC:mc, stack: [], finished: false, callInfo: null};
		if(!mc.isDeleted) {
			var f = actionInfo[1];
			var e = f(this, context, byteLength, byteSubstring, getMovieClipAndTextFromSyntax, getMovieClipFromTargetName, memberNo, clone, removeSprite, EngineLogD, EngineLogW);
			if(!e) {
				// failed because gotoFrame failed (not loaded frame called)
				this.currentContext = context;
				return false;
			}
			if(context.finished) {
				actionStack.shift(); // remove current stack from queue
				context = contextStack.pop(); // stack or undefined
			} else {
				contextStack[contextStack.length] = context;
				actionStack.unshift.apply(actionStack, context.callInfo);
				var len = context.callInfo.length;
				for(var i = 1; i < len; i++) {
					contextStack[contextStack.length] = null; // push callstack
				}
				context = null;
			}
		} else {
			actionStack.shift();
			context = contextStack.pop();
		}
	}
	this.running = prevRunning;
	return true;
};

var createActionFunction = function(actions, debug) {
	//return function(vm,context) {context.finished=true;return true;};
	var body = "var offset=context.pc;var mc=context.mc;var stack=context.stack;while(offset>=0){switch('o'+offset){/**/";
	var len = actions.length;
	for(var i = 0; i < len; i++) {
		var action = actions[i];
		body += "case 'o" + action.offset + "':";
		switch(action.code) {
		case ActionDefine.TypeActionPushDuplicate:
			body += "stack[stack.length]=stack[stack.length-1];/**/";
			break;
		case ActionDefine.TypeActionPop:
			body += "stack.length--;/**/";
			break;
		case ActionDefine.TypeActionAdd:
			body += "var a=(+stack[stack.length-1])||0;/**/";
			body += "var b=(+stack[stack.length-2])||0;/**/";
			body += "stack[stack.length-2]=a+b;/**/";
			body += "stack.length--;/**/";
			break;
		case ActionDefine.TypeActionSubtract:
			body += "var a=(+stack[stack.length-1])||0;/**/";
			body += "var b=(+stack[stack.length-2])||0;/**/";
			body += "stack[stack.length-2]=b-a;/**/";
			body += "stack.length--;/**/";
			break;
		case ActionDefine.TypeActionMultiply:
			body += "var a=(+stack[stack.length-1])||0;/**/";
			body += "var b=(+stack[stack.length-2])||0;/**/";
			body += "stack[stack.length-2]=a*b;/**/";
			body += "stack.length--;/**/";
			break;
		case ActionDefine.TypeActionDivide:
			body += "var a=(+stack[stack.length-1])||0;/**/";
			body += "var b=(+stack[stack.length-2])||0;/**/";
			body += "stack[stack.length-2]=(a==0)?'#ERROR':b/a;/**/";
			body += "stack.length--;/**/";
			break;
		case ActionDefine.TypeActionLess:
			body += "var a=(+stack.pop())||0;/**/";
			body += "var b=(+stack.pop())||0;/**/";
			body += "stack[stack.length]=(b<a)?1:0;/**/";
			break;
		case ActionDefine.TypeActionEquals:
			body += "var a=(+stack.pop())||0;/**/";
			body += "var b=(+stack.pop())||0;/**/";
			body += "stack[stack.length]=(a==b)?1:0;/**/";
			break;
		case ActionDefine.TypeActionAnd:
			body += "var a=(+stack.pop())||0;/**/";
			body += "var b=(+stack.pop())||0;/**/";
			body += "stack[stack.length]=(a&&b)?1:0;/**/";
			break;
		case ActionDefine.TypeActionOr:
			body += "var a=(+stack.pop())||0;/**/";
			body += "var b=(+stack.pop())||0;/**/";
			body += "stack[stack.length]=(a||b)?1:0;/**/";
			break;
		case ActionDefine.TypeActionNot:
			body += "var a=(+stack[stack.length-1])||0;/**/";
			body += "stack[stack.length-1]=(a==0)?1:0;/**/";
			break;
		case ActionDefine.TypeActionStringAdd:
			body += "var a=stack[stack.length-1];a=(a==null)?'':a;/**/";
			body += "var b=stack[stack.length-2];b=(b==null)?'':b;/**/";
			body += "stack[stack.length-2]=b+''+a;/**/";
			body += "stack.length--;/**/";
			break;
		case ActionDefine.TypeActionStringEquals:
			body += "var a=stack.pop()+'';/**/";
			body += "var b=stack.pop()+'';/**/";
			body += "stack[stack.length]=(a==b)?1:0;/**/";
			break;
		case ActionDefine.TypeActionStringExtract:
			body += "var count=+stack.pop();/**/";
			body += "var index=+stack.pop()-1;/**/";
			body += "var str=stack.pop()+'';/**/";
			body += "if(isNaN(count)||isNaN(index)){stack[stack.length]=''}else{/**/";
			body += "index=(index<0)?0:index;/**/";
			body += "count=(count<0)?byteLength(str):count;/**/";
			body += "stack[stack.length]=byteSubstring(str,index,count);}/**/";
			break;
		case ActionDefine.TypeActionMBStringExtract:
			body += "var count=+stack.pop();/**/";
			body += "var index=+stack.pop()-1;/**/";
			body += "var str=stack.pop()+'';/**/";
			body += "if(isNaN(count)||isNaN(index)){stack[stack.length]=''}else{/**/";
			body += "index=(index<0)?0:index;/**/";
			body += "count=(count<0)?str.length:count;/**/";
			body += "stack[stack.length]=str.substr(index,count);}/**/";
			break;
		case ActionDefine.TypeActionStringLength:
			body += "var str=stack[stack.length-1]+'';/**/";
			body += "stack[stack.length-1]=byteLength(str);/**/";
			break;
		case ActionDefine.TypeActionMBStringLength:
			body += "var str=stack[stack.length-1]+'';/**/";
			body += "stack[stack.length-1]=str.length;/**/";
			break;
		case ActionDefine.TypeActionStringLess:
			body += "var b=stack.pop()+'';/**/";
			body += "var a=stack.pop()+'';/**/";
			body += "stack[stack.length]=(a<b)?1:0;/**/";
			break;
		case ActionDefine.TypeActionToInteger:
			body += "stack[stack.length-1]=(+(stack[stack.length-1]))|0;/**/";
			break;
		case ActionDefine.TypeActionCharToAscii:
			EngineLogW("ActionCharToAscii: unimplemented correctly");
			body += "stack[stack.length-1]=(stack[stack.length-1]+'').charCodeAt(0);/**/";
			break;
		case ActionDefine.TypeActionAsciiToChar:
			EngineLogW("ActionAsciiToChar: unimplemented correctly");
			body += "stack[stack.length-1]=String.fromCharCode(stack[stack.length-1]);/**/";
			break;
		case ActionDefine.TypeActionMBCharToAscii:
			body += "stack[stack.length-1]=(stack[stack.length-1]+'').charCodeAt(0);/**/";
			break;
		case ActionDefine.TypeActionMBAsciiToChar:
			body += "stack[stack.length-1]=String.fromCharCode(stack[stack.length-1]);/**/";
			break;
		case ActionDefine.TypeActionIf:
			body += "var b=+stack.pop();/**/";
			body += "/**/if(b){offset=" + ((action.branchOffset == null)? "-1": (action.nextOffset + action.branchOffset)) + ";break;}";
			break;
		case ActionDefine.TypeActionJump:
			body += "/**/offset=" + ((action.branchOffset == null)? "-1": (action.nextOffset + action.branchOffset)) + ";break;";
			break;
		case ActionDefine.TypeActionPush:
			var llen = action.values.length;
			for(var j = 0; j < llen; j++) {
				var v = action.values[j];
				body += "/**/stack[stack.length]=";
				if(v == null) {
					body += "null;";
				} else if(typeof(v)=="string") {
					body += "unescape('" + escape(v) + "');";
				} else {
					body += v + ";";
				}
			}
			break;
		case ActionDefine.TypeActionGetVariable:
			body += "var syntax=stack.pop();/**/";
			body += "var value;/**/";
			body += "var ret=getMovieClipAndTextFromSyntax(mc,syntax);/**/";
			body += "var container=ret[0];var vname=ret[1];/**/";
			body += "value=(container&&(((container==vm.exceptionalMC)?vm.engine.rootMC:container).variables[vname]));/**/";
			body += "value=(typeof(value)=='undefined')?'':value;/**/";
			body += "stack[stack.length]=value;/**/";
			break;
		case ActionDefine.TypeActionSetVariable:
			body += "var value=stack.pop();/**/";
			body += "var vname=stack.pop();/**/";
			body += "var ret=getMovieClipAndTextFromSyntax(mc,vname);/**/";
			body += "ret[0] && (((ret[0]==vm.exceptionalMC)?vm.engine.rootMC:ret[0]).variables[ret[1]]=value);/**/";
			break;
		case ActionDefine.TypeActionGetProperty:
			body += "var p=stack.pop();/**/";
			body += "var path=stack.pop();/**/";
			body += "var target=getMovieClipFromTargetName(mc,path);/**/";
			body += "var name=memberNo[p];/**/";
			body += "if(target&&target!=vm.exceptionalMC){if(!name){stack[stack.length]=0}else{/**/";
			body += "switch(name){case'_target':stack[stack.length]=(target.parent&&target.absoluteName)||'/';break;/**/";
			body += "case'_width':var bounds=target.getBounds();stack[stack.length]=(bounds[1]-bounds[0])/20;break;/**/";
			body += "case'_height':var bounds=target.getBounds();stack[stack.length]=(bounds[3]-bounds[2])/20;break;/**/";
			body += "case'_x':case'_y':if(target.isLocked){stack[stack.length]=((target.properties[name]*50)|0)/50;}/**/";
			body += "else{var parent=target.parent;var frame=parent&&parent.properties._currentframe;var index=(name=='_x'?4:5);/**/";
			body += "stack[stack.length]=parent?((parent.mcInfo.frameIdPlacementMap[frame][target.id].matrix[index]*50)|0)/50:0}break;/**/";
			body += "default:stack[stack.length]=target.properties[name];}}}else{stack[stack.length]=p;}/**/";
			break;
		case ActionDefine.TypeActionSetProperty:
			body += "var value=stack.pop();/**/";
			body += "var p=stack.pop();/**/";
			body += "var path=stack.pop();/**/";
			body += "var target=getMovieClipFromTargetName(mc,path);/**/";
			body += "var name=memberNo[p];/**/";
			body += "if(target&&target!=vm.exceptionalMC){var isf=(value==parseFloat(value));switch(name){/**/";
			body += "case'_rotation':if(isf){target.isLocked=true;target.setRotation(+value);}break;/**/";
			body += "case'_xscale':if(isf){target.isLocked=true;target.setXScale(+value);}break;/**/";
			body += "case'_yscale':if(isf){target.isLocked=true;target.setYScale(+value);}break;/**/";
			body += "case'_alpha':case'_x':case'_y':if(isf){target.isLocked=true;target.setProperty(name,(+value)||0);}break;/**/";
			body += "case'_focusrect':case'_highquality':case'_visible':if(value==0||value==1){target.setProperty(name,+value);}break;/**/";
			body += "case'_width':var bounds=target.getBounds();var base=(bounds[1]-bounds[0])/20;var _sc=target.properties._xscale;/**/";
			body += "if(_sc!=0){base/=Math.abs(_sc)};target.isLocked=true;target.setXScale(+value/(base||1));break;/**/";
			body += "case'_height':var bounds=target.getBounds();var base=(bounds[3]-bounds[2])/20;var _sc=target.properties._yscale;/**/";
			body += "if(_sc!=0){base/=Math.abs(_sc)};target.isLocked=true;target.setYScale(+value/(base||1));break;/**/";
			body += "case'_currentframe':case'_target':case'_totalframes':case'_name':break;/**/";
			body += "default:target.properties[name]=value;break;}}/**/";
			break;
		case ActionDefine.TypeActionPlay:
			body += "mc.isPlaying=true;/**/";
			break;
		case ActionDefine.TypeActionStop:
			body += "mc.isPlaying=false;/**/";
			break;
		case ActionDefine.TypeActionCall:
			body += "var syntax=stack.pop();/**/";
			body += "var ret=getMovieClipAndTextFromSyntax(mc,syntax);/**/";
			body += "var target=ret[0];if(target&&!target.isDeleted){/**/";
			body += "var frameName=ret[1];var frameNo=target.mcInfo.frameLabelMap[(frameName+'')]||frameName;/**/";
			body += "if(!isNaN(parseInt(frameNo))){var actionList=target.mcInfo.frameActionMap[frameNo];if(actionList){/**/";
			body += "var len=actionList.length;var ret=[];for(var i=0;i<len;i++){ret[ret.length]=[target,actionList[i]];}/**/";
			body += "/**/context.finished=false;context.pc=" + action.nextOffset +";context.mc=mc;context.callInfo=ret;return true;}}}/**/";
			break;
		case ActionDefine.TypeActionGoToLabel:
			body += "/**/mc.isPlaying=false;var frameNo=mc.mcInfo.frameLabelMap[unescape('" + escape(action.label) +"')];/**/";
			body += "/**/if(frameNo){var ret=vm.engine.gotoFrame(mc,frameNo);if(!ret){context.pc=" + action.offset + ";context.mc=mc;return false;}}/**/";
			break;
		case ActionDefine.TypeActionGotoFrame:
			body += "/**/if(mc!=vm.exceptionalMC){mc.isPlaying=false;var ret=vm.engine.gotoFrame(mc," + action.frame +");";
			body += "/**/if(!ret){context.pc=" + action.offset + ";context.mc=mc;return false;}}/**/";
			break;
		case ActionDefine.TypeActionGotoFrame2:
			body += "var syntax=stack.pop()+'';var ret=getMovieClipAndTextFromSyntax(mc,syntax);var target=ret[0];/**/";
			body += "if(target&&target!=vm.exceptionalMC){var frameName=ret[1];var frameNo=target.mcInfo.frameLabelMap[(frameName+'')]||frameName;/**/";
			body += "/**/if(!isNaN(parseInt(frameNo))){target.isPlaying=" + (action.play?"true":"false") + ";var ret=vm.engine.gotoFrame(target,frameNo);/**/";
			body += "/**/if(!ret){context.pc=" + action.offset + ";context.mc=mc;stack[stack.length]=syntax;return false;}}}/**/"
			break;
		case ActionDefine.TypeActionNextFrame:
			body += "mc.isPlaying=false;var ret=vm.engine.gotoFrame(mc,mc.properties._currentframe+1);/**/";
			body += "/**/if(!ret){context.pc=" + action.offset + ";context.mc=mc;return false;}/**/";
			break;
		case ActionDefine.TypeActionPreviousFrame:
			body += "mc.isPlaying=false;var ret=vm.engine.gotoFrame(mc,mc.properties._currentframe-1);/**/"; // always success
			break;
		case ActionDefine.TypeActionSetTarget:
			body += "/**/mc=getMovieClipFromTargetName(context.originalMC,'" + action.name + "')||vm.exceptionalMC;/**/";
			break;
		case ActionDefine.TypeActionSetTarget2:
			body += "var targetName=stack.pop();mc=getMovieClipFromTargetName(context.originalMC,targetName)||vm.exceptionalMC;/**/";
			break;
		case ActionDefine.TypeActionGetURL2:
			body += "var targetSyntax=stack.pop();var url=stack.pop();/**/";

			if(action.loadTargetFlag) {
				EngineLogW("not implemented:GetURL2 load sprite. ignored");
				//break;
			}

			body += "/**/if(url){";
			if(action.sendVarsMethod==1 || action.sendVarsMethod==2) { // GET or POST
				body += "var vars=mc.variables;/**/";
				body += "var queryParams=[];for(var key in vars){queryParams.push(key+'='+(encodeURI(vars[key])||''))}/**/";
				body += "if(queryParams.length>0)url+=(url.indexOf('?')>=0?'&':'?')+queryParams.join('&');/**/";
			}
			if(action.loadVariablesFlag) {
				body += "var xhr=new XMLHttpRequest();/**/";
				switch(action.sendVarsMethod) {
				case 0: // None (GET without paraemters ??)
				case 1: // GET
					body += "xhr.open('GET', url, true);/**/";
					body += "xhr.send('');/**/";
					break;
				case 2: // POST
					body += "xhr.open('POST', url, true);/**/";
					body += "xhr.setRequestHeader('Content-Type' ,'application/x-www-form-urlencoded; charset=Shift-jis');/**/";
					body += "xhr.send(queryParams.join('&'));/**/";
					break;
				}
				body += "xhr.onreadystatechange=(function(currentMC){return function(){if(xhr.readyState == 4 && xhr.status == 200){/**/";
				body += "var targetMC=getMovieClipFromTargetName(currentMC,targetSyntax);/**/";
				body += "if(!targetMC){console.warn('[getURL2] Not found targetMC');targetMC=currentMC}/**/";
				body += "var responseArray=decodeURI(xhr.responseText).split('&');var len=responseArray.length;/**/";
				body += "for(var key=0;key<len;key++){var keyValue=responseArray[key].split('=');targetMC.variables[keyValue[0]]=keyValue[1];}/**/";
				body += "}};})(mc);/**/";
			}else{
				switch(action.sendVarsMethod) {
				case 0: // None (GET without paraemters ??)
				case 1: // GET
					body += "location.href=url;/**/";
					break;
				case 2: // POST
					body += "var form = document.createElement('form');document.body.appendChild(form);/**/";
					body += "form.action=url;form.method='post';var vars=mc.variables;/**/";
					body += "for(var key in vars){var input=document.createElement('input');input.type='hidden';input.name=key;input.value=encodeURI(vars[key]||'');form.appendChild(input);}/**/";
					body += "form.submit();/**/";
					break;
				}
			}
			// old Flash Player seems to remove MovieClip if 'url' argument is empty
			body += "}else{EngineLogW(\"'url' argument of getURL() is empty\");removeSprite(mc,targetSyntax);}/**/";
			break;
		case ActionDefine.TypeActionCloneSprite:
			body += "var depth=stack.pop();var newName=''+stack.pop();var sourceSyntax=''+stack.pop();/**/";
			body += "var sourceMC=getMovieClipFromTargetName(mc,sourceSyntax);/**/";
			body += "var characterId=sourceMC&&sourceMC.characterId;/**/";
			body += "var parent=(sourceMC&&sourceMC.parent)||null;/**/";
			body += "if(parent!=null){var dest = parent.displayList[depth];/**/";
			body += "if(dest){var destId=dest.id;if(dest.ownerMC&&dest.ownerMC[destId]&&dest.ownerMC[destId].isCloned){parent.removeObject(destId);}else{break;}}/**/";
			body += "var cloned=sourceMC.clone(newName,depth);cloned.properties._visible=1;}/**/";
			break;
		case ActionDefine.TypeActionRemoveSprite:
			body += "var targetSyntax=''+stack.pop();removeSprite(mc,targetSyntax);/**/";
			break;
		case ActionDefine.TypeActionGetTime:
			body += "stack[stack.length]=Date.now();/**/"; // TODO: Date.now() - engine.startTime
			break;
		case ActionDefine.TypeActionRandomNumber:
			body += "stack[stack.length-1]=(Math.random()*stack[stack.length-1])|0;/**/";
			break;
		case ActionDefine.TypeActionFSCommand2:
			body += "var size=stack.pop();var stackLen=stack.length;/**/";
			body += "if(stack[stackLen-1]=='JavaScript'){/**/";
			body += "var args=[];var jsFunc=eval(stack[stackLen-2]);stack.length-=2;var len=size-2;for(var i=0;i<len;i++){args[i]=stack.pop();}jsFunc.apply(null,args);stack[stack.length]=0;/**/";
			body += "}else{stack.length-=size;stack[stack.length]=-1;}/**/";
			break;
		case ActionDefine.TypeActionTrace:
			body += debug? "EngineLogD('Trace: '+stack.pop());/**/": "stack.pop();/**/";
			break;
		case 0:
			break;
		default:
			EngineLogW("not implemented action:" + action.code);
			body += "/* not implemented */";
			break;
		}
	}
	body += "offset=-1;break;default:EngineLogE('jump miss');}}context.finished=true;return true;/**/";
	//body = body.split(";").join(";\n");
	//console.log(body);
	return new Function("/**/vm,context,byteLength,byteSubstring,getMovieClipAndTextFromSyntax,getMovieClipFromTargetName,memberNo,clone,removeSprite,EngineLogD,EngineLogW", body);
	//throw "e";
};

var createRawActionFunction = function(actions, debug) {
	return function(vm,context,byteLength,byteSubstring,getMovieClipAndTextFromSyntax,getMovieClipFromTargetName,memberNo,clone,removeSprite,EngineLogD,EngineLogW) {

		var mc=context.mc;
		var stack=context.stack;

		var offset2index = {};
		var len = actions.length;
		for(var i = 0; i < len; i++) {
			var action = actions[i];
			offset2index[action.offset] = i;
		}

		for(var i = offset2index[context.pc]; i < len; i++) {
			var action = actions[i];
			switch(action.code) {
			case ActionDefine.TypeActionPushDuplicate:
				stack[stack.length]=stack[stack.length-1];
				break;
			case ActionDefine.TypeActionPop:
				stack.length--;
				break;
			case ActionDefine.TypeActionAdd:
				var a=(+stack[stack.length-1])||0;
				var b=(+stack[stack.length-2])||0;
				stack[stack.length-2]=a+b;
				stack.length--;
				break;
			case ActionDefine.TypeActionSubtract:
				var a=(+stack[stack.length-1])||0;
				var b=(+stack[stack.length-2])||0;
				stack[stack.length-2]=b-a;
				stack.length--;
				break;
			case ActionDefine.TypeActionMultiply:
				var a=(+stack[stack.length-1])||0;
				var b=(+stack[stack.length-2])||0;
				stack[stack.length-2]=a*b;
				stack.length--;
				break;
			case ActionDefine.TypeActionDivide:
				var a=(+stack[stack.length-1])||0;
				var b=(+stack[stack.length-2])||0;
				stack[stack.length-2]=(a==0)?'#ERROR':b/a;
				stack.length--;
				break;
			case ActionDefine.TypeActionLess:
				var a=(+stack.pop())||0;
				var b=(+stack.pop())||0;
				stack[stack.length]=(b<a)?1:0;
				break;
			case ActionDefine.TypeActionEquals:
				var a=(+stack.pop())||0;
				var b=(+stack.pop())||0;
				stack[stack.length]=(a==b)?1:0;
				break;
			case ActionDefine.TypeActionAnd:
				var a=(+stack.pop())||0;
				var b=(+stack.pop())||0;
				stack[stack.length]=(a&&b)?1:0;
				break;
			case ActionDefine.TypeActionOr:
				var a=(+stack.pop())||0;
				var b=(+stack.pop())||0;
				stack[stack.length]=(a||b)?1:0;
				break;
			case ActionDefine.TypeActionNot:
				var a=(+stack[stack.length-1])||0;
				stack[stack.length-1]=(a==0)?1:0;
				break;
			case ActionDefine.TypeActionStringAdd:
				var a=stack[stack.length-1];a=(a==null)?'':a;
				var b=stack[stack.length-2];b=(b==null)?'':b;
				stack[stack.length-2]=b+''+a;
				stack.length--;
				break;
			case ActionDefine.TypeActionStringEquals:
				var a=stack.pop()+'';
				var b=stack.pop()+'';
				stack[stack.length]=(a==b)?1:0;
				break;
			case ActionDefine.TypeActionStringExtract:
				var count=+stack.pop();
				var index=+stack.pop()-1;
				var str=stack.pop()+'';
				if(isNaN(count)||isNaN(index)){stack[stack.length]=''}else{
				index=(index<0)?0:index;
				count=(count<0)?byteLength(str):count;
				stack[stack.length]=byteSubstring(str,index,count);}
				break;
			case ActionDefine.TypeActionMBStringExtract:
				var count=+stack.pop();
				var index=+stack.pop()-1;
				var str=stack.pop()+'';
				if(isNaN(count)||isNaN(index)){stack[stack.length]=''}else{
				index=(index<0)?0:index;
				count=(count<0)?str.length:count;
				stack[stack.length]=str.substr(index,count);}
				break;
			case ActionDefine.TypeActionStringLength:
				var str=stack[stack.length-1]+'';
				stack[stack.length-1]=byteLength(str);
				break;
			case ActionDefine.TypeActionMBStringLength:
				var str=stack[stack.length-1]+'';
				stack[stack.length-1]=str.length;
				break;
			case ActionDefine.TypeActionStringLess:
				var b=stack.pop()+'';
				var a=stack.pop()+'';
				stack[stack.length]=(a<b)?1:0;
				break;
			case ActionDefine.TypeActionToInteger:
				stack[stack.length-1]=(+(stack[stack.length-1]))|0;
				break;
			case ActionDefine.TypeActionCharToAscii:
				EngineLogW("ActionCharToAscii: unimplemented correctly");
				stack[stack.length-1]=(stack[stack.length-1]+'').charCodeAt(0);
				break;
			case ActionDefine.TypeActionAsciiToChar:
				EngineLogW("ActionAsciiToChar: unimplemented correctly");
				stack[stack.length-1]=String.fromCharCode(stack[stack.length-1]);
				break;
			case ActionDefine.TypeActionMBCharToAscii:
				stack[stack.length-1]=(stack[stack.length-1]+'').charCodeAt(0);
				break;
			case ActionDefine.TypeActionMBAsciiToChar:
				stack[stack.length-1]=String.fromCharCode(stack[stack.length-1]);
				break;
			case ActionDefine.TypeActionIf:
				var b=+stack.pop();
				if(b) i = (action.branchOffset == null)? len: offset2index[(action.nextOffset + action.branchOffset)]-1;
				break;
			case ActionDefine.TypeActionJump:
				i = (action.branchOffset == null)? len: offset2index[(action.nextOffset + action.branchOffset)]-1;
				break;
			case ActionDefine.TypeActionPush:
				Array.prototype.push.apply(stack, action.values);
				break;
			case ActionDefine.TypeActionGetVariable:
				var syntax=stack.pop();
				var value;
				var ret=getMovieClipAndTextFromSyntax(mc,syntax);
				var container=ret[0];var vname=ret[1];
				value=(container&&(((container==vm.exceptionalMC)?vm.engine.rootMC:container).variables[vname]));
				value=(typeof(value)=='undefined')?'':value;
				stack[stack.length]=value;
				break;
			case ActionDefine.TypeActionSetVariable:
				var value=stack.pop();
				var vname=stack.pop();
				var ret=getMovieClipAndTextFromSyntax(mc,vname);
				ret[0] && (((ret[0]==vm.exceptionalMC)?vm.engine.rootMC:ret[0]).variables[ret[1]]=value);
				break;
			case ActionDefine.TypeActionGetProperty:
				var p=stack.pop();
				var path=stack.pop();
				var target=getMovieClipFromTargetName(mc,path);
				var name=memberNo[p];
				if(target&&target!=vm.exceptionalMC){if(!name){stack[stack.length]=0}else{
				switch(name){case'_target':stack[stack.length]=(target.parent&&target.absoluteName)||'/';break;
				case'_width':var bounds=target.getBounds();stack[stack.length]=(bounds[1]-bounds[0])/20;break;
				case'_height':var bounds=target.getBounds();stack[stack.length]=(bounds[3]-bounds[2])/20;break;
				case'_x':case'_y':if(target.isLocked){stack[stack.length]=((target.properties[name]*50)|0)/50;}
				else{var parent=target.parent;var frame=parent&&parent.properties._currentframe;var index=(name=='_x'?4:5);
				stack[stack.length]=parent?((parent.mcInfo.frameIdPlacementMap[frame][target.id].matrix[index]*50)|0)/50:0;}break;
				default:stack[stack.length]=target.properties[name];}}}else{stack[stack.length]=p;}
				break;
			case ActionDefine.TypeActionSetProperty:
				var value=stack.pop();
				var p=stack.pop();
				var path=stack.pop();
				var target=getMovieClipFromTargetName(mc,path);
				var name=memberNo[p];
				if(target&&target!=vm.exceptionalMC){var isf=(value==parseFloat(value));switch(name){
				case'_rotation':if(isf){target.isLocked=true;target.setRotation(+value);}break;
				case'_xscale':if(isf){target.isLocked=true;target.setXScale(+value);}break;
				case'_yscale':if(isf){target.isLocked=true;target.setYScale(+value);}break;
				case'_alpha':case'_x':case'_y':if(isf){target.isLocked=true;target.setProperty(name,(+value)||0);}break;
				case'_focusrect':case'_highquality':case'_visible':if(value==0||value==1){target.setProperty(name,+value);}break;
				case'_width':var bounds=target.getBounds();var base=(bounds[1]-bounds[0])/20;var _sc=target.properties._xscale;
				if(_sc!=0){base/=Math.abs(_sc)};target.isLocked=true;target.setXScale(+value/(base||1));break;
				case'_height':var bounds=target.getBounds();var base=(bounds[3]-bounds[2])/20;var _sc=target.properties._yscale;
				if(_sc!=0){base/=Math.abs(_sc)};target.isLocked=true;target.setYScale(+value/(base||1));break;
				case'_currentframe':case'_target':case'_totalframes':case'_name':break;
				default:target.properties[name]=value;break;}}
				break;
			case ActionDefine.TypeActionPlay:
				mc.isPlaying=true;
				break;
			case ActionDefine.TypeActionStop:
				mc.isPlaying=false;
				break;
			case ActionDefine.TypeActionCall:
				var syntax=stack.pop();
				var ret=getMovieClipAndTextFromSyntax(mc,syntax);
				var target=ret[0];if(target&&!target.isDeleted){
				var frameName=ret[1];var frameNo=target.mcInfo.frameLabelMap[(frameName+'')]||frameName;
				if(!isNaN(parseInt(frameNo))){var actionList=target.mcInfo.frameActionMap[frameNo];if(actionList){
				var actLen=actionList.length;var ret=[];for(var j=0;j<actLen;j++){ret[ret.length]=[target,actionList[j]];}
				context.finished=false;context.pc=action.nextOffset;context.mc=mc;context.callInfo=ret;return true;}}}
				break;
			case ActionDefine.TypeActionGoToLabel:
				mc.isPlaying=false;var frameNo=mc.mcInfo.frameLabelMap[action.label];
				if(frameNo){var ret=vm.engine.gotoFrame(mc,frameNo);if(!ret){context.pc=action.offset;context.mc=mc;return false;}}
				break;
			case ActionDefine.TypeActionGotoFrame:
				if(mc!=vm.exceptionalMC){mc.isPlaying=false;var ret=vm.engine.gotoFrame(mc,action.frame);
				if(!ret){context.pc=action.frame;context.mc=mc;return false;}}
				break;
			case ActionDefine.TypeActionGotoFrame2:
				var syntax=stack.pop()+'';var ret=getMovieClipAndTextFromSyntax(mc,syntax);var target=ret[0];
				if(target&&target!=vm.exceptionalMC){var frameName=ret[1];var frameNo=target.mcInfo.frameLabelMap[(frameName+'')]||frameName;
				if(!isNaN(parseInt(frameNo))){target.isPlaying=action.play;var ret=vm.engine.gotoFrame(target,frameNo);
				if(!ret){context.pc=action.offset;context.mc=mc;stack[stack.length]=syntax;return false;}}}
				break;
			case ActionDefine.TypeActionNextFrame:
				mc.isPlaying=false;var ret=vm.engine.gotoFrame(mc,mc.properties._currentframe+1);
				if(!ret){context.pc=action.offset;context.mc=mc;return false;}
				break;
			case ActionDefine.TypeActionPreviousFrame:
				mc.isPlaying=false;var ret=vm.engine.gotoFrame(mc,mc.properties._currentframe-1); // always success
				break;
			case ActionDefine.TypeActionSetTarget:
				mc=getMovieClipFromTargetName(context.originalMC,action.name)||vm.exceptionalMC;
				break;
			case ActionDefine.TypeActionSetTarget2:
				var targetName=stack.pop();mc=getMovieClipFromTargetName(context.originalMC,targetName)||vm.exceptionalMC;
				break;
			case ActionDefine.TypeActionGetURL2:
				if(action.loadTargetFlag) {
					EngineLogW("not implemented:GetURL2 load sprite. ignored");
				}

				var targetSyntax=stack.pop();var url=stack.pop();
				if(url){
					if(action.sendVarsMethod==1 || action.sendVarsMethod==2) { // GET or POST
						var vars=mc.variables;
						var queryParams=[];for(var key in vars){queryParams.push(key+'='+(encodeURI(vars[key])||''))}
						if(queryParams.length>0)url+=(url.indexOf('?')>=0?'&':'?')+queryParams.join('&');
					}
					if(action.loadVariablesFlag) {
						var xhr=new XMLHttpRequest();
						switch(action.sendVarsMethod) {
						case 0: // None (GET without paraemters ??)
						case 1: // GET
							xhr.open('GET', url, true);
							xhr.send('');
							break;
						case 2: // POST
							xhr.open('POST', url, true);
							xhr.setRequestHeader('Content-Type' ,'application/x-www-form-urlencoded; charset=Shift-jis');
							xhr.send(queryParams.join('&'));
						break;
						}
						xhr.onreadystatechange=(function(currentMC){return function(){if(xhr.readyState == 4 && xhr.status == 200){
						var targetMC=getMovieClipFromTargetName(currentMC,targetSyntax);
						if(!targetMC){console.warn('[getURL2] Not found targetMC');targetMC=currentMC}
						var responseArray=decodeURI(xhr.responseText).split('&');var resLen=responseArray.length;
						for(var key=0;key<resLen;key++){var keyValue=responseArray[key].split('=');targetMC.variables[keyValue[0]]=keyValue[1];}
						}};})(mc);
					}else{
						switch(action.sendVarsMethod) {
						case 0: // None (GET without paraemters ??)
						case 1: // GET
							location.href=url;
							break;
						case 2: // POST
							var form = document.createElement('form');document.body.appendChild(form);
							form.action=url;form.method='post';var vars=mc.variables;
							for(var key in vars){var input=document.createElement('input');input.type='hidden';input.name=key;input.value=encodeURI(vars[key]||'');form.appendChild(input);}
							form.submit();
							break;
						}
					}
				}else{
					EngineLogW("'url' argument of getURL() is empty");
					// old Flash Player seems to remove MovieClip if 'url' argument is empty
					removeSprite(mc,targetSyntax);
				}
				break;
			case ActionDefine.TypeActionCloneSprite:
				var depth=stack.pop();var newName=''+stack.pop();var sourceSyntax=''+stack.pop();
				var sourceMC=getMovieClipFromTargetName(mc,sourceSyntax);
				var characterId=sourceMC&&sourceMC.characterId;
				var parent=(sourceMC&&sourceMC.parent)||null;
				if(parent!=null){var dest = parent.displayList[depth];
				if(dest){var destId=dest.id;if(dest.ownerMC&&dest.ownerMC[destId]&&dest.ownerMC[destId].isCloned){parent.removeObject(destId);}else{return -1;}}
				var cloned=sourceMC.clone(newName,depth);cloned.properties._visible=1;}
				break;
			case ActionDefine.TypeActionRemoveSprite:
				var targetSyntax=''+stack.pop();removeSprite(mc,targetSyntax);
				break;
			case ActionDefine.TypeActionGetTime:
				stack[stack.length]=Date.now(); // TODO: Date.now() - engine.startTime
				break;
			case ActionDefine.TypeActionRandomNumber:
				stack[stack.length-1]=(Math.random()*stack[stack.length-1])|0;
				break;
			case ActionDefine.TypeActionFSCommand2:
				var size=stack.pop();var stackLen=stack.length;
				if(stack[stackLen-1]=='JavaScript'){
				var args=[];var jsFunc=eval(stack[stackLen-2]);stack.length-=2;var argc=size-2;for(var j=0;j<argc;j++){args[j]=stack.pop();}jsFunc.apply(null,args);stack[stack.length]=0;
				}else{stack.length-=size;stack[stack.length]=-1;}
				break;
			case ActionDefine.TypeActionTrace:
				debug? EngineLogD("Trace: "+stack.pop()): stack.pop();
				break;
			case 0:
				break;
			default:
				EngineLogW("not implemented action:" + action.code);
				/* not implemented */
				break;
			}
		}
		context.finished=true;
		return true;

	}
};

var byteLength = function(str) {
	var len = 0;
	for(var i = 0; i < str.length; i++) {
		len += isHankaku(str.charAt(i)) ? 1 : 2;
	}
	return len;
};

var byteSubstring = function(targetString, index, count) {
	var currentPos = 0;
	var currentLength = 0;
	var result = [];
	var resultLength = 0;

	// Find start position
	while(currentLength < index) {
		var str = targetString.charAt(currentPos);
		var len = isHankaku(str) ? 1 : 2;

		currentLength += len;
		currentPos++;
	}
	// start from half-byte char
	if(currentLength != index) {
		result.push("\uFF65"); // naka-guro
		resultLength = 1;
	}

	for(;currentPos < targetString.length && resultLength < count; currentPos++) {
		var str = targetString.charAt(currentPos);
		var len = isHankaku(str) ? 1 : 2;

		if(resultLength + len > count) {
			result[result.length] = "\uFF65";
			resultLength += 1;
		} else {
			result[result.length] = str;
			resultLength += len;
		}
	}

	return result.join("");
};

var getMovieClipAndTextFromSyntax = function(mc, syntax) {
	var container = (mc.isButton && mc.parent) || mc;
	var vname = syntax + "";
	var ret = vname.split(":");
	if(ret.length == 2) {
		container = getMovieClipFromTargetName(mc, ret[0]);
		vname = ret[1];
	}
	return [container, vname];
};

var getMovieClipFromTargetName = function(mc, name) {
	if(name == "") {
		return (!mc.exception && mc) || null;
	}
	mc = (mc.exception && mc.engine.rootMC) || mc;
	if(name == "_level0") {
		return mc.engine.rootMC;
	}
	var ret = name.split("/");
	var index = 0;
	if(ret[0] == "") {
		mc = mc.engine.rootMC;
		index++;
	}
	
	var str;
	for(; index < ret.length; index++) {
		str = ret[index];
		if(str == "" || str == ".") {
		} else if(str == "..") {
			if(mc.parent) {
				mc = mc.parent;
				while(mc.isButton) {
					mc = mc.parent;
				}
			} else {
				return null;
			}
		} else {
			(str.charAt(0) == ".") && (str = str.substring(1));
			mc = mc.findChild(str);
			if(!mc) {
				return null;
			}
		}
	}
	return mc;
};

var memberNo = [
	"_x", "_y", "_xscale", "_yscale", "_currentframe", "_totalframes",
	"_alpha", "_visible", "_width", "_height", "_rotation", "_target",
	"_framesloaded", "_name", "_droptarget", "_url", "_highquality",
	"_focusrect"/*, "_soundbuftime", "_quality", "_xmouse", "_ymouse"*/];


/*
	byteLength
	byteSubstring
	getMovieClipAndTextFromSyntax
	getMovieClipFromTargetName
	memberNo*/

var clone = function (obj1) {
	var obj2 = {};
	for (var v in obj1) {
		obj2[v] = obj1[v];
	}
	return obj2;
};

var removeSprite = function(mc, syntax) {
	// Determine target
	var target = getMovieClipFromTargetName(mc, syntax);
	var parent = target? target.parent: null;
	if(parent == null || target == null) {
		// don't allow if target doesn't exist or target is rootMC
		return;
	}

	for(var layer in parent.displayList) {
		// Specification : MC<16384 cannot be deleted.
		if(layer >= 16384) {
			var idInfo = parent.displayList[layer];
			mc = idInfo.ownerMC[idInfo.id];
			if(mc == target) {
				if(mc.isCloned) {
					// Delete
					parent.removeObject(idInfo.id);
					return;
				} else {
					EngineLogW("[removeSprite] not cloned", mc, syntax);
				}
			}
		}
	}
};
