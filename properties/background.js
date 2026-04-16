/*\
title: $:/plugins/rimir/cytoscape-engine/properties/background.js
type: application/javascript
module-type: cytoscape-property

Canvas background image support.

\*/

"use strict";

exports.name = "background";

exports.properties = {
	graph: {
		background: { type: "image" }
	}
};

exports.init = function(cy) {
	this._cy = cy;
};

exports.process = function(objects, changes) {
	if (!changes.graph || !changes.graph.background || !this._cy) { return; }
	var cy = this._cy;
	var bgUrl = changes.graph.background;
	// Apply background image to the container
	var container = cy.container();
	if (container && bgUrl) {
		container.style.backgroundImage = "url('" + bgUrl + "')";
		container.style.backgroundPosition = "center";
		container.style.backgroundRepeat = "no-repeat";
		container.style.backgroundSize = "contain";
	} else if (container) {
		container.style.backgroundImage = "";
	}
	// Remove from graph options so Cytoscape doesn't see it
	changes.graph.background = undefined;
};
