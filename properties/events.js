/*\
title: $:/plugins/rimir/cytoscape-engine/properties/events.js
type: application/javascript
module-type: cytoscape-property

Maps Cytoscape.js events to tw-graph event callbacks.

Includes blur debouncing: vis-network doesn't fire blurNode when the mouse
moves from a node to the popup overlay (it uses canvas-internal hit testing).
Cytoscape fires mouseout immediately when the pointer leaves the node area
for any reason, including moving to the popup. We debounce blur and cancel it
when the mouse enters a .graph-popup element inside the container.

\*/

"use strict";

exports.name = "events";

exports.properties = {
	graph: {
		doubleclick: { type: "actions", variables: ["x", "y"] }
	},
	nodes: {
		actions: { type: "actions" },
		hover: { type: "actions" },
		blur: { type: "actions" },
		drag: { type: "actions" },
		free: { type: "actions", variables: ["x", "y"] }
	},
	edges: {
		actions: { type: "actions" },
		hover: { type: "actions" },
		blur: { type: "actions" }
	}
};

var BLUR_DELAY_MS = 200;

exports.init = function(cy) {
	var self = this;
	var container = cy.container();
	var pendingNodeBlur = null;
	var pendingEdgeBlur = null;
	var mouseInPopup = false;

	function clearNodeBlur() {
		if (pendingNodeBlur) {
			clearTimeout(pendingNodeBlur.timer);
			pendingNodeBlur = null;
		}
	}

	function clearEdgeBlur() {
		if (pendingEdgeBlur) {
			clearTimeout(pendingEdgeBlur.timer);
			pendingEdgeBlur = null;
		}
	}

	// Watch for mouse entering/leaving popup elements inside the graph container.
	// Use event delegation on the container's parent to catch dynamically created popups.
	var popupParent = container.parentNode || container;

	popupParent.addEventListener("mouseenter", function(domEvt) {
		if (domEvt.target.closest && domEvt.target.closest(".graph-popup")) {
			mouseInPopup = true;
			clearNodeBlur();
			clearEdgeBlur();
		}
	}, true); // capture phase to catch before Cytoscape

	popupParent.addEventListener("mouseleave", function(domEvt) {
		if (domEvt.target.closest && domEvt.target.closest(".graph-popup")) {
			mouseInPopup = false;
			// Fire the deferred blur now that the mouse left the popup
			// (the popup's own close logic handles cleanup via tw-graph state)
		}
	}, true);

	// Graph double-click (on empty canvas)
	cy.on("dbltap", function(evt) {
		if (evt.target === cy) {
			var pos = evt.position;
			self.onevent(
				{ type: "doubleclick", objectType: "graph", event: evt.originalEvent },
				{ x: pos.x, y: pos.y }
			);
		}
	});

	// Node events — skip virtual cluster nodes for tw-graph callbacks
	function isClusterNode(node) {
		return node.id().indexOf(CLUSTER_PREFIX) === 0;
	}

	cy.on("tap", "node", function(evt) {
		var node = evt.target;
		if (isClusterNode(node)) { return; }
		self.onevent(
			{ type: "actions", objectType: "nodes", id: node.id(), event: evt.originalEvent },
			{}
		);
	});

	cy.on("mouseover", "node", function(evt) {
		var node = evt.target;
		if (isClusterNode(node)) { return; }
		clearNodeBlur(); // cancel any pending blur
		self.onevent(
			{ type: "hover", objectType: "nodes", id: node.id(), event: evt.originalEvent },
			{}
		);
	});

	cy.on("mouseout", "node", function(evt) {
		var node = evt.target;
		if (isClusterNode(node)) { return; }
		var id = node.id();
		var originalEvent = evt.originalEvent;
		clearNodeBlur();
		pendingNodeBlur = {
			timer: setTimeout(function() {
				pendingNodeBlur = null;
				if (!mouseInPopup) {
					self.onevent(
						{ type: "blur", objectType: "nodes", id: id, event: originalEvent },
						{}
					);
				}
			}, BLUR_DELAY_MS)
		};
	});

	var EJECT_DISTANCE = 100; // pixels BEYOND cluster boundary to eject

	// Compute how far outside the cluster boundary a point is (0 if inside)
	function distOutsideBB(bb, x, y) {
		var dx = 0, dy = 0;
		if (x < bb.x1) { dx = bb.x1 - x; }
		else if (x > bb.x2) { dx = x - bb.x2; }
		if (y < bb.y1) { dy = bb.y1 - y; }
		else if (y > bb.y2) { dy = y - bb.y2; }
		return Math.sqrt(dx * dx + dy * dy);
	}

	cy.on("grab", "node", function(evt) {
		var node = evt.target;
		clearNodeBlur();
		// Mark as directly grabbed — children freed from compound drag won't have this
		node.scratch("_userGrabbed", true);
		var parent = node.parent();
		if (parent.length) {
			node.scratch("_parentBB", parent.boundingBox());
			node.scratch("_parentId", parent.id());
		}
		if (isClusterNode(node)) { return; }
		self.onevent(
			{ type: "drag", objectType: "nodes", id: node.id(), event: evt.originalEvent },
			{}
		);
	});

	// Visual feedback: border changes only when node goes beyond cluster boundary
	cy.on("drag", "node", function(evt) {
		var node = evt.target;
		var parentBB = node.scratch("_parentBB");
		var parentId = node.scratch("_parentId");
		if (!parentBB || !parentId) { return; }
		var pos = node.position();
		var dist = distOutsideBB(parentBB, pos.x, pos.y);
		var parentEle = cy.getElementById(parentId);
		if (!parentEle.length) { return; }
		var ratio = Math.min(dist / EJECT_DISTANCE, 1);
		if (dist > 0) {
			var r = Math.round(255 * ratio);
			var g = Math.round(100 * (1 - ratio));
			parentEle.style({
				"border-style": ratio > 0.85 ? "solid" : "dashed",
				"border-color": "rgb(" + r + "," + g + ",0)",
				"border-width": 2 + Math.round(ratio * 2)
			});
		} else {
			// Inside cluster — reset to normal
			var clusterHandler = getClusterHandler(self);
			if (clusterHandler) {
				clusterHandler.postApply.call(self, cy);
			}
		}
	});

	var adapter = require("$:/plugins/rimir/cytoscape-engine/adapter.js");

	cy.on("free", "node", function(evt) {
		var node = evt.target;
		// Skip nodes freed as side-effect of compound parent drag.
		// Only the directly grabbed node gets _userGrabbed from the grab handler.
		var wasGrabbed = node.scratch("_userGrabbed");
		node.removeScratch("_userGrabbed");
		if (!wasGrabbed) { return; }

		var pos = node.position();
		var dropTarget = findDropTarget(cy, node);
		var clusterHandler = getClusterHandler(self);
		if (clusterHandler) {
			var currentParent = node.parent();
			var currentParentId = currentParent.length ? currentParent.id() : null;
			if (dropTarget) {
				if (dropTarget.id() !== currentParentId) {
					clusterHandler.assignCluster.call(self, node.id(), dropTarget.id());
				}
			} else if (currentParentId) {
				var parentBB = node.scratch("_parentBB");
				if (parentBB) {
					var dist = distOutsideBB(parentBB, pos.x, pos.y);
					if (dist > EJECT_DISTANCE) {
						clusterHandler.assignCluster.call(self, node.id(), null);
					}
				}
			}
			var parentId = node.scratch("_parentId");
			if (parentId) {
				clusterHandler.postApply.call(self, cy);
			}
			node.removeScratch("_parentBB");
			node.removeScratch("_parentId");
		}
		if (isClusterNode(node)) {
			// Cluster was moved — emit free events for all real (non-cluster)
			// descendants so tw-graph persists their new positions
			node.descendants().forEach(function(child) {
				if (!isClusterNode(child)) {
					var cPos = child.position();
					self.onevent(
						{ type: "free", objectType: "nodes", id: child.id(), event: evt.originalEvent },
						{ x: cPos.x, y: cPos.y }
					);
				}
			});
			return;
		}
		self.onevent(
			{ type: "free", objectType: "nodes", id: node.id(), event: evt.originalEvent },
			{ x: pos.x, y: pos.y }
		);
	});

	// Edge events
	cy.on("tap", "edge", function(evt) {
		var edge = evt.target;
		self.onevent(
			{ type: "actions", objectType: "edges", id: edge.id(), event: evt.originalEvent },
			{}
		);
	});

	cy.on("mouseover", "edge", function(evt) {
		var edge = evt.target;
		clearEdgeBlur();
		self.onevent(
			{ type: "hover", objectType: "edges", id: edge.id(), event: evt.originalEvent },
			{}
		);
	});

	cy.on("mouseout", "edge", function(evt) {
		var edge = evt.target;
		var id = edge.id();
		var originalEvent = evt.originalEvent;
		clearEdgeBlur();
		pendingEdgeBlur = {
			timer: setTimeout(function() {
				pendingEdgeBlur = null;
				if (!mouseInPopup) {
					self.onevent(
						{ type: "blur", objectType: "edges", id: id, event: originalEvent },
						{}
					);
				}
			}, BLUR_DELAY_MS)
		};
	});

	// Store cleanup reference
	self._eventCleanup = {
		clearNodeBlur: clearNodeBlur,
		clearEdgeBlur: clearEdgeBlur
	};
};

exports.destroy = function() {
	if (this._eventCleanup) {
		this._eventCleanup.clearNodeBlur();
		this._eventCleanup.clearEdgeBlur();
	}
};

/**
 * Find the node under the dropped node (excluding itself and its descendants).
 * Uses bounding box overlap with center-point containment check.
 */
var CLUSTER_PREFIX = "__cluster__";

function findDropTarget(cy, droppedNode) {
	var pos = droppedNode.position();
	var droppedId = droppedNode.id();
	// Exclude self, descendants, current parent, and all ancestor clusters
	var descendants = droppedNode.descendants();
	var descendantIds = Object.create(null);
	descendants.forEach(function(d) { descendantIds[d.id()] = true; });
	var ancestorIds = Object.create(null);
	var walk = droppedNode.parent();
	while (walk.length) {
		ancestorIds[walk.id()] = true;
		walk = walk.parent();
	}

	var clusterHits = [];
	var nodeHits = [];

	cy.nodes().forEach(function(n) {
		if (n.id() === droppedId) { return; }
		if (ancestorIds[n.id()]) { return; }
		if (descendantIds[n.id()]) { return; }
		var bb = n.boundingBox();
		if (pos.x >= bb.x1 && pos.x <= bb.x2 && pos.y >= bb.y1 && pos.y <= bb.y2) {
			if (n.id().indexOf(CLUSTER_PREFIX) === 0) {
				clusterHits.push(n);
			} else {
				nodeHits.push(n);
			}
		}
	});

	// Prefer cluster containers: pick the smallest (most nested) cluster hit
	if (clusterHits.length > 0) {
		var best = null;
		var bestArea = Infinity;
		clusterHits.forEach(function(n) {
			var bb = n.boundingBox();
			var area = (bb.x2 - bb.x1) * (bb.y2 - bb.y1);
			if (area < bestArea) { bestArea = area; best = n; }
		});
		return best;
	}

	// Fall back to regular nodes (for auto-creating clusters from two nodes)
	if (nodeHits.length > 0) {
		var best = null;
		var bestArea = Infinity;
		nodeHits.forEach(function(n) {
			var bb = n.boundingBox();
			var area = (bb.x2 - bb.x1) * (bb.y2 - bb.y1);
			if (area < bestArea) { bestArea = area; best = n; }
		});
		return best;
	}

	return null;
}

/**
 * Get the cluster property handler from the engine's property handlers.
 */
function getClusterHandler(engine) {
	var handlers = $tw.modules.getModulesByTypeAsHashmap("cytoscape-property");
	for (var name in handlers) {
		if (handlers[name].assignCluster) {
			return handlers[name];
		}
	}
	return null;
}
