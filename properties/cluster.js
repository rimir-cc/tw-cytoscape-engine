/*\
title: $:/plugins/rimir/cytoscape-engine/properties/cluster.js
type: application/javascript
module-type: cytoscape-property

Named cluster groups for visual node grouping.

Clusters are named labels (e.g. "Subsidiary", "Core Business") — not tiddlers.
The adapter creates virtual Cytoscape compound nodes for each cluster.
Nodes are assigned via drag-drop; clusters are renamed via double-click.

Config tiddler format:
{
  "clusters": { "Cluster #1": { "label": "Cluster #1" }, ... },
  "assignments": { "nodeId": "Cluster #1", ... }
}

\*/

"use strict";

var CLUSTER_PREFIX = "__cluster__";

exports.name = "cluster";

exports.properties = {
	graph: {
		clusterData: { type: "string", hidden: true }
	}
};

exports.init = function(cy) {
	this._cy = cy;
	this._clusterConfig = { clusters: {}, assignments: {} };
	this._clusterCounter = 0;
	this._activeInput = null;

	var self = this;

	// Double-click cluster container → inline rename
	cy.on("dbltap", "node", function(evt) {
		var node = evt.target;
		var nodeId = node.id();
		if (nodeId.indexOf(CLUSTER_PREFIX) !== 0) { return; }
		var clusterName = nodeId.substring(CLUSTER_PREFIX.length);
		exports._startInlineEdit.call(self, node, clusterName);
	});
};

/**
 * Show an HTML input overlay on the cluster node for renaming.
 */
var PALETTE = [
	null,
	"#848484", "#2B7CE9", "#D2691E", "#228B22", "#DC143C",
	"#9932CC", "#FF8C00", "#008B8B", "#B8860B", "#4B0082",
	"#2F4F4F", "#8B0000", "#006400", "#191970", "#800080"
];

exports._startInlineEdit = function(node, clusterName) {
	var cy = this._cy;
	if (!cy) { return; }
	var self = this;

	exports._removeInlineEdit.call(this);

	var container = cy.container();
	var pos = node.renderedPosition();
	var clusterDef = this._clusterConfig.clusters[clusterName];
	if (!clusterDef) {
		clusterDef = { label: clusterName, color: null };
		this._clusterConfig.clusters[clusterName] = clusterDef;
	}
	var currentColor = clusterDef.color || null;

	// Wrapper panel
	var panel = document.createElement("div");
	panel.style.cssText = "position:absolute;z-index:1001;" +
		"left:" + pos.x + "px;top:" + pos.y + "px;" +
		"transform:translate(-50%,-50%);" +
		"background:#fff;border:2px solid #2B7CE9;border-radius:6px;" +
		"padding:8px;display:flex;flex-direction:column;gap:6px;align-items:center;";

	// Stop all pointer events from leaking through to Cytoscape canvas
	["mousedown", "mouseup", "click", "dblclick", "pointerdown", "pointerup"].forEach(function(evt) {
		panel.addEventListener(evt, function(e) { e.stopPropagation(); });
	});

	// Name input
	var input = document.createElement("input");
	input.type = "text";
	input.value = clusterDef.label || clusterName;
	input.style.cssText = "font-size:14px;font-family:arial,sans-serif;font-weight:bold;" +
		"text-align:center;padding:4px 8px;border:1px solid #ccc;" +
		"border-radius:4px;outline:none;min-width:100px;width:100%;box-sizing:border-box;";
	panel.appendChild(input);

	// Color swatches row
	var swatchRow = document.createElement("div");
	swatchRow.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;justify-content:center;";

	PALETTE.forEach(function(color) {
		var swatch = document.createElement("div");
		var isNone = color === null;
		var bg = isNone ? "#fff" : color;
		var border = (color === currentColor || (isNone && !currentColor))
			? "2px solid #2B7CE9" : "1px solid #aaa";
		swatch.style.cssText = "width:18px;height:18px;border-radius:3px;cursor:pointer;" +
			"background:" + bg + ";border:" + border + ";box-sizing:border-box;";
		if (isNone) {
			// Diagonal line for "no color"
			swatch.style.background = "linear-gradient(135deg, #fff 40%, #ccc 40%, #ccc 60%, #fff 60%)";
		}
		swatch.addEventListener("click", function(e) {
			e.stopPropagation();
			currentColor = color;
			clusterDef.color = color;
			// Update swatch borders
			var swatches = swatchRow.children;
			for (var i = 0; i < swatches.length; i++) {
				var c = PALETTE[i];
				swatches[i].style.border = (c === color) ? "2px solid #2B7CE9" : "1px solid #aaa";
			}
			// Apply and close
			exports.postApply.call(self, cy);
			exports._saveClusterConfig.call(self);
			exports._removeInlineEdit.call(self);
		});
		swatchRow.appendChild(swatch);
	});
	panel.appendChild(swatchRow);

	function commit() {
		var newLabel = input.value.trim();
		if (newLabel && newLabel !== clusterName) {
			exports.renameCluster.call(self, clusterName, newLabel);
		} else if (newLabel) {
			clusterDef.label = newLabel;
			node.data("label", newLabel);
			exports._saveClusterConfig.call(self);
		}
		exports._removeInlineEdit.call(self);
	}

	input.addEventListener("keydown", function(e) {
		if (e.key === "Enter") { commit(); }
		if (e.key === "Escape") { exports._removeInlineEdit.call(self); }
		e.stopPropagation();
	});

	// Close on click outside panel
	function onOutsideClick(e) {
		if (!panel.contains(e.target)) {
			commit();
			document.removeEventListener("mousedown", onOutsideClick, true);
		}
	}
	setTimeout(function() {
		document.addEventListener("mousedown", onOutsideClick, true);
	}, 0);

	container.style.position = "relative";
	container.appendChild(panel);
	input.focus();
	input.select();
	this._activeInput = panel;
	this._outsideClickHandler = onOutsideClick;
};

exports._removeInlineEdit = function() {
	if (this._outsideClickHandler) {
		document.removeEventListener("mousedown", this._outsideClickHandler, true);
		this._outsideClickHandler = null;
	}
	if (this._activeInput && this._activeInput.parentNode) {
		this._activeInput.parentNode.removeChild(this._activeInput);
	}
	this._activeInput = null;
};

/**
 * Read config, inject virtual cluster nodes, apply assignments.
 */
exports.process = function(objects, changes) {
	var graph = changes.graph || objects.graph;
	if (!graph || !graph.clusterData) { return; }

	var configTitle = graph.clusterData;
	var wiki = this.wiki || $tw.wiki;
	var tiddler = wiki.getTiddler(configTitle);
	var config = { clusters: {}, assignments: {} };

	if (tiddler) {
		try {
			config = JSON.parse(tiddler.fields.text || "{}");
			if (!config.clusters) { config.clusters = {}; }
			if (!config.assignments) { config.assignments = {}; }
		} catch (e) {
			config = { clusters: {}, assignments: {} };
		}
	}

	this._clusterConfigTitle = configTitle;
	this._clusterConfig = config;

	// Compute cluster counter from existing names
	for (var name in config.clusters) {
		var match = name.match(/^Cluster #(\d+)$/);
		if (match) {
			var num = parseInt(match[1], 10);
			if (num >= this._clusterCounter) { this._clusterCounter = num; }
		}
	}

	// Inject virtual cluster nodes into the changes
	changes.nodes = changes.nodes || {};
	for (var clusterName in config.clusters) {
		var clusterId = CLUSTER_PREFIX + clusterName;
		if (!changes.nodes[clusterId] && !(objects.nodes && objects.nodes[clusterId])) {
			var clusterDef = config.clusters[clusterName];
			changes.nodes[clusterId] = {
				label: clusterDef.label || clusterName,
				color: clusterDef.color || null,
				_isCluster: true
			};
			// Apply cluster nesting (cluster inside cluster)
			if (clusterDef.parent && config.clusters[clusterDef.parent]) {
				changes.nodes[clusterId].cluster = CLUSTER_PREFIX + clusterDef.parent;
			}
		}
	}

	// Apply cluster assignments to real nodes
	for (var nodeId in config.assignments) {
		var clusterName = config.assignments[nodeId];
		var clusterId = CLUSTER_PREFIX + clusterName;
		if (changes.nodes[nodeId]) {
			changes.nodes[nodeId].cluster = clusterId;
		}
	}
};

/**
 * Style virtual cluster container nodes.
 */
exports.postApply = function(cy) {
	var config = this._clusterConfig;
	if (!config || !config.clusters) { return; }
	for (var clusterName in config.clusters) {
		var clusterId = CLUSTER_PREFIX + clusterName;
		var ele = cy.getElementById(clusterId);
		if (ele.length && ele.isNode()) {
			var clusterDef = config.clusters[clusterName];
			// Empty clusters need a minimum size to be visible and droppable
			var isEmpty = ele.children().length === 0;
			var style = {
				"text-valign": "top",
				"text-halign": "center",
				"text-margin-y": 18,
				"color": "#000",
				"background-opacity": 0.12,
				"border-width": 2,
				"border-style": "dashed",
				"border-color": clusterDef.color || "#888",
				"padding": "25px",
				"shape": "round-rectangle",
				"font-size": "16px",
				"font-weight": "bold",
				"min-width": isEmpty ? 120 : 0,
				"min-height": isEmpty ? 80 : 0
			};
			if (clusterDef.color) {
				style["background-color"] = clusterDef.color;
				style["border-color"] = clusterDef.color;
			}
			ele.style(style);
		}
	}
};

/**
 * Generate next auto-increment cluster name.
 */
exports._nextClusterName = function() {
	this._clusterCounter++;
	return "Cluster #" + this._clusterCounter;
};

/**
 * Create a new named cluster.
 */
exports.createCluster = function(name, opts) {
	opts = opts || {};
	var config = this._clusterConfig;
	config.clusters[name] = {
		label: opts.label || name,
		color: opts.color || null
	};

	var cy = this._cy;
	var clusterId = CLUSTER_PREFIX + name;
	if (cy && !cy.getElementById(clusterId).length) {
		var pos = opts.position || { x: 0, y: 0 };
		cy.add({
			group: "nodes",
			data: { id: clusterId, label: opts.label || name },
			position: pos
		});
		exports.postApply.call(this, cy);
	}

	exports._saveClusterConfig.call(this);

	// Force re-render so children become interactive immediately
	if (cy) {
		setTimeout(function() { cy.forceRender(); }, 0);
	}

	return clusterId;
};

/**
 * Rename a cluster. Updates all assignments, Cytoscape node, and config.
 */
exports.renameCluster = function(oldName, newName) {
	var config = this._clusterConfig;
	if (!config.clusters[oldName]) { return; }
	if (oldName === newName) { return; }

	// Copy cluster definition with new label
	var def = config.clusters[oldName];
	def.label = newName;
	config.clusters[newName] = def;
	delete config.clusters[oldName];

	// Update all assignments
	for (var nodeId in config.assignments) {
		if (config.assignments[nodeId] === oldName) {
			config.assignments[nodeId] = newName;
		}
	}

	// Update Cytoscape: remove old, add new, reparent children
	var cy = this._cy;
	if (cy) {
		var oldId = CLUSTER_PREFIX + oldName;
		var newId = CLUSTER_PREFIX + newName;
		var oldEle = cy.getElementById(oldId);
		var pos = oldEle.length ? oldEle.position() : { x: 0, y: 0 };
		var children = oldEle.length ? oldEle.children() : cy.collection();

		// Save child positions before reparenting
		var childPositions = {};
		children.forEach(function(c) {
			childPositions[c.id()] = { x: c.position("x"), y: c.position("y") };
		});

		// Move children out first
		children.move({ parent: null });

		// Remove old cluster node
		if (oldEle.length) { cy.remove(oldEle); }

		// Add new cluster node
		cy.add({
			group: "nodes",
			data: { id: newId, label: newName },
			position: pos
		});

		// Reparent children and restore positions
		children.move({ parent: newId });
		children.forEach(function(c) {
			if (childPositions[c.id()]) { c.position(childPositions[c.id()]); }
		});

		exports.postApply.call(this, cy);
	}

	exports._saveClusterConfig.call(this);
};

/**
 * Delete a named cluster. Unassigns all member nodes.
 */
exports.deleteCluster = function(name) {
	var config = this._clusterConfig;
	delete config.clusters[name];

	for (var nodeId in config.assignments) {
		if (config.assignments[nodeId] === name) {
			delete config.assignments[nodeId];
			var cy = this._cy;
			if (cy) {
				var ele = cy.getElementById(nodeId);
				if (ele.length) { ele.move({ parent: null }); }
			}
		}
	}

	var cy = this._cy;
	if (cy) {
		var ele = cy.getElementById(CLUSTER_PREFIX + name);
		if (ele.length) { cy.remove(ele); }
	}

	exports._saveClusterConfig.call(this);
};

/**
 * Assign a node to a named cluster (or remove with null).
 */
/**
 * Move a node to a new parent, preserving its position.
 * Cytoscape's node.move() resets position, so we save/restore.
 */
function movePreservingPosition(node, parentId) {
	var pos = { x: node.position("x"), y: node.position("y") };
	node.move({ parent: parentId });
	node.position(pos);
	node.unlock();
}

exports.assignCluster = function(nodeId, targetId) {
	var cy = this._cy;
	if (!cy) { return; }
	var config = this._clusterConfig;

	var node = cy.getElementById(nodeId);
	if (!node.length || !node.isNode()) { return; }

	// For cluster nodes, store nesting in config as well
	var isClusterNode = nodeId.indexOf(CLUSTER_PREFIX) === 0;

	if (targetId) {
		// Prevent circular nesting: target must not be a descendant of node
		if (isClusterNode) {
			var descendants = node.descendants();
			var isCircular = false;
			descendants.forEach(function(d) {
				if (d.id() === targetId) { isCircular = true; }
			});
			if (targetId === nodeId || isCircular) { return; }
		}

		var clusterName;
		if (targetId.indexOf(CLUSTER_PREFIX) === 0) {
			// Dropped onto a cluster container
			clusterName = targetId.substring(CLUSTER_PREFIX.length);
		} else {
			// Dropped onto a regular node
			var targetParent = cy.getElementById(targetId).parent();
			if (targetParent.length && targetParent.id().indexOf(CLUSTER_PREFIX) === 0) {
				// Target is in a cluster — join same cluster
				clusterName = targetParent.id().substring(CLUSTER_PREFIX.length);
			} else if (isClusterNode) {
				// Cluster dropped onto a regular node — don't auto-create, skip
				return;
			} else {
				// Neither in a cluster — auto-create with incremented name
				clusterName = exports._nextClusterName.call(this);
				var targetNode = cy.getElementById(targetId);
				var tPos = targetNode.position();
				var nPos = node.position();
				// Place cluster at midpoint of the two nodes
				var midX = (tPos.x + nPos.x) / 2;
				var midY = (tPos.y + nPos.y) / 2;
				exports.createCluster.call(this, clusterName, {
					label: clusterName,
					position: { x: midX, y: midY }
				});
				// Offset nodes if they overlap
				if (Math.abs(tPos.x - nPos.x) < 20 && Math.abs(tPos.y - nPos.y) < 20) {
					tPos = { x: midX - 40, y: midY };
					nPos = { x: midX + 40, y: midY };
					targetNode.position(tPos);
					node.position(nPos);
				}
				// Assign the target node too
				config.assignments[targetId] = clusterName;
				movePreservingPosition(targetNode, CLUSTER_PREFIX + clusterName);
			}
		}

		if (clusterName && config.clusters[clusterName]) {
			if (isClusterNode) {
				// Nest cluster inside another cluster
				var myName = nodeId.substring(CLUSTER_PREFIX.length);
				config.clusters[myName].parent = clusterName;
			} else {
				config.assignments[nodeId] = clusterName;
			}
			movePreservingPosition(node, CLUSTER_PREFIX + clusterName);
		}
	} else {
		// Remove from cluster
		if (isClusterNode) {
			var myName = nodeId.substring(CLUSTER_PREFIX.length);
			delete config.clusters[myName].parent;
			movePreservingPosition(node, null);
		} else {
			var oldCluster = config.assignments[nodeId];
			delete config.assignments[nodeId];
			movePreservingPosition(node, null);
		}

		// If cluster is now empty, delete it (only for regular node removal)
		if (!isClusterNode && oldCluster) {
			var hasMembers = false;
			for (var id in config.assignments) {
				if (config.assignments[id] === oldCluster) { hasMembers = true; break; }
			}
			if (!hasMembers) {
				exports.deleteCluster.call(this, oldCluster);
			}
		}
	}

	exports._saveClusterConfig.call(this);
};

/**
 * Write config to the tiddler.
 */
exports._saveClusterConfig = function() {
	if (!this._clusterConfigTitle) { return; }
	var wiki = this.wiki || $tw.wiki;
	var json = JSON.stringify(this._clusterConfig, null, "\t");
	wiki.addTiddler(new $tw.Tiddler(
		wiki.getTiddler(this._clusterConfigTitle) || {},
		{
			title: this._clusterConfigTitle,
			text: json,
			type: "application/json"
		}
	));
};

exports.destroy = function() {
	exports._removeInlineEdit.call(this);
};
