/*\
title: $:/plugins/rimir/cytoscape-engine/properties/color.js
type: application/javascript
module-type: cytoscape-property

Color mapping with automatic font contrast calculation.

\*/

"use strict";

exports.name = "color";

exports.properties = {
	graph: {
		nodeColor: { type: "color", hidden: ["nodes"] },
		edgeColor: { type: "color", hidden: ["edges"] },
		fontColor: { type: "color", hidden: ["nodes", "edges"] }
	},
	nodes: {
		color: { type: "color" },
		fontColor: { type: "color" },
		borderColor: { type: "color" }
	},
	edges: {
		color: { type: "color" }
	}
};

/**
 * Calculate relative luminance of a hex color for contrast detection.
 */
function luminance(hex) {
	hex = hex.replace("#", "");
	if (hex.length === 3) {
		hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
	}
	var r = parseInt(hex.substr(0, 2), 16) / 255;
	var g = parseInt(hex.substr(2, 2), 16) / 255;
	var b = parseInt(hex.substr(4, 2), 16) / 255;
	r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
	g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
	b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastColor(bgHex) {
	try {
		return luminance(bgHex) > 0.4 ? "#343434" : "#FFFFFF";
	} catch (e) {
		return "#343434";
	}
}

exports.process = function(objects, changes) {
	// NOTE: node labels are rendered BELOW the node (text-valign: bottom,
	// see the base stylesheet in adapter.js), i.e. on the graph canvas —
	// not on top of the node fill. So the label must contrast with the
	// graph BACKGROUND, not with the node's background colour. Auto-
	// deriving the font colour from the node background (as this used to)
	// produced white labels for dark-filled nodes sitting on a light
	// canvas — unreadable, and inconsistent with light-filled nodes
	// (e.g. person) that happened to get a dark label. The correct,
	// uniform colour is the graph-level font colour (nodeStyle.color —
	// graphOpts.fontColor from the palette, else the dark default), which
	// the theme already contrasts against the canvas. So we leave each
	// node's fontColor untouched here; an explicit per-node `fontColor`
	// still wins. contrastColor() is retained for on-node label use.
};
