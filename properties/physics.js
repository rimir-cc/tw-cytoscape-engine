/*\
title: $:/plugins/rimir/cytoscape-engine/properties/physics.js
type: application/javascript
module-type: cytoscape-property

Physics simulation via Cytoscape's cose (Compound Spring Embedder) layout.

\*/

"use strict";

exports.name = "physics";

exports.properties = {
	graph: {
		physics: { type: "boolean", default: true },
		centralGravity: { type: "number", min: 0, max: 1, default: 0.3 },
		damping: { type: "number", min: 0, max: 1, default: 0.09 },
		gravitationalConstant: { type: "number", min: -2000, max: 0, default: -2000 },
		springConstant: { type: "number", min: 0, max: 0.2, default: 0.04 },
		springLength: { type: "number", min: 0, max: 200, default: 95 },
		maxVelocity: { type: "number", min: 1, max: 100, default: 50 }
	}
};

exports.init = function(cy) {
	this._cy = cy;
};

exports.process = function(objects, changes) {
	if (!changes.graph || !this._cy) { return; }
	var graph = changes.graph;
	// Don't run physics if hierarchy is active or physics is off
	if (graph.physics === false || graph.hierarchy) { return; }
	// Check if any nodes lack positions (need layout)
	var needsLayout = false;
	if (changes.nodes) {
		for (var id in changes.nodes) {
			var node = changes.nodes[id];
			if (node && !node._hasPosition) {
				needsLayout = true;
				break;
			}
		}
	}
	// Run cose layout if needed (on first init when nodes have no positions)
	if (needsLayout && !objects.graph) {
		var cy = this._cy;
		// Map vis-network physics params to cose equivalents
		var gravity = (graph.centralGravity || 0.3) * 100;
		var nodeRepulsion = Math.abs(graph.gravitationalConstant || 2000) * 2;
		var idealLength = graph.springLength || 95;
		var elasticity = (graph.springConstant || 0.04) * 2500;
		// Defer layout to allow all nodes to be added first
		setTimeout(function() {
			cy.layout({
				name: "cose",
				animate: false,
				gravity: gravity,
				nodeRepulsion: function() { return nodeRepulsion; },
				idealEdgeLength: function() { return idealLength; },
				edgeElasticity: function() { return elasticity; },
				numIter: 200,
				randomize: true
			}).run();
		}, 0);
	}
};
