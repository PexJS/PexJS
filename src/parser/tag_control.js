var TagEnd = function(binary, pos, length, type) {
};
TagEnd.prototype.type = TagDefine.TypeTagEnd;

var TagSetBackgroundColor = function(binary, pos, length, type, delayEval, dataStore) {
	setProperty(this, "color", function() {
		return getRGB(binary, pos);
	}, delayEval);
};
TagSetBackgroundColor.prototype.type = TagDefine.TypeTagSetBackgroundColor;

var TagFrameLabel = function(binary, pos, length, type, delayEval, dataStore) {
	setProperty(this, "name", function() {
		return getString(binary, pos);
	}, delayEval);
};
TagFrameLabel.prototype.type = TagDefine.TypeTagFrameLabel;

