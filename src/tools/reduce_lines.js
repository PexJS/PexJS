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


var reduceLines = function(tagList, threshold) {
	var reduceLinesTag = function(tag) {
		var shapes = tag.shapes;
	
		var begin = 1;
		var result = [shapes[0]];
		var len = shapes.length;
	//console.log(len);
		for(var i = 1; i < len; i++) {
			var shape = shapes[i];
	
			if(shape.type == EdgeDefine.TypeStyleChange || i == len-1) {
				var points = [], curves = {};
				calcPoints(shapes, begin, i, points, curves);
	
				var reducedPoints = reducePoints(points, 0, points.length);
				var len2 = reducedPoints.length-1;
				for(var j = 0; j < len2; j++) {
					var p0 = reducedPoints[j];
					var p1 = reducedPoints[j+1];
					var p2 = reducedPoints[j+2];
					if(curves[p0] && p1 == p0+1 && p2 == p0+2) {
						result[result.length] = shapes[curves[p0]];
						j++;
					} else {
						var from = points[p0];
						var to = points[p1];
						var dx = to[0]-from[0];
						var dy = to[1]-from[1];
						result[result.length] = {type:EdgeDefine.TypeStraight, x:dx, y:dy};
					}
				}
				result[result.length] = shape;
				begin = i+1;
			}
		}
		tag.shapes = result;
	//console.log(result.length);
	};
	
	var calcPoints = function(shapes, begin, end, points, curves) {
		// points = []; // [0 .. end - begin + (# of curve edge)]
		// curves = {}; // index of points -> index of shapes (only curves)
	
		var point = [0, 0];
		points[0] = point;
		for(var i = begin; i < end; i++) {
			var shape = shapes[i];
	
			switch(shape.type) {
	/*
			case EdgeDefine.TypeStyleChange:
				point = [shape.dx, shape.dy];
				points[points.length] = point;
				break;
	*/
			case EdgeDefine.TypeCurve:
				curves[points.length-1] = i;
	
				points[points.length] = [point[0]+shape.cx*3/4+shape.ax/4, point[1]+shape.cy*3/4+shape.ay/4];
				point = [point[0]+shape.cx+shape.ax, point[1]+shape.cy+shape.ay];
				points[points.length] = point;
	
				break;
	
			case EdgeDefine.TypeStraight:
				point = [point[0]+shape.x, point[1]+shape.y];
				points[points.length] = point;
				break;
	
			default:
				throw "Unknown edge type";
			}
		}
	}
	
	// Douglas-Peucker method. See http://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm
	
	var EPS = threshold;
	
	var reducePoints = function(points, begin, end) {
		if(begin == end - 1) return [begin, end-1];
	
		var corr = calcCorr(points[begin], points[end-1]);
	
		if(corr[0] == 0 && corr[1] == 0) {
			// care for loop path
			var nonLoop = reducePoints(points, begin, end-1);
			nonLoop.push(end-1);
			return nonLoop;
		}
	
		var dmax = 0, index = 0;
		for(var i = begin + 1; i < end - 1; i++) {
			var d = distance(points[i], corr);
			if(d > dmax) {
				index = i;
				dmax = d;
			}
		}
		
		if(dmax >= EPS) {
			var res1 = reducePoints(points, begin, index+1);
			var res2 = reducePoints(points, index, end);
			
			res1.pop(); // remove duplicated point;
			return res1.concat(res2);
		} else {
			return [begin, end-1];
		}
	};
	
	var calcCorr = function(p1, p2) {
		var x1 = p1[0];
		var y1 = p1[1];
		var x2 = p2[0];
		var y2 = p2[1];
	
		var a = y1-y2;
		var b = -(x1-x2);
		var c = x1*y2-x2*y1;
		return [a, b, c, Math.sqrt(a*a+b*b)]; 
	};
	
	var distance = function(p, corr) {
		return Math.abs(corr[0]*p[0] + corr[1]*p[1] + corr[2]) / corr[3];
	};
	
/*
	var test1 = [ [0,0], [1,1], [100,100]];
	var a1 = reducePoints(test1, 0, test1.length);
	console.log(a1); // [0,2]
	
	var test2 = [ [0,0], [100,0], [100,100]];
	var a2 = reducePoints(test2, 0, test2.length);
	console.log(a2); // [0,1,2]
	
	var test3 = [ [0,0], [1,0], [100,0], [100,100]];
	var a3 = reducePoints(test3, 0, test3.length);
	console.log(a3); // [0,2,3]
	
	var test4 = [ [0,0], [100,0], [100,100], [0,0]];
	var a4 = reducePoints(test4, 0, test4.length);
	console.log(a4); // [0,1,2,3]
*/
	var len = tagList.length;
	for(var i = 0; i < len; i++) {
		var tag = tagList[i];
		switch(tag.type) {
		case TagDefine.TypeTagDefineShape:
		case TagDefine.TypeTagDefineShape2:
		case TagDefine.TypeTagDefineShape3:
			reduceLinesTag(tag);
		}
	}
};

