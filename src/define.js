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


var TagDefine = {};
TagDefine.TypeTagEnd = 0;
TagDefine.TypeTagShowFrame = 1;
TagDefine.TypeTagDefineShape = 2;
TagDefine.TypeTagPlaceObject = 4;
TagDefine.TypeTagDefineBits = 6;
TagDefine.TypeTagDefineButton = 7;
TagDefine.TypeTagJPEGTables = 8;
TagDefine.TypeTagSetBackgroundColor = 9;
TagDefine.TypeTagDefineFont = 10;
TagDefine.TypeTagDefineText = 11;
TagDefine.TypeTagDoAction = 12;
TagDefine.TypeTagDefineBitsLossless = 20;
TagDefine.TypeTagDefineBitsJPEG2 = 21;
TagDefine.TypeTagDefineShape2 = 22;
TagDefine.TypeTagPlaceObject2 = 26;
TagDefine.TypeTagRemoveObject2 = 28;
TagDefine.TypeTagDefineShape3 = 32;
TagDefine.TypeTagDefineText2 = 33;
TagDefine.TypeTagDefineButton2 = 34;
TagDefine.TypeTagDefineBitsJPEG3 = 35;
TagDefine.TypeTagDefineBitsLossless2 = 36;
TagDefine.TypeTagDefineEditText = 37;
TagDefine.TypeTagDefineSprite = 39;
TagDefine.TypeTagFrameLabel = 43;
TagDefine.TypeTagDefineMorphShape = 46;
TagDefine.TypeTagDefineFont2 = 48;

var EdgeDefine = {};
EdgeDefine.TypeStraight = 0;
EdgeDefine.TypeCurve = 1;
EdgeDefine.TypeStyleChange = 2;

var FillStyleDefine = {};
FillStyleDefine.TypeSolidFill = 0;
FillStyleDefine.TypeLinearGradientFill = 0x10;
FillStyleDefine.TypeRadialGradientFill = 0x12;
//FillStyleDefine.TypeFocalRadialGradientFill = 0x13; swf8 or later only
FillStyleDefine.TypeRepeatingBitmapFill= 0x40;
FillStyleDefine.TypeClippedBitmapFill= 0x41;
FillStyleDefine.TypeNonSmoothedRepeatingBitmapFill= 0x42;
FillStyleDefine.TypeNonSmoothedClipedBitmapFill= 0x43;

var ActionDefine = {};
ActionDefine.TypeActionNextFrame = 0x04;
ActionDefine.TypeActionPreviousFrame = 0x05;
ActionDefine.TypeActionPlay = 0x06;
ActionDefine.TypeActionStop = 0x07;
ActionDefine.TypeActionToggleQuality = 0x08;
ActionDefine.TypeActionStopSounds = 0x09;
ActionDefine.TypeActionPop = 0x17;
ActionDefine.TypeActionAdd = 0x0A;
ActionDefine.TypeActionSubtract = 0x0B;
ActionDefine.TypeActionMultiply = 0x0C;
ActionDefine.TypeActionDivide = 0x0D;
ActionDefine.TypeActionEquals = 0x0E;
ActionDefine.TypeActionLess = 0x0F;
ActionDefine.TypeActionAnd = 0x10;
ActionDefine.TypeActionOr = 0x11;
ActionDefine.TypeActionNot = 0x12;
ActionDefine.TypeActionStringEquals = 0x13;
ActionDefine.TypeActionStringLength = 0x14;
ActionDefine.TypeActionStringExtract = 0x15;
ActionDefine.TypeActionToInteger = 0x18;
ActionDefine.TypeActionGetVariable = 0x1C;
ActionDefine.TypeActionSetVariable = 0x1D;
ActionDefine.TypeActionSetTarget2 = 0x20;
ActionDefine.TypeActionStringAdd = 0x21;
ActionDefine.TypeActionGetProperty = 0x22;
ActionDefine.TypeActionSetProperty = 0x23;
ActionDefine.TypeActionCloneSprite = 0x24;
ActionDefine.TypeActionRemoveSprite = 0x25;
ActionDefine.TypeActionTrace = 0x26;
ActionDefine.TypeActionStartDrag = 0x27;
ActionDefine.TypeActionEndDrag = 0x28;
ActionDefine.TypeActionStringLess = 0x29;
ActionDefine.TypeActionFSCommand2 = 0x2D;
ActionDefine.TypeActionRandomNumber = 0x30;
ActionDefine.TypeActionMBStringLength = 0x31;
ActionDefine.TypeActionCharToAscii = 0x32;
ActionDefine.TypeActionAsciiToChar = 0x33;
ActionDefine.TypeActionGetTime = 0x34;
ActionDefine.TypeActionMBStringExtract = 0x35;
ActionDefine.TypeActionMBCharToAscii = 0x36;
ActionDefine.TypeActionMBAsciiToChar = 0x37;
ActionDefine.TypeActionPushDuplicate = 0x4C;
ActionDefine.TypeActionGotoFrame = 0x81;
ActionDefine.TypeActionGetURL = 0x83;
ActionDefine.TypeActionWaitForFrame = 0x8A;
ActionDefine.TypeActionSetTarget = 0x8B;
ActionDefine.TypeActionGoToLabel = 0x8C;
ActionDefine.TypeActionPush = 0x96;
ActionDefine.TypeActionJump = 0x99;
ActionDefine.TypeActionIf = 0x9D;
ActionDefine.TypeActionCall = 0x9E;
ActionDefine.TypeActionGotoFrame2 = 0x9F;
ActionDefine.TypeActionWaitForFrame2 = 0x8D;
ActionDefine.TypeActionGetURL2 = 0x9A;
