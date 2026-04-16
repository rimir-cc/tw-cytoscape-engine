/*\
title: $:/plugins/rimir/cytoscape-engine/properties/defaults.js
type: application/javascript
module-type: cytoscape-property

Applies default values on first initialization.

\*/

"use strict";

exports.name = "defaults";

exports.process = function(objects, changes) {
	// Only apply defaults on first init (when objects is empty)
	if (objects.graph) { return; }
	changes.graph = changes.graph || {};
	// Default interaction: hover enabled
	if (changes.graph.hover === undefined) {
		changes.graph.hover = true;
	}
};
