/*\
title: $:/plugins/rimir/cytoscape-engine/properties/manipulation.js
type: application/javascript
module-type: cytoscape-property

Graph manipulation: add/edit/delete nodes and edges via action strings.

\*/

"use strict";

exports.name = "manipulation";

exports.properties = {
	graph: {
		hideControls: { type: "boolean", default: false },
		addNode: { type: "actions", variables: ["x", "y"] },
		addEdge: { type: "actions", variables: ["fromTiddler", "toTiddler"] }
	},
	nodes: {
		"delete": { type: "actions", variables: [] },
		edit: { type: "actions", variables: [] }
	},
	edges: {
		"delete": { type: "actions" }
	}
};

exports.init = function(cy) {
	this._manipCy = cy;
	this._manipCounts = {
		deleteNode: 0,
		deleteEdge: 0,
		editNode: 0
	};
};

exports.process = function(objects, changes) {
	if (!this._manipCounts) {
		this._manipCounts = { deleteNode: 0, deleteEdge: 0, editNode: 0 };
	}
	// Track manipulation action counts on objects
	if (changes.nodes) {
		for (var id in changes.nodes) {
			var oldObj = (objects.nodes && objects.nodes[id]) || {};
			var newObj = changes.nodes[id] || {};
			this._manipCounts.deleteNode += (newObj["delete"] || 0) - (oldObj["delete"] || 0);
			this._manipCounts.editNode += (newObj.edit || 0) - (oldObj.edit || 0);
		}
	}
	if (changes.edges) {
		for (var id in changes.edges) {
			var oldObj = (objects.edges && objects.edges[id]) || {};
			var newObj = changes.edges[id] || {};
			this._manipCounts.deleteEdge += (newObj["delete"] || 0) - (oldObj["delete"] || 0);
		}
	}
	// Clean up action strings so they don't reach the engine
	if (changes.graph) {
		changes.graph.addNode = undefined;
		changes.graph.addEdge = undefined;
		changes.graph.hideControls = undefined;
	}
};

function round(number) {
	return Math.round(number * 10) / 10;
}
