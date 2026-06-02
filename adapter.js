/*\
title: $:/plugins/rimir/cytoscape-engine/adapter.js
type: application/javascript
module-type: graphengine

Cytoscape.js engine adapter for tw-graph.
Implements the graphengine interface so <$graph> can render via Cytoscape.

\*/

"use strict";

var cytoscape = require("$:/plugins/rimir/cytoscape-engine/lib/cytoscape.umd.js");

exports.name = "Cytoscape";

// Aggregate property handlers
var propertyHandlers = $tw.modules.getModulesByTypeAsHashmap("cytoscape-property");
exports.properties = {};

for (var handler in propertyHandlers) {
	var module = propertyHandlers[handler];
	if (module.properties) {
		for (var category in module.properties) {
			exports.properties[category] = exports.properties[category] || Object.create(null);
			$tw.utils.extend(exports.properties[category], module.properties[category]);
		}
	}
}

exports.forEachProperty = function(methodName) {
	var args = Array.prototype.slice.call(arguments, 1);
	for (var name in propertyHandlers) {
		var method = propertyHandlers[name][methodName];
		method && method.apply(this, args);
	}
};

// Message handlers (extensible)
var Messages = $tw.modules.getModulesByTypeAsHashmap("cytoscape-message");

exports.messages = Object.create(null);
for (var name in Messages) {
	exports.messages[name] = Messages[name].parameters || {};
}

exports.handleMessage = function(message, params) {
	var handler = Messages[message.type];
	if (handler) {
		return handler.handle.call(this, message, params);
	}
};

/**
 * Build Cytoscape elements array from tw-graph objects.
 */
function buildElements(objects) {
	var elements = [];
	var nodes = objects.nodes || {};
	var edges = objects.edges || {};
	for (var id in nodes) {
		var node = nodes[id];
		if (node === null) { continue; }
		elements.push(buildNodeElement(id, node));
	}
	for (var id in edges) {
		var edge = edges[id];
		if (edge === null) { continue; }
		elements.push(buildEdgeElement(id, edge));
	}
	return elements;
}

function buildNodeElement(id, node) {
	var data = { id: id };
	var position = null;
	var locked = false;
	// Map tw-graph node properties to Cytoscape data
	if (node.label !== undefined) { data.label = node.label; }
	if (node.cluster !== undefined && node.cluster !== null) { data.parent = node.cluster; }
	if (node.color !== undefined) { data._color = node.color; }
	if (node.fontColor !== undefined) { data._fontColor = node.fontColor; }
	if (node.borderColor !== undefined) { data._borderColor = node.borderColor; }
	if (node.borderWidth !== undefined) { data._borderWidth = node.borderWidth; }
	if (node.size !== undefined) { data._size = node.size; }
	if (node.shape !== undefined) { data._shape = node.shape; }
	if (node.image !== undefined) { data._image = node.image; }
	if (node.hidden !== undefined) { data._hidden = node.hidden; }
	if (node.x !== undefined && node.y !== undefined) {
		position = { x: node.x, y: node.y };
	}
	if (node.fixed) { locked = true; }
	var elem = { group: "nodes", data: data };
	if (position) { elem.position = position; }
	if (locked) { elem.locked = true; }
	return elem;
}

function buildEdgeElement(id, edge) {
	var data = { id: id };
	if (edge.from !== undefined) { data.source = edge.from; }
	if (edge.to !== undefined) { data.target = edge.to; }
	if (edge.label !== undefined) { data.label = edge.label; }
	if (edge.color !== undefined) { data._color = edge.color; }
	if (edge.width !== undefined) { data._width = edge.width; }
	if (edge.arrows !== undefined) { data._arrows = edge.arrows; }
	if (edge.stroke !== undefined) { data._stroke = edge.stroke; }
	if (edge.smooth !== undefined) { data._smooth = edge.smooth; }
	if (edge.hidden !== undefined) { data._hidden = edge.hidden; }
	return { group: "edges", data: data };
}

/**
 * Build the Cytoscape stylesheet from graph-level defaults.
 */
function buildStylesheet(graphOpts) {
	var nodeStyle = {
		"text-valign": "bottom",
		"text-halign": "center",
		"text-margin-y": 4,
		"shape": "ellipse",
		"width": 50,
		"height": 50,
		"border-width": 1,
		"border-color": "#2B7CE9",
		"background-color": "#D2E5FF",
		"color": "#343434",
		"font-family": "arial, sans-serif",
		"font-size": "14px",
		"text-wrap": "wrap",
		"text-max-width": "120px"
	};
	var edgeStyle = {
		"width": 1,
		"line-color": "#848484",
		"target-arrow-color": "#848484",
		"target-arrow-shape": "triangle",
		"curve-style": "bezier",
		"font-family": "arial, sans-serif",
		"font-size": "12px"
	};
	var edgeLabelStyle = {
		"label": "data(label)",
		"text-rotation": "autorotate"
	};
	var parentStyle = {
		"text-valign": "top",
		"text-halign": "center",
		"background-opacity": 0.15,
		"border-width": 2,
		"border-color": "#888",
		"padding": "20px",
		"shape": "round-rectangle"
	};
	// Apply graph-level color defaults
	if (graphOpts) {
		if (graphOpts.nodeColor) {
			nodeStyle["background-color"] = graphOpts.nodeColor;
		}
		if (graphOpts.fontColor) {
			nodeStyle["color"] = graphOpts.fontColor;
			edgeStyle["color"] = graphOpts.fontColor;
		}
		if (graphOpts.edgeColor) {
			edgeStyle["line-color"] = graphOpts.edgeColor;
			edgeStyle["target-arrow-color"] = graphOpts.edgeColor;
		}
	}
	return [
		{ selector: "node", style: nodeStyle },
		{ selector: "node[label]", style: { "label": "data(label)" } },
		{ selector: "node:parent", style: parentStyle },
		{ selector: "edge", style: edgeStyle },
		{ selector: "edge[label]", style: edgeLabelStyle },
		{ selector: "node:selected", style: { "border-width": 3, "border-color": "#2B7CE9" } },
		{ selector: "edge:selected", style: { "width": 3, "line-color": "#2B7CE9" } }
	];
}

/**
 * Apply per-element styles from data properties.
 */
function applyNodeStyle(ele) {
	var data = ele.data();
	var style = {};
	if (data._color) { style["background-color"] = data._color; }
	if (data._fontColor) { style["color"] = data._fontColor; }
	if (data._borderColor) { style["border-color"] = data._borderColor; }
	if (data._borderWidth !== undefined) { style["border-width"] = data._borderWidth; }
	if (data._size !== undefined) {
		style["width"] = data._size * 2;
		style["height"] = data._size * 2;
	}
	if (data._shape) { style["shape"] = mapShape(data._shape); }
	if (data._image) {
		style["background-image"] = data._image;
		style["background-fit"] = "cover";
		style["background-clip"] = data._circular ? "node" : "none";
		style["border-width"] = data._circular ? 2 : 0;
		if (!data._shape || data._shape === "image" || data._shape === "circularImage") {
			style["shape"] = data._circular ? "ellipse" : "rectangle";
		}
	}
	if (data._hidden) { style["display"] = "none"; }
	if (Object.keys(style).length > 0) {
		ele.style(style);
	}
}

function applyEdgeStyle(ele) {
	var data = ele.data();
	var style = {};
	if (data._color) {
		style["line-color"] = data._color;
		style["target-arrow-color"] = data._color;
		style["source-arrow-color"] = data._color;
	}
	if (data._width !== undefined) { style["width"] = data._width; }
	if (data._arrows) {
		var arrows = data._arrows;
		style["target-arrow-shape"] = "none";
		style["source-arrow-shape"] = "none";
		if (typeof arrows === "string") {
			if (arrows.indexOf("to") !== -1) { style["target-arrow-shape"] = "triangle"; }
			if (arrows.indexOf("from") !== -1) { style["source-arrow-shape"] = "triangle"; }
			if (arrows.indexOf("middle") !== -1) { style["mid-target-arrow-shape"] = "triangle"; }
		}
	}
	if (data._stroke) {
		if (data._stroke === "dashed") { style["line-style"] = "dashed"; }
		else if (data._stroke === "dotted") { style["line-style"] = "dotted"; }
		else { style["line-style"] = "solid"; }
	}
	if (data._smooth) {
		var smoothMap = {
			"no": "haystack",
			"dynamic": "bezier",
			"continuous": "bezier",
			"curvedCW": "unbundled-bezier",
			"curvedCCW": "unbundled-bezier",
			"cubicBezier": "unbundled-bezier"
		};
		style["curve-style"] = smoothMap[data._smooth] || "bezier";
	}
	if (data._hidden) { style["display"] = "none"; }
	if (Object.keys(style).length > 0) {
		ele.style(style);
	}
}

var shapeMap = {
	"dot": "ellipse",
	"circle": "ellipse",
	"ellipse": "ellipse",
	"box": "rectangle",
	"square": "rectangle",
	"diamond": "diamond",
	"triangle": "triangle",
	"triangleDown": "triangle",
	"star": "star",
	"hexagon": "hexagon",
	"database": "barrel"
};

function mapShape(shape) {
	return shapeMap[shape] || "ellipse";
}

// Module-level flag to suppress free events during programmatic updates.
// Must be module-level because adapter instances can be recreated by tw-graph.
var suppressFreeEvents = false;
exports.isSuppressingFreeEvents = function() { return suppressFreeEvents; };

// ---- Core engine methods ----

exports.init = function(element, objects, options) {
	this.element = element;
	options = options || {};
	this.wiki = options.wiki || $tw.wiki;
	this.objects = {};
	this._firstInit = true;

	var newObjects = this.processObjects(objects);

	// Preserve existing child DOM nodes (TW widget stack requirement)
	var children = Array.prototype.slice.call(element.childNodes);

	var elements = buildElements(newObjects);
	var stylesheet = buildStylesheet(newObjects.graph);

	this.cy = cytoscape({
		container: element,
		elements: elements,
		style: stylesheet,
		layout: { name: "preset" },
		wheelSensitivity: 1,
		boxSelectionEnabled: true,
		selectionType: "additive"
	});

	// Re-append preserved children
	for (var i = 0; i < children.length; i++) {
		element.appendChild(children[i]);
	}

	// Apply per-element styles
	this.cy.nodes().forEach(applyNodeStyle);
	this.cy.edges().forEach(applyEdgeStyle);

	// Apply cluster container styling
	this.forEachProperty("postApply", this.cy);

	this.forEachProperty("init", this.cy);

	// Fit viewport to show all nodes. Two subtleties make a single
	// fit() unreliable:
	//   1. The container frequently gets its real (flex / vh) height
	//      AFTER cytoscape has measured it at construction, and cytoscape
	//      has no built-in container ResizeObserver. Without an explicit
	//      resize()+fit() the viewport stays sized to the stale (often
	//      zero-height) container and every node lands off-screen.
	//   2. Side-preview / story-river panes can be laid out or revealed
	//      after init, changing the container size again.
	// So: fit once on the next frame, and keep a ResizeObserver that
	// re-measures and re-frames whenever the container resizes. autoFit
	// stays on (the view is meant to always show everything); node drags
	// don't trigger it (update() only refits on a node-COUNT change).
	this._autoFit = true;
	this._fitPadding = 30;
	var self = this;
	setTimeout(function() { self.fitView(); }, 100);
	this._installResizeObserver(element);

	this._firstInit = false;
};

// Re-measure the container and frame all nodes. Safe to call any time.
exports.fitView = function() {
	if (!this.cy || this.cy.nodes().length === 0) { return; }
	this.cy.resize();
	this.cy.fit(null, this._fitPadding === undefined ? 30 : this._fitPadding);
};

// Keep the canvas matched to its container and re-frame on resize. This is
// what actually fixes the "nodes off-view" case: the container's real
// height usually arrives after cytoscape's construction-time measurement.
exports._installResizeObserver = function(element) {
	if (this._resizeObserver || typeof ResizeObserver === "undefined") { return; }
	var self = this;
	this._resizeObserver = new ResizeObserver(function() {
		if (!self.cy) { return; }
		self.cy.resize();
		if (self._autoFit) {
			self.cy.fit(null, self._fitPadding === undefined ? 30 : self._fitPadding);
		}
	});
	this._resizeObserver.observe(element);
};

exports.update = function(objects) {
	var changes = this.processObjects(objects);

	// Remember the node count so we can re-frame when the visible set
	// changes (Context-preview pills, type show/hide) but NOT when a node
	// is merely dragged/repositioned (same count → layout is preserved).
	var nodeCountBefore = this.cy ? this.cy.nodes().length : 0;

	// Suppress free event handling during programmatic updates.
	// move() calls trigger Cytoscape free events which would incorrectly
	// reassign nodes via the cluster handler.
	suppressFreeEvents = true;

	// Graph-level changes: rebuild stylesheet
	if (changes.graph) {
		var stylesheet = buildStylesheet(changes.graph);
		this.cy.style().fromJson(stylesheet).update();
		// Re-apply per-element styles after stylesheet reset
		this.cy.nodes().forEach(applyNodeStyle);
		this.cy.edges().forEach(applyEdgeStyle);
	}

	// Node changes — two passes:
	// Pass 1: add/update/delete all nodes, reparent regular nodes only
	// Pass 2: reparent cluster (compound) nodes
	// This order prevents move() on a compound from orphaning children
	// that haven't been reparented yet.
	if (changes.nodes) {
		var deferredMoves = []; // cluster parent changes deferred to pass 2

		// Pass 1
		for (var id in changes.nodes) {
			var nodeData = changes.nodes[id];
			if (nodeData === null) {
				var ele = this.cy.getElementById(id);
				if (ele.length) { this.cy.remove(ele); }
			} else {
				var existing = this.cy.getElementById(id);
				if (existing.length && existing.isNode()) {
					var elemDef = buildNodeElement(id, nodeData);
					var currentParentId = existing.parent().length ? existing.parent().id() : null;
					var newParentId = elemDef.data.parent || null;
					if (currentParentId !== newParentId) {
						if (id.indexOf("__cluster__") === 0) {
							// Defer compound node reparenting to pass 2
							deferredMoves.push({ id: id, newParentId: newParentId });
						} else {
							var pos = { x: existing.position("x"), y: existing.position("y") };
							existing.move({ parent: newParentId });
							existing.position(pos);
						}
					}
					existing.data(elemDef.data);
					if (elemDef.position) {
						existing.position(elemDef.position);
					}
					if (nodeData.fixed !== undefined) {
						if (nodeData.fixed) { existing.lock(); }
						else { existing.unlock(); }
					}
					applyNodeStyle(existing);
				} else {
					var newElem = buildNodeElement(id, nodeData);
					var added = this.cy.add(newElem);
					applyNodeStyle(added);
				}
			}
		}

		// Pass 2: reparent compound (cluster) nodes after all children are settled
		for (var i = 0; i < deferredMoves.length; i++) {
			var dm = deferredMoves[i];
			var ele = this.cy.getElementById(dm.id);
			if (ele.length) {
				// Save children positions — move() on compound orphans them
				var children = ele.children();
				var childPositions = [];
				children.forEach(function(c) {
					childPositions.push({ id: c.id(), x: c.position("x"), y: c.position("y") });
				});
				var pos = { x: ele.position("x"), y: ele.position("y") };
				ele.move({ parent: dm.newParentId });
				ele.position(pos);
				// Re-parent orphaned children
				for (var j = 0; j < childPositions.length; j++) {
					var cp = childPositions[j];
					var child = this.cy.getElementById(cp.id);
					if (child.length) {
						child.move({ parent: dm.id });
						child.position({ x: cp.x, y: cp.y });
					}
				}
			}
		}
	}

	// Edge changes
	if (changes.edges) {
		for (var id in changes.edges) {
			var edgeData = changes.edges[id];
			if (edgeData === null) {
				var ele = this.cy.getElementById(id);
				if (ele.length) { this.cy.remove(ele); }
			} else {
				var existing = this.cy.getElementById(id);
				if (existing.length && existing.isEdge()) {
					var elemDef = buildEdgeElement(id, edgeData);
					existing.data(elemDef.data);
					applyEdgeStyle(existing);
				} else {
					var newElem = buildEdgeElement(id, edgeData);
					var added = this.cy.add(newElem);
					applyEdgeStyle(added);
				}
			}
		}
	}

	// Apply cluster container styling after all node/edge changes
	this.forEachProperty("postApply", this.cy);

	suppressFreeEvents = false;

	// Re-frame when the visible node set changed (added/removed), so the
	// view always shows everything no matter how far apart the persisted
	// positions are.
	if (this._autoFit && this.cy && this.cy.nodes().length !== nodeCountBefore) {
		this.fitView();
	}
};

exports.destroy = function() {
	if (this._resizeObserver) {
		this._resizeObserver.disconnect();
		this._resizeObserver = null;
	}
	this.forEachProperty("destroy", this.cy);
	if (this.cy) {
		this.cy.destroy();
		this.cy = null;
	}
};

exports.processObjects = function(changes) {
	this.forEachProperty("process", this.objects, changes);
	for (var type in changes) {
		if (type === "graph") {
			this.objects.graph = changes.graph;
		} else {
			this.objects[type] = this.objects[type] || Object.create(null);
			for (var id in changes[type]) {
				this.objects[type][id] = changes[type][id];
			}
		}
	}
	return changes;
};
