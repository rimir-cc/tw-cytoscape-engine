/*\
title: $:/plugins/rimir/cytoscape-engine/properties/position.js
type: application/javascript
module-type: cytoscape-property

Handles node position tracking and persistence.

\*/

"use strict";

exports.name = "position";

exports.properties = {
	nodes: {
		x: { type: "number" },
		y: { type: "number" }
	}
};

exports.process = function(objects, changes) {
	if (!changes.nodes) { return; }
	for (var id in changes.nodes) {
		var node = changes.nodes[id];
		if (!node) { continue; }
		// Track whether node has explicit position
		if (node.x !== undefined && node.y !== undefined) {
			node._hasPosition = true;
		}
	}
};
