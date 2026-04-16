/*\
title: $:/plugins/rimir/cytoscape-engine/properties/canvas.js
type: application/javascript
module-type: cytoscape-property

Canvas-level events: focus, blur, and tiddler drop onto graph.

\*/

"use strict";

exports.name = "canvas";

exports.properties = {
	graph: {
		focus: { type: "actions" },
		blur: { type: "actions" },
		drop: { type: "actions", variables: ["dropTiddler"] }
	}
};

exports.init = function(cy) {
	var self = this;
	var container = cy.container();
	if (!container) { return; }

	this._canvasHandleEvent = function(event) {
		switch (event.type) {
			case "drop":
				var dataTransfer = event.dataTransfer;
				$tw.utils.importDataTransfer(dataTransfer, null, function(fieldsArray) {
					fieldsArray.forEach(function(fields) {
						if (fields.title) {
							self.onevent({
								type: "drop",
								objectType: "graph",
								event: event
							}, { dropTiddler: fields.title || fields.text });
						}
					});
				});
				event.preventDefault();
				event.stopPropagation();
				break;
			case "dragover":
				event.preventDefault();
				break;
			default: // focus || blur
				self.onevent({
					type: event.type,
					objectType: "graph",
					event: event
				});
		}
	};

	container.addEventListener("focus", this._canvasHandleEvent);
	container.addEventListener("blur", this._canvasHandleEvent);
	container.addEventListener("drop", this._canvasHandleEvent);
	container.addEventListener("dragover", this._canvasHandleEvent);
};

exports.destroy = function(cy) {
	var container = cy && cy.container();
	if (container && this._canvasHandleEvent) {
		container.removeEventListener("focus", this._canvasHandleEvent);
		container.removeEventListener("blur", this._canvasHandleEvent);
		container.removeEventListener("drop", this._canvasHandleEvent);
		container.removeEventListener("dragover", this._canvasHandleEvent);
	}
};

exports.process = function(objects, changes) {
	if (changes.graph) {
		changes.graph.focus = undefined;
		changes.graph.blur = undefined;
		changes.graph.drop = undefined;
	}
};
