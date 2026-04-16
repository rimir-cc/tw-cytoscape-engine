/*\
title: $:/plugins/rimir/cytoscape-engine/properties/nodes.js
type: application/javascript
module-type: cytoscape-property

Node visual properties for Cytoscape.

\*/

"use strict";

exports.name = "nodes";

exports.properties = {
	nodes: {
		borderWidth: { type: "number", min: 0, default: 1 },
		label: { type: "string" },
		fixed: { type: "boolean", default: false },
		size: { type: "number", min: 0, default: 25 },
		minWidth: { type: "number", min: 1, max: 500, hidden: true },
		maxWidth: { type: "number", min: 1, max: 500, hidden: true },
		shape: {
			type: "enum",
			default: "dot",
			values: ["dot", "box", "ellipse", "circle", "diamond", "triangle", "triangleDown", "star", "hexagon", "database"]
		},
		cluster: { type: "string", hidden: true },
		image: { type: "image" }
	}
};
