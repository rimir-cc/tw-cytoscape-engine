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
	// Don't overwrite _clusterConfig — process() runs before init() and already
	// populated it from the config tiddler.
	if (!this._clusterConfig) {
		this._clusterConfig = { clusters: {}, assignments: {} };
	}
	if (!this._clusterCounter) {
		this._clusterCounter = 0;
	}
	this._activeInput = null;
	this._lastSavedJSON = null;

	var self = this;

	// Double-click cluster container → inline rename
	cy.on("dbltap", "node", function(evt) {
		var node = evt.target;
		var nodeId = node.id();
		if (nodeId.indexOf(CLUSTER_PREFIX) !== 0) { return; }
		var clusterName = nodeId.substring(CLUSTER_PREFIX.length);
		exports._startInlineEdit.call(self, node, clusterName);
	});

	// Watch config tiddler for changes (external edits, other widgets, etc.)
	var wiki = this.wiki || $tw.wiki;
	this._configChangeHandler = function(changes) {
		if (!self._clusterConfigTitle) { return; }
		if (!changes[self._clusterConfigTitle]) { return; }
		// Skip changes we just wrote ourselves
		var tiddler = wiki.getTiddler(self._clusterConfigTitle);
		var text = tiddler ? (tiddler.fields.text || "{}") : "{}";
		if (text === self._lastSavedJSON) { return; }
		exports._syncFromConfig.call(self, cy);
	};
	wiki.addEventListener("change", this._configChangeHandler);
};

/**
 * Show an HTML input overlay on the cluster node for renaming.
 */
var PALETTE = [
	null, "#848484", "#2B7CE9", "#228B22", "#DC143C",
	"#9932CC", "#FF8C00", "#008B8B", "#191970"
];

exports._startInlineEdit = function(node, clusterName) {
	var cy = this._cy;
	if (!cy) { return; }
	var self = this;

	exports._removeInlineEdit.call(this);

	var container = cy.container();
	var containerRect = container.getBoundingClientRect();
	var pos = node.renderedPosition();
	var clusterDef = this._clusterConfig.clusters[clusterName];
	if (!clusterDef) {
		clusterDef = { label: clusterName, color: null };
		this._clusterConfig.clusters[clusterName] = clusterDef;
	}
	var currentColor = clusterDef.color || null;

	// Clamp popup position within the container bounds with margin
	var margin = 20;
	var px = Math.max(margin, Math.min(pos.x, containerRect.width - margin));
	var py = Math.max(margin + 40, Math.min(pos.y, containerRect.height - margin));

	// Wrapper panel — positioned inside container, clamped to viewport
	var panel = document.createElement("div");
	panel.style.cssText = "position:absolute;z-index:1001;" +
		"left:" + px + "px;top:" + py + "px;" +
		"transform:translate(-50%,0);" +
		"background:#fff;border:2px solid #2B7CE9;border-radius:6px;" +
		"padding:6px 8px;display:flex;flex-direction:row;gap:6px;align-items:center;" +
		"box-shadow:0 2px 8px rgba(0,0,0,0.2);";

	// Stop all pointer events from leaking through to Cytoscape canvas
	["mousedown", "mouseup", "click", "dblclick", "pointerdown", "pointerup"].forEach(function(evt) {
		panel.addEventListener(evt, function(e) { e.stopPropagation(); });
	});

	// Name input
	var input = document.createElement("input");
	input.type = "text";
	input.value = clusterDef.label || clusterName;
	input.style.cssText = "font-size:13px;font-family:arial,sans-serif;font-weight:bold;" +
		"text-align:center;padding:3px 6px;border:1px solid #ccc;" +
		"border-radius:4px;outline:none;width:90px;box-sizing:border-box;";
	panel.appendChild(input);

	// Color swatches row
	var swatchRow = document.createElement("div");
	swatchRow.style.cssText = "display:flex;flex-wrap:wrap;gap:2px;justify-content:center;";

	PALETTE.forEach(function(color) {
		var swatch = document.createElement("div");
		var isNone = color === null;
		var bg = isNone ? "#fff" : color;
		var border = (color === currentColor || (isNone && !currentColor))
			? "2px solid #2B7CE9" : "1px solid #aaa";
		swatch.style.cssText = "width:16px;height:16px;border-radius:3px;cursor:pointer;" +
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

	// Delete button (bin icon)
	var deleteBtn = document.createElement("div");
	deleteBtn.title = "Delete cluster";
	deleteBtn.style.cssText = "width:22px;height:22px;cursor:pointer;display:flex;" +
		"align-items:center;justify-content:center;border-radius:4px;flex-shrink:0;" +
		"border:1px solid #ccc;background:#fff;transition:background 0.15s;";
	deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
		'stroke="#999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
		'<polyline points="3 6 5 6 21 6"/>' +
		'<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
		'<line x1="10" y1="11" x2="10" y2="17"/>' +
		'<line x1="14" y1="11" x2="14" y2="17"/></svg>';
	deleteBtn.addEventListener("mouseenter", function() {
		deleteBtn.style.background = "#fee";
		deleteBtn.querySelector("svg").setAttribute("stroke", "#c00");
	});
	deleteBtn.addEventListener("mouseleave", function() {
		deleteBtn.style.background = "#fff";
		deleteBtn.querySelector("svg").setAttribute("stroke", "#999");
	});
	deleteBtn.addEventListener("click", function(e) {
		e.stopPropagation();
		var memberCount = 0;
		var cfg = self._clusterConfig;
		for (var id in cfg.assignments) {
			if (cfg.assignments[id] === clusterName) { memberCount++; }
		}
		var msg = memberCount > 0
			? "Delete cluster \"" + (clusterDef.label || clusterName) + "\" with " + memberCount + " node" + (memberCount > 1 ? "s" : "") + "?\nNodes will be kept but ungrouped."
			: "Delete empty cluster \"" + (clusterDef.label || clusterName) + "\"?";
		if (confirm(msg)) {
			exports._removeInlineEdit.call(self);
			exports.deleteCluster.call(self, clusterName);
		}
	});
	panel.appendChild(deleteBtn);

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
 * Sync Cytoscape state from the config tiddler.
 * Called when the config tiddler changes externally.
 */
exports._syncFromConfig = function(cy) {
	var wiki = this.wiki || $tw.wiki;
	var tiddler = wiki.getTiddler(this._clusterConfigTitle);
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
	this._clusterConfig = config;

	// Remove cluster nodes not in config
	cy.nodes().forEach(function(n) {
		var id = n.id();
		if (id.indexOf(CLUSTER_PREFIX) !== 0) { return; }
		var name = id.substring(CLUSTER_PREFIX.length);
		if (!config.clusters[name]) {
			n.children().forEach(function(child) {
				movePreservingPosition(child, null);
			});
			cy.remove(n);
		}
	});

	// Add cluster nodes in config but not in Cytoscape
	for (var name in config.clusters) {
		var clusterId = CLUSTER_PREFIX + name;
		var clusterDef = config.clusters[name];
		if (!cy.getElementById(clusterId).length) {
			cy.add({
				group: "nodes",
				data: { id: clusterId, label: clusterDef.label || name }
			});
		} else {
			// Update label if changed
			cy.getElementById(clusterId).data("label", clusterDef.label || name);
		}
	}

	// Sync cluster nesting
	for (var name in config.clusters) {
		var clusterId = CLUSTER_PREFIX + name;
		var clusterDef = config.clusters[name];
		var clusterNode = cy.getElementById(clusterId);
		if (!clusterNode.length) { continue; }
		var expectedParent = (clusterDef.parent && config.clusters[clusterDef.parent])
			? CLUSTER_PREFIX + clusterDef.parent : null;
		var currentParent = clusterNode.parent().length ? clusterNode.parent().id() : null;
		if (currentParent !== expectedParent) {
			moveCompoundPreservingChildren(cy, clusterNode, expectedParent);
		}
	}

	// Sync node assignments
	cy.nodes().forEach(function(n) {
		var id = n.id();
		if (id.indexOf(CLUSTER_PREFIX) === 0) { return; }
		var expectedCluster = config.assignments[id];
		var expectedParent = expectedCluster ? CLUSTER_PREFIX + expectedCluster : null;
		var currentParent = n.parent().length ? n.parent().id() : null;
		if (currentParent !== expectedParent) {
			movePreservingPosition(n, expectedParent);
		}
	});

	// Re-apply cluster styles
	exports.postApply.call(this, cy);
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

	// Don't save here — caller (assignCluster) saves after all assignments are done.
	// Saving mid-operation triggers TW refresh → process() replaces this._clusterConfig,
	// causing the caller's config reference to go stale.

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
/**
 * Move a compound (cluster) node to a new parent, preserving children.
 * Cytoscape's move() on compounds orphans children — save and re-parent them.
 */
function moveCompoundPreservingChildren(cy, node, newParentId) {
	var pos = { x: node.position("x"), y: node.position("y") };
	var children = node.children();
	var childData = [];
	children.forEach(function(c) {
		childData.push({ id: c.id(), x: c.position("x"), y: c.position("y") });
	});
	var nodeId = node.id();
	node.move({ parent: newParentId });
	node.position(pos);
	// Re-parent orphaned children
	for (var i = 0; i < childData.length; i++) {
		var cd = childData[i];
		var child = cy.getElementById(cd.id);
		if (child.length) {
			child.move({ parent: nodeId });
			child.position({ x: cd.x, y: cd.y });
		}
	}
}

function movePreservingPosition(node, parentId) {
	var pos = { x: node.position("x"), y: node.position("y") };
	node.move({ parent: parentId });
	node.position(pos);
	node.unlock();
}

/**
 * Dissolve a cluster if it has 0 or 1 direct children left
 * (counting both assigned nodes AND nested sub-clusters).
 * Unparents the sole remaining child (if any) and deletes the cluster.
 */
function dissolveIfTooSmall(self, cy, config, clusterName) {
	if (!clusterName || !config.clusters[clusterName]) { return; }

	// Count direct node assignments
	var nodeMembers = [];
	for (var id in config.assignments) {
		if (config.assignments[id] === clusterName) {
			nodeMembers.push(id);
		}
	}

	// Count nested sub-clusters
	var childClusters = [];
	for (var name in config.clusters) {
		if (config.clusters[name].parent === clusterName) {
			childClusters.push(name);
		}
	}

	var totalChildren = nodeMembers.length + childClusters.length;
	if (totalChildren > 1) { return; }

	// 0 or 1 children — dissolve
	// Unparent the sole remaining node member
	if (nodeMembers.length === 1 && childClusters.length === 0) {
		var lastId = nodeMembers[0];
		delete config.assignments[lastId];
		var lastNode = cy.getElementById(lastId);
		if (lastNode.length) {
			movePreservingPosition(lastNode, null);
		}
	}
	// Unparent the sole remaining child cluster
	if (childClusters.length === 1 && nodeMembers.length === 0) {
		var childName = childClusters[0];
		delete config.clusters[childName].parent;
		var childNode = cy.getElementById(CLUSTER_PREFIX + childName);
		if (childNode.length) {
			moveCompoundPreservingChildren(cy, childNode, null);
		}
	}

	exports.deleteCluster.call(self, clusterName);
}

exports.assignCluster = function(nodeId, targetId) {
	var cy = this._cy;
	if (!cy) { return; }
	var config = this._clusterConfig;

	var node = cy.getElementById(nodeId);
	if (!node.length || !node.isNode()) { return; }

	var isClusterNode = nodeId.indexOf(CLUSTER_PREFIX) === 0;

	// Remember old cluster so we can check if it needs dissolving after reassignment
	var oldClusterName = null;
	if (isClusterNode) {
		var myName = nodeId.substring(CLUSTER_PREFIX.length);
		oldClusterName = config.clusters[myName] ? config.clusters[myName].parent || null : null;
	} else {
		oldClusterName = config.assignments[nodeId] || null;
	}

	if (targetId) {
		// Prevent circular nesting
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
			clusterName = targetId.substring(CLUSTER_PREFIX.length);
		} else {
			var targetParent = cy.getElementById(targetId).parent();
			var targetInCluster = targetParent.length && targetParent.id().indexOf(CLUSTER_PREFIX) === 0;
			var sameCluster = targetInCluster && oldClusterName &&
				targetParent.id() === CLUSTER_PREFIX + oldClusterName;

			if (targetInCluster && !sameCluster) {
				// Target is in a different cluster — join that cluster
				clusterName = targetParent.id().substring(CLUSTER_PREFIX.length);
			} else if (isClusterNode) {
				return;
			} else {
				// Both nodes are unassigned, or both in the same cluster
				// → auto-create a new (sub-)cluster
				clusterName = exports._nextClusterName.call(this);
				var targetNode = cy.getElementById(targetId);
				var tPos = targetNode.position();
				var nPos = node.position();
				var midX = (tPos.x + nPos.x) / 2;
				var midY = (tPos.y + nPos.y) / 2;
				var createOpts = {
					label: clusterName,
					position: { x: midX, y: midY }
				};
				exports.createCluster.call(this, clusterName, createOpts);
				// Nest new cluster inside parent cluster if both nodes are in one
				if (sameCluster && oldClusterName) {
					config.clusters[clusterName].parent = oldClusterName;
					var clusterNode = cy.getElementById(CLUSTER_PREFIX + clusterName);
					if (clusterNode.length) {
						moveCompoundPreservingChildren(cy, clusterNode, CLUSTER_PREFIX + oldClusterName);
					}
				}
				if (Math.abs(tPos.x - nPos.x) < 20 && Math.abs(tPos.y - nPos.y) < 20) {
					tPos = { x: midX - 40, y: midY };
					nPos = { x: midX + 40, y: midY };
					targetNode.position(tPos);
					node.position(nPos);
				}
				config.assignments[targetId] = clusterName;
				movePreservingPosition(targetNode, CLUSTER_PREFIX + clusterName);
			}
		}

		if (clusterName && config.clusters[clusterName]) {
			if (isClusterNode) {
				var myName = nodeId.substring(CLUSTER_PREFIX.length);
				config.clusters[myName].parent = clusterName;
				moveCompoundPreservingChildren(cy, node, CLUSTER_PREFIX + clusterName);
			} else {
				config.assignments[nodeId] = clusterName;
				movePreservingPosition(node, CLUSTER_PREFIX + clusterName);
			}
		}

		// Dissolve old cluster if the node left it with too few members
		if (oldClusterName && oldClusterName !== clusterName) {
			dissolveIfTooSmall(this, cy, config, oldClusterName);
		}
	} else {
		// Remove from cluster
		if (isClusterNode) {
			var myName = nodeId.substring(CLUSTER_PREFIX.length);
			delete config.clusters[myName].parent;
			moveCompoundPreservingChildren(cy, node, null);
		} else {
			delete config.assignments[nodeId];
			movePreservingPosition(node, null);
		}

		// Dissolve old cluster if too few members remain
		if (!isClusterNode && oldClusterName) {
			dissolveIfTooSmall(this, cy, config, oldClusterName);
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
	this._lastSavedJSON = json;
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
	if (this._configChangeHandler) {
		var wiki = this.wiki || $tw.wiki;
		wiki.removeEventListener("change", this._configChangeHandler);
		this._configChangeHandler = null;
	}
};
