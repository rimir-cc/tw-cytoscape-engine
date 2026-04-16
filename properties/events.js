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

	// Node events
	cy.on("tap", "node", function(evt) {
		var node = evt.target;
		self.onevent(
			{ type: "actions", objectType: "nodes", id: node.id(), event: evt.originalEvent },
			{}
		);
	});

	cy.on("mouseover", "node", function(evt) {
		var node = evt.target;
		clearNodeBlur(); // cancel any pending blur
		self.onevent(
			{ type: "hover", objectType: "nodes", id: node.id(), event: evt.originalEvent },
			{}
		);
	});

	cy.on("mouseout", "node", function(evt) {
		var node = evt.target;
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

	cy.on("grab", "node", function(evt) {
		var node = evt.target;
		clearNodeBlur(); // dragging cancels blur
		self.onevent(
			{ type: "drag", objectType: "nodes", id: node.id(), event: evt.originalEvent },
			{}
		);
	});

	cy.on("free", "node", function(evt) {
		var node = evt.target;
		var pos = node.position();
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
