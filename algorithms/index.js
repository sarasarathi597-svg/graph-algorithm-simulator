
"use strict";

const { normalizeGraph } = require("./util");
const traversal = require("./traversal");
const shortestPath = require("./shortestPath");
const mst = require("./mst");
const topological = require("./topological");
const cycleDetection = require("./cycleDetection");
const connectivity = require("./connectivity");
const networkFlow = require("./networkFlow");
const other = require("./otherAlgorithms");

/**
 * The single registry used by both the API and the algorithm selector.
 * Each entry: key, name, category, explanation (spoken by the voice assistant), run().
 */
const CATALOG = [
  // 1. Graph Traversal
  { key: "bfs", name: "Breadth-First Search (BFS)", category: "Graph Traversal", run: traversal.bfs,
    explanation: "Breadth-first search explores a graph level by level using a queue. It visits every neighbour of the current node before going deeper, so on an unweighted graph it finds the path with the fewest edges. Time complexity is O of V plus E." },
  { key: "dfs", name: "Depth-First Search (DFS)", category: "Graph Traversal", run: traversal.dfs,
    explanation: "Depth-first search follows one branch as deep as it can, then backtracks. It uses a stack, or recursion, and runs in O of V plus E. It is the base for cycle detection, topological sorting and connectivity algorithms." },
  { key: "iddfs", name: "Iterative Deepening DFS (IDDFS)", category: "Graph Traversal", run: traversal.iddfs,
    explanation: "Iterative deepening runs depth-first search again and again with a growing depth limit. It uses the small memory of depth-first search but finds the shallowest goal like breadth-first search." },
  { key: "bidirectional-bfs", name: "Bidirectional BFS", category: "Graph Traversal", run: traversal.bidirectionalBFS,
    explanation: "Bidirectional breadth-first search grows one frontier from the start and another from the goal. When the two frontiers meet, the path is joined. It explores far fewer nodes than a single search." },
  { key: "dls", name: "Depth-Limited Search (DLS)", category: "Graph Traversal", run: traversal.dls,
    explanation: "Depth-limited search is depth-first search that refuses to go deeper than a fixed limit. It stops infinite descent in very deep or cyclic graphs." },

  // 2. Shortest Path
  { key: "dijkstra", name: "Dijkstra", category: "Shortest Path", run: shortestPath.dijkstra,
    explanation: "Dijkstra's algorithm finds shortest paths from one source when all weights are non-negative. It repeatedly settles the closest unfinished node and relaxes its edges." },
  { key: "bellman-ford", name: "Bellman-Ford", category: "Shortest Path", run: shortestPath.bellmanFord,
    explanation: "Bellman-Ford relaxes every edge V minus one times. It is slower than Dijkstra but it accepts negative weights and can report a negative cycle." },
  { key: "floyd-warshall", name: "Floyd-Warshall", category: "Shortest Path", run: shortestPath.floydWarshall,
    explanation: "Floyd-Warshall computes shortest distances between every pair of nodes by trying each node as an intermediate stop. It runs in O of V cubed." },
  { key: "astar", name: "A* Search", category: "Shortest Path", run: shortestPath.aStar,
    explanation: "A star is Dijkstra guided by a heuristic. It orders nodes by cost so far plus an estimate of the remaining distance, so it heads straight towards the goal." },
  { key: "johnson", name: "Johnson", category: "Shortest Path", run: shortestPath.johnson,
    explanation: "Johnson's algorithm reweights the edges with Bellman-Ford so they become non-negative, then runs Dijkstra from every node. It is efficient for sparse graphs with negative weights." },

  // 3. Minimum Spanning Tree
  { key: "prim", name: "Prim", category: "Minimum Spanning Tree", run: mst.prim,
    explanation: "Prim's algorithm grows a single tree, always adding the cheapest edge that leaves the tree, until every node is connected." },
  { key: "kruskal", name: "Kruskal", category: "Minimum Spanning Tree", run: mst.kruskal,
    explanation: "Kruskal's algorithm sorts all edges by weight and adds each one unless it would close a cycle, which is checked with a union-find structure." },
  { key: "boruvka", name: "Borůvka", category: "Minimum Spanning Tree", run: mst.boruvka,
    explanation: "Borůvka's algorithm lets every component choose its own cheapest outgoing edge in each round, so components merge in parallel." },

  // 4. Topological Sorting
  { key: "kahn", name: "Kahn's Algorithm", category: "Topological Sorting", run: topological.kahn,
    explanation: "Kahn's algorithm repeatedly outputs a node with no incoming edges and removes it. If nodes remain at the end, the graph has a cycle." },
  { key: "topo-dfs", name: "DFS Topological Sort", category: "Topological Sorting", run: topological.dfsTopological,
    explanation: "The depth-first version outputs a node only after all of its successors are finished, then reverses the finishing order." },

  // 5. Cycle Detection
  { key: "dfs-cycle", name: "DFS Cycle Detection", category: "Cycle Detection", run: cycleDetection.dfsCycle,
    explanation: "Depth-first cycle detection reports a cycle when it meets a node that is still on the recursion stack, or, in an undirected graph, a visited node that is not the parent." },
  { key: "union-find-cycle", name: "Union-Find Cycle Detection", category: "Cycle Detection", run: cycleDetection.unionFindCycle,
    explanation: "Union-find cycle detection adds edges one at a time. If both endpoints already belong to the same set, that edge closes a cycle." },
  { key: "floyd-cycle", name: "Floyd's Cycle Detection (linked list demo)", category: "Cycle Detection", run: cycleDetection.floydCycle,
    explanation: "Floyd's tortoise and hare is for linked structures. Following each node's first outgoing edge like a next pointer, a slow and a fast pointer meet inside a loop if one exists." },

  // 6. Connectivity
  { key: "kosaraju", name: "Kosaraju SCC", category: "Connectivity", run: connectivity.kosaraju,
    explanation: "Kosaraju finds strongly connected components with two passes: a depth-first search for the finishing order, then a depth-first search on the reversed graph." },
  { key: "tarjan-scc", name: "Tarjan SCC", category: "Connectivity", run: connectivity.tarjanSCC,
    explanation: "Tarjan finds strongly connected components in a single depth-first search using discovery indices and low-link values." },
  { key: "tarjan-bridges", name: "Tarjan Bridges", category: "Connectivity", run: connectivity.bridges,
    explanation: "A bridge is an edge whose removal disconnects the graph. Tarjan finds them by comparing low-link values with discovery times." },
  { key: "articulation-points", name: "Articulation Points", category: "Connectivity", run: connectivity.articulationPoints,
    explanation: "An articulation point is a node whose removal breaks the graph into more pieces. They are found with the same depth-first low-link technique." },

  // 7. Network Flow
  { key: "ford-fulkerson", name: "Ford-Fulkerson", category: "Network Flow", run: networkFlow.fordFulkerson,
    explanation: "Ford-Fulkerson repeatedly finds any augmenting path from source to sink in the residual graph and pushes as much flow as the bottleneck allows." },
  { key: "edmonds-karp", name: "Edmonds-Karp", category: "Network Flow", run: networkFlow.edmondsKarp,
    explanation: "Edmonds-Karp is Ford-Fulkerson that always picks the shortest augmenting path using breadth-first search, which guarantees a polynomial running time." },
  { key: "dinic", name: "Dinic", category: "Network Flow", run: networkFlow.dinic,
    explanation: "Dinic's algorithm builds a level graph with breadth-first search and then pushes blocking flows with depth-first search, which is much faster on large networks." },

  // 8. Other
  { key: "union-find", name: "Union-Find / DSU", category: "Other Algorithms", run: other.unionFind,
    explanation: "A disjoint set union structure keeps track of which nodes belong to the same group, with union by rank and path compression making operations nearly constant time." },
  { key: "graph-coloring", name: "Graph Coloring", category: "Other Algorithms", run: other.graphColoring,
    explanation: "Greedy graph colouring gives each node the smallest colour that none of its neighbours uses, so no edge joins two nodes of the same colour." },
  { key: "bipartite", name: "Bipartite Checking", category: "Other Algorithms", run: other.bipartite,
    explanation: "A graph is bipartite if its nodes can be split into two sides with every edge crossing between them. Breadth-first two-colouring finds a conflict when an odd cycle exists." },
  { key: "hierholzer", name: "Hierholzer (Eulerian Trail)", category: "Other Algorithms", run: other.hierholzer,
    explanation: "Hierholzer's algorithm builds an Eulerian trail that uses every edge exactly once, by walking until stuck and splicing detours into the trail." },
  { key: "hamiltonian", name: "Hamiltonian Path", category: "Other Algorithms", run: other.hamiltonianPath,
    explanation: "A Hamiltonian path visits every node exactly once. Finding one is NP-complete, so this uses backtracking and suits small graphs." },
];

const BY_KEY = new Map(CATALOG.map((a) => [a.key, a]));

const CATEGORY_ORDER = [
  "Graph Traversal",
  "Shortest Path",
  "Minimum Spanning Tree",
  "Topological Sorting",
  "Cycle Detection",
  "Connectivity",
  "Network Flow",
  "Other Algorithms",
];

function listAlgorithms() {
  return CATEGORY_ORDER.map((category) => ({
    category,
    algorithms: CATALOG.filter((a) => a.category === category).map(({ key, name, explanation }) => ({ key, name, explanation })),
  }));
}

function runAlgorithm(key, graph, options) {
  const entry = BY_KEY.get(String(key));
  if (!entry) {
    const err = new Error(`Unknown algorithm: ${key}`);
    err.status = 400;
    throw err;
  }
  const g = normalizeGraph(graph);
  const out = entry.run(g, options || {}) || {};
  return {
    algorithm: entry.key,
    name: entry.name,
    category: entry.category,
    explanation: entry.explanation,
    steps: Array.isArray(out.steps) ? out.steps : [],
    result: out.result || {},
  };
}

module.exports = { CATALOG, listAlgorithms, runAlgorithm };
