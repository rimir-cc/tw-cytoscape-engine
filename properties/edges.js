/*\
title: $:/plugins/rimir/cytoscape-engine/properties/edges.js
type: application/javascript
module-type: cytoscape-property

Edge visual properties for Cytoscape.

\*/

"use strict";

exports.name = "edges";

exports.properties = {
	edges: {
		hidden: { type: "boolean", default: false },
		width: { type: "number", min: 0, default: 1 },
		arrows: {
			type: "enum",
			default: "to",
			values: ["no", "to", "from", "middle"],
			multiple: true
		},
		stroke: {
			type: "enum",
			default: "solid",
			values: ["solid", "dashed", "dotted"]
		},
		roundness: { type: "number", min: 0, max: 1, default: 0.5, hidden: true },
		label: { type: "string" },
		smooth: {
			type: "enum",
			default: "dynamic",
			values: ["no", "dynamic", "continuous", "discrete", "diagonalCross", "straightCross", "horizontal", "vertical", "curvedCW", "curvedCCW", "cubicBezier"],
			hidden: true
		}
	}
};

exports.process = function(objects, changes) {
	if (!changes.edges) { return; }
	for (var id in changes.edges) {
		var edge = changes.edges[id];
		if (!edge) { continue; }
		// Normalize arrows from comma-separated string if needed
		if (edge.arrows && typeof edge.arrows === "string") {
			edge.arrows = edge.arrows.replace(/,/g, " ");
		}
	}
};
