/*\
title: $:/plugins/rimir/cytoscape-engine/properties/interaction.js
type: application/javascript
module-type: cytoscape-property

Interaction settings: zoom, pan, navigation.

\*/

"use strict";

exports.name = "interaction";

exports.properties = {
	graph: {
		navigation: { type: "boolean" },
		zoom: { type: "boolean", default: true },
		zoomSpeed: { type: "number", min: 0, max: 10, default: 1 }
	}
};

exports.init = function(cy) {
	this._interactionCy = cy;
};

exports.process = function(objects, changes) {
	if (!changes.graph || !this._interactionCy) { return; }
	var cy = this._interactionCy;
	var graph = changes.graph;
	if (graph.zoom !== undefined) {
		cy.userZoomingEnabled(graph.zoom);
	}
	if (graph.zoomSpeed !== undefined) {
		cy.wheelSensitivity = graph.zoomSpeed * 0.3;
	}
	if (graph.navigation !== undefined) {
		cy.userPanningEnabled(graph.navigation !== false);
	}
};
