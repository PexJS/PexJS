var TagDefineSprite = function(binary, pos, length, type, delayEval, dataStore) {
	this.id = getUI16(binary, pos);
	setProperties(this, function() {
		var result = {};
		var p = pos + 2;
		result.frameCount = getUI16(binary, p);
		p += 2;
		
		var tags = [];
		while(p < pos + length) {
			var feed = getUI16(binary, p);
			var size = 2;
			var tagType = feed >> 6;
			
			var tagLength = feed & 0x3F;
			if(tagLength == 0x3f) {
				tagLength = getUI32(binary, p + 2);
				size += 4;
			}
			
			var tagClass = TagFactory[tagType] || TagGeneral;
			var instance = new tagClass(binary, p + size, tagLength, tagType);
			tags.push(instance);
			p += tagLength + size;
		}
		
		result.tags = tags;
		return result;
	}, ["frameCount", "tags"], delayEval);
};
TagDefineSprite.prototype.type = TagDefine.TypeTagDefineSprite;
