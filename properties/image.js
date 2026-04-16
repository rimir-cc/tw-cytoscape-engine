/*\
title: $:/plugins/rimir/cytoscape-engine/properties/image.js
type: application/javascript
module-type: cytoscape-property

Node image support: shape="image" or shape="circularImage".

\*/

"use strict";

exports.name = "image";

exports.properties = {
	nodes: {
		image: { type: "image" },
		circular: { type: "boolean", parent: "image", default: false }
	}
};

exports.process = function(objects, changes) {
	if (!changes.nodes) { return; }
	for (var id in changes.nodes) {
		var node = changes.nodes[id];
		if (!node) { continue; }
		if (node.image) {
			// Store image URL and circular flag for applyNodeStyle
			node._image = node.image;
			node._circular = node.circular || false;
			// Set shape to indicate image mode
			node.shape = node.circular ? "circularImage" : "image";
			node.circular = undefined;
		} else {
			if (node.shape === "image" || node.shape === "circularImage") {
				node.shape = undefined;
			}
		}
	}
};
