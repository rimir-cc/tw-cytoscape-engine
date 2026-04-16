/*\
title: $:/plugins/rimir/cytoscape-engine/properties/layout.js
type: application/javascript
module-type: cytoscape-property

Layout algorithm configuration.

\*/

"use strict";

exports.name = "layout";

exports.properties = {
	graph: {
		hierarchy: { type: "boolean", default: false },
		hierarchyDirection: {
			type: "enum",
			default: "UD",
			values: ["UD", "DU", "LR", "RL"]
		},
		hierarchyNodeSpacing: { type: "number", min: 0, max: 200, default: 100 }
	}
};

var directionMap = {
	"UD": "TB",
	"DU": "BT",
	"LR": "LR",
	"RL": "RL"
};

exports.init = function(cy) {
	this._cy = cy;
	this._layoutApplied = false;
};

exports.process = function(objects, changes) {
	if (!changes.graph) { return; }
	var graph = changes.graph;
	if (graph.hierarchy && this._cy && !this._layoutApplied) {
		var dir = directionMap[graph.hierarchyDirection || "UD"] || "TB";
		var spacing = graph.hierarchyNodeSpacing || 100;
		// Use breadthfirst layout for hierarchical view
		this._cy.layout({
			name: "breadthfirst",
			directed: true,
			spacingFactor: spacing / 50,
			animate: false
		}).run();
		this._layoutApplied = true;
	}
};
