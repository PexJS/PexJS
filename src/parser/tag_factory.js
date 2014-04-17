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


var TagGeneral = function(binary, pos, length, type) {
	EngineLogW("parser: not supported tag detected [" + type +"]");
	this.type = type;
};

var TagFactory = {
	"0":	TagEnd,
	"1":	TagShowFrame,
	"2":	TagDefineShape,
	"4":	TagPlaceObject,
	"6":	TagDefineBits,
	"7":	TagDefineButton,
	"8":	TagJPEGTables,
	"9":	TagSetBackgroundColor,
	"10":	TagDefineFont,
	"11":	TagDefineText,
	"12":	TagDoAction,
	"20":	TagDefineBitsLossless,
	"21":	TagDefineBitsJPEG2,
	"22":	TagDefineShape2,
	"26":	TagPlaceObject2,
	"28":	TagRemoveObject2,
	"32":	TagDefineShape3,
	"33":	TagDefineText2,
	"34":	TagDefineButton2,
	"35":	TagDefineBitsJPEG3,
	"36":	TagDefineBitsLossless2,
	"37":	TagDefineEditText,
	"39":	TagDefineSprite,
	"43":	TagFrameLabel,
	"46":	TagDefineMorphShape,
	"48":	TagDefineFont2
};
