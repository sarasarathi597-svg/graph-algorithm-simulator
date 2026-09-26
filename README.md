# Graph Algorithm Simulator

A 3D graph algorithm simulator: build a graph, pick one of 30 algorithms, and watch it
run step by step in a Three.js scene — with optional voice commands and spoken
explanations.

## Requirements

- Node.js 18 or newer

## Run it

```bash
npm install
npm start
```

Then open http://localhost:3000

## What is inside

```
graph-algorithm-simulator/
├── package.json
├── server.js               Express server + REST API
├── algorithms/             30 algorithms, grouped by category
│   ├── traversal.js
│   ├── shortestPath.js
│   ├── mst.js
│   ├── topological.js
│   ├── cycleDetection.js
│   ├── connectivity.js
│   ├── networkFlow.js
│   ├── otherAlgorithms.js
│   ├── index.js            registry + metadata
│   └── util.js             shared graph helpers
└── public/
    ├── index.html
    ├── css/style.css
    ├── js/{app,graph,visualization3d,voice,controls}.js
    └── assets/
```

No database is used — the graph lives in memory (browser side, and per-request on the
server).

## API

| Method | Route | Purpose |
| ------ | ----- | ------- |
| GET  | `/api/algorithms` | list of all algorithms grouped by category |
| POST | `/api/run` | `{ algorithm, graph, options }` → `{ steps, result }` |
| POST | `/api/graph` | store the current graph in server memory |
| GET  | `/api/graph` | read back the stored graph |
| GET  | `/api/health` | health check |

## Voice commands

"add node", "delete node A", "add edge A B", "run bfs", "run dijkstra",
"pause", "resume", "step", "reset graph", "explain this algorithm", "random graph".

Voice recognition needs a Chromium-based browser. Every command has a button too.
