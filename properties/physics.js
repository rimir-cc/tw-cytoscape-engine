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
	// Run deferred layout if process() flagged it before cy existed
	if (this._pendingLayout) {
		var params = this._pendingLayout;
		this._pendingLayout = null;
		setTimeout(function() {
			cy.layout(params).run();
		}, 0);
	}
};

exports.process = function(objects, changes) {
	if (!changes.graph) { return; }
	var graph = changes.graph;
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

	if (needsLayout && !objects.graph) {
		var gravity = (graph.centralGravity || 0.3) * 100;
		var nodeRepulsion = Math.abs(graph.gravitationalConstant || 2000) * 2;
		var idealLength = graph.springLength || 95;
		var elasticity = (graph.springConstant || 0.04) * 2500;

		var layoutParams = {
			name: "cose",
			animate: false,
			gravity: gravity,
			nodeRepulsion: function() { return nodeRepulsion; },
			idealEdgeLength: function() { return idealLength; },
			edgeElasticity: function() { return elasticity; },
			numIter: 200,
			randomize: true
		};

		if (this._cy) {
			// cy exists (update call, not first init)
			var cy = this._cy;
			setTimeout(function() {
				cy.layout(layoutParams).run();
			}, 0);
		} else {
			// First init — defer to init() which will pick it up
			this._pendingLayout = layoutParams;
		}
	}
};
