var MovieClipInfo = function() {
	// movie clip information
	
	this.onupdate = null;
	// loaded frames
	this.framesLoaded = 0;
	// actual total frame, which apreares before TagEnd 
	this.actualTotalFrames = 0;
	
	// id list of the frame
	this.frameIdList = []; // frame -> existing id list
	// id list which are born in the frame
	this.frameBornIdList = []; // frame -> born id list
	// id list which disappear in the frame
	this.frameDeadIdList = []; // frame -> dead id list
	// get placement data from frame and id
	this.frameIdPlacementMap = []; // frame -> {id: placement} map
	// flag whether the placement is changed or not at the frame
	this.frameIdModifiedMap = []; // frame -> {id: modified} map
	// the mapping between id and characterId
	this.idInfo = {}; // id -> {id: id, placement: placement, characterId: characterId, layer: layer, born: frame}
	// frame name mapping
	this.frameLabelMap = {}; // Label Name -> frame
	// frame action mapping
	this.frameActionMap = {}; // frame -> [actions]
	// button action mapping
	this.buttonActionMap = {}; // key -> [actions]
	// list of frames which have '_noskip' label
	this.noskipFrameList = [];

	this.idCounter = 0;
};

MovieClipInfo.prototype.updateCallback = function() {
	this.onupdate && this.onupdate();
};
