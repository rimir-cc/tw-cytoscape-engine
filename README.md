# Cytoscape Engine

An alternative graph rendering engine for [tw-graph](https://github.com/flibbles/tw5-graph) powered by [Cytoscape.js](https://js.cytoscape.org/) (v3.33.2).

## Key Features

- **Drop-in replacement** for vis-network — existing `<$graph>` markup works unchanged
- **Compound/container nodes** — group nodes visually by setting a `parent` attribute on `<$node>`
- **COSE layout** — Compound Spring Embedder layout that handles nested node groups natively
- Full event support: hover, click, drag, double-click
- Position persistence and physics simulation

## Quick Start

1. Install this plugin alongside `flibbles/graph`
2. Go to **Settings > Graph Engine** and select **Cytoscape**
3. All existing graphs render with Cytoscape.js

## Compound Nodes

The key differentiator over vis-network:

```html
<$graph>
  <$node $tiddler="Team" label="Team Alpha"/>
  <$node $tiddler="Person1" label="Alice" parent="Team"/>
  <$node $tiddler="Person2" label="Bob" parent="Team"/>
</$graph>
```

Alice and Bob render inside a container labeled "Team Alpha".

## Prerequisites

- `$:/plugins/flibbles/graph` (tw-graph) v1.6.0+
- TiddlyWiki 5.3.0+

## License

MIT
