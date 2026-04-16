/*\
title: $:/plugins/rimir/cytoscape-engine/properties/id.js
type: application/javascript
module-type: cytoscape-property

Assigns id to all nodes and edges.

\*/

"use strict";

exports.name = "id";

exports.process = function(objects, changes) {
	for (var type in changes) {
		if (type === "graph") { continue; }
		for (var id in changes[type]) {
			var obj = changes[type][id];
			if (obj) {
				obj.id = id;
			}
		}
	}
};
