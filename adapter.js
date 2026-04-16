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
	if (edge.hidden !== undefined) { data._hidden = edge.hidden; }
	return { group: "edges", data: data };
}

/**
 * Build the Cytoscape stylesheet from graph-level defaults.
 */
function buildStylesheet(graphOpts) {
	var nodeStyle = {
		"label": "data(label)",
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
		"label": "data(label)",
		"width": 1,
		"line-color": "#848484",
		"target-arrow-color": "#848484",
		"target-arrow-shape": "triangle",
		"curve-style": "bezier",
		"font-family": "arial, sans-serif",
		"font-size": "12px",
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
		{ selector: "node:parent", style: parentStyle },
		{ selector: "edge", style: edgeStyle },
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
		wheelSensitivity: 0.3,
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

	this.forEachProperty("init", this.cy);
	this._firstInit = false;
};

exports.update = function(objects) {
	var changes = this.processObjects(objects);

	// Graph-level changes: rebuild stylesheet
	if (changes.graph) {
		var stylesheet = buildStylesheet(changes.graph);
		this.cy.style().fromJson(stylesheet).update();
		// Re-apply per-element styles after stylesheet reset
		this.cy.nodes().forEach(applyNodeStyle);
		this.cy.edges().forEach(applyEdgeStyle);
	}

	// Node changes
	if (changes.nodes) {
		for (var id in changes.nodes) {
			var nodeData = changes.nodes[id];
			if (nodeData === null) {
				// Delete
				var ele = this.cy.getElementById(id);
				if (ele.length) { this.cy.remove(ele); }
			} else {
				var existing = this.cy.getElementById(id);
				if (existing.length && existing.isNode()) {
					// Update existing node
					var elemDef = buildNodeElement(id, nodeData);
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
					// Add new node
					var newElem = buildNodeElement(id, nodeData);
					var added = this.cy.add(newElem);
					applyNodeStyle(added);
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
};

exports.destroy = function() {
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
