"use strict";

const {
  buildAdjacency,
  createRecorder,
  createPQ,
  pickStart,
  pickEnd,
  rebuildPath,
  emptyGraphResult,
} = require("./util");

function dijkstra(g, options) {
  const r = createRecorder();
  const start = pickStart(g, options);
  const end = pickEnd(g, options);
  if (!start) return emptyGraphResult(r);
  if (g.edges.some((e) => e.weight < 0)) {
    r.info("Warning: negative weights found. Dijkstra needs non-negative weights — use Bellman-Ford.");
  }
  const adj = buildAdjacency(g);
  const dist = new Map(g.nodes.map((n) => [n, Infinity]));
  const prev = new Map();
  const settled = new Set();
  dist.set(start, 0);
  const pq = createPQ();
  pq.push(start, 0);

  r.info(`Dijkstra from ${start}: always expand the closest unsettled node.`);
  r.mark(start, "source", `Distance to ${start} is 0.`);

  while (pq.size) {
    const item = pq.pop();
    const u = item.value;
    if (settled.has(u)) continue;
    settled.add(u);
    r.active(u, `Settle ${u} with distance ${dist.get(u)}.`);
    r.visit(u, `${u} is final at distance ${dist.get(u)}.`);
    for (const { to, weight } of adj.get(u)) {
      const nd = dist.get(u) + weight;
      r.edge(u, to, `Relax ${u} → ${to} (weight ${weight}).`);
      if (nd < dist.get(to)) {
        dist.set(to, nd);
        prev.set(to, u);
        pq.push(to, nd);
        r.result(u, to, `Better path to ${to}: ${nd}.`);
      } else {
        r.reject(u, to, `No improvement for ${to} (${dist.get(to)} ≤ ${nd}).`);
      }
    }
  }

  const path = rebuildPath(prev, start, end);
  for (let i = 0; i + 1 < path.length; i++) r.result(path[i], path[i + 1], `Shortest path edge ${path[i]} → ${path[i + 1]}.`);
  r.done(path.length ? `Shortest path ${start} → ${end}: ${path.join(" → ")} (cost ${dist.get(end)})` : `No path to ${end}.`);

  return {
    steps: r.steps,
    result: {
      distances: Object.fromEntries([...dist].map(([k, v]) => [k, v === Infinity ? null : v])),
      path,
      cost: dist.get(end) === Infinity ? null : dist.get(end),
      summary: path.length ? `Cost ${dist.get(end)}.` : "Target unreachable.",
    },
  };
}

function bellmanFord(g, options) {
  const r = createRecorder();
  const start = pickStart(g, options);
  const end = pickEnd(g, options);
  if (!start) return emptyGraphResult(r);

  const edges = g.directed
    ? g.edges.slice()
    : g.edges.flatMap((e) => [e, { from: e.to, to: e.from, weight: e.weight }]);
  const dist = new Map(g.nodes.map((n) => [n, Infinity]));
  const prev = new Map();
  dist.set(start, 0);
  r.info(`Bellman-Ford from ${start}: relax every edge ${g.nodes.length - 1} time(s). Handles negative weights.`);
  r.mark(start, "source", `Distance to ${start} is 0.`);

  for (let i = 1; i < g.nodes.length; i++) {
    let changed = false;
    r.info(`--- Pass ${i} ---`);
    for (const e of edges) {
      if (dist.get(e.from) === Infinity) continue;
      const nd = dist.get(e.from) + e.weight;
      r.edge(e.from, e.to, `Relax ${e.from} → ${e.to} (${e.weight}).`);
      if (nd < dist.get(e.to)) {
        dist.set(e.to, nd);
        prev.set(e.to, e.from);
        changed = true;
        r.result(e.from, e.to, `Update ${e.to} to ${nd}.`);
        r.visit(e.to, `${e.to} now costs ${nd}.`);
      }
    }
    if (!changed) { r.info("No change in this pass — stop early."); break; }
  }

  let negativeCycle = false;
  for (const e of edges) {
    if (dist.get(e.from) !== Infinity && dist.get(e.from) + e.weight < dist.get(e.to)) {
      negativeCycle = true;
      r.reject(e.from, e.to, `Edge ${e.from} → ${e.to} still improves — negative cycle detected!`);
    }
  }

  const path = negativeCycle ? [] : rebuildPath(prev, start, end);
  for (let i = 0; i + 1 < path.length; i++) r.result(path[i], path[i + 1], `Path edge ${path[i]} → ${path[i + 1]}.`);
  r.done(negativeCycle ? "Negative cycle detected — shortest paths are undefined." : path.length ? `Path: ${path.join(" → ")} (cost ${dist.get(end)})` : `No path to ${end}.`);

  return {
    steps: r.steps,
    result: {
      distances: Object.fromEntries([...dist].map(([k, v]) => [k, v === Infinity ? null : v])),
      path,
      negativeCycle,
      summary: negativeCycle ? "Negative cycle." : path.length ? `Cost ${dist.get(end)}.` : "Unreachable.",
    },
  };
}

function floydWarshall(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  const n = g.nodes.length;
  const idx = new Map(g.nodes.map((v, i) => [v, i]));
  const d = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
  for (const e of g.edges) {
    const a = idx.get(e.from);
    const b = idx.get(e.to);
    d[a][b] = Math.min(d[a][b], e.weight);
    if (!g.directed) d[b][a] = Math.min(d[b][a], e.weight);
  }

  r.info("Floyd-Warshall: try every node k as an intermediate stop for every pair (i, j).");
  for (let k = 0; k < n; k++) {
    r.active(g.nodes[k], `Using ${g.nodes[k]} as the intermediate node.`);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (d[i][k] + d[k][j] < d[i][j]) {
          d[i][j] = d[i][k] + d[k][j];
          r.result(g.nodes[i], g.nodes[j], `${g.nodes[i]} → ${g.nodes[j]} improved to ${d[i][j]} via ${g.nodes[k]}.`);
        }
      }
    }
  }

  const matrix = {};
  g.nodes.forEach((a, i) => {
    matrix[a] = {};
    g.nodes.forEach((b, j) => { matrix[a][b] = d[i][j] === Infinity ? null : d[i][j]; });
  });
  r.done("All-pairs shortest distances computed.");
  return { steps: r.steps, result: { matrix, summary: `All-pairs table for ${n} node(s).` } };
}

function aStar(g, options) {
  const r = createRecorder();
  const start = pickStart(g, options);
  const goal = pickEnd(g, options);
  if (!start) return emptyGraphResult(r);
  const adj = buildAdjacency(g);
  const positions = (options && options.positions) || {};

  const h = (node) => {
    const a = positions[node];
    const b = positions[goal];
    if (!a || !b) return 0; // falls back to Dijkstra behaviour
    return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
  };

  const gScore = new Map(g.nodes.map((n) => [n, Infinity]));
  gScore.set(start, 0);
  const prev = new Map();
  const closed = new Set();
  const pq = createPQ();
  pq.push(start, h(start));

  r.info(`A* from ${start} to ${goal}: cost so far + straight-line estimate to the goal.`);
  r.mark(start, "source", `Start at ${start}.`);
  r.mark(goal, "goal", `Goal is ${goal}.`);

  while (pq.size) {
    const { value: cur } = pq.pop();
    if (closed.has(cur)) continue;
    closed.add(cur);
    r.active(cur, `Expand ${cur} (g=${gScore.get(cur).toFixed(2)}, h=${h(cur).toFixed(2)}).`);
    r.visit(cur, `${cur} expanded.`);
    if (cur === goal) break;
    for (const { to, weight } of adj.get(cur)) {
      const tentative = gScore.get(cur) + weight;
      r.edge(cur, to, `Try ${cur} → ${to}.`);
      if (tentative < gScore.get(to)) {
        gScore.set(to, tentative);
        prev.set(to, cur);
        pq.push(to, tentative + h(to));
        r.result(cur, to, `Improved ${to}: g=${tentative.toFixed(2)}.`);
      } else {
        r.reject(cur, to, `${to} already has an equal or better cost.`);
      }
    }
  }

  const path = rebuildPath(prev, start, goal);
  for (let i = 0; i + 1 < path.length; i++) r.result(path[i], path[i + 1], `Path edge ${path[i]} → ${path[i + 1]}.`);
  r.done(path.length ? `A* path: ${path.join(" → ")} (cost ${gScore.get(goal)})` : `No path from ${start} to ${goal}.`);
  return {
    steps: r.steps,
    result: { path, cost: gScore.get(goal) === Infinity ? null : gScore.get(goal), summary: path.length ? `Cost ${gScore.get(goal)}.` : "No path." },
  };
}

function johnson(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  r.info("Johnson: reweight edges with Bellman-Ford from a virtual node, then run Dijkstra from every node.");

  // Bellman-Ford from a virtual node connected to all nodes with weight 0.
  const hMap = new Map(g.nodes.map((n) => [n, 0]));
  const edges = g.directed ? g.edges : g.edges.flatMap((e) => [e, { from: e.to, to: e.from, weight: e.weight }]);
  for (let i = 0; i < g.nodes.length; i++) {
    for (const e of edges) {
      if (hMap.get(e.from) + e.weight < hMap.get(e.to)) hMap.set(e.to, hMap.get(e.from) + e.weight);
    }
  }
  for (const e of edges) {
    if (hMap.get(e.from) + e.weight < hMap.get(e.to)) {
      r.done("Negative cycle detected — Johnson's algorithm cannot continue.");
      return { steps: r.steps, result: { negativeCycle: true, summary: "Negative cycle." } };
    }
  }
  r.info("Reweighting done: every edge is now non-negative.");

  const reweighted = { directed: true, nodes: g.nodes, edges: edges.map((e) => ({ from: e.from, to: e.to, weight: e.weight + hMap.get(e.from) - hMap.get(e.to) })) };
  const adj = buildAdjacency(reweighted);
  const matrix = {};

  for (const src of g.nodes) {
    r.active(src, `Dijkstra from ${src}.`);
    const dist = new Map(g.nodes.map((n) => [n, Infinity]));
    dist.set(src, 0);
    const done = new Set();
    const pq = createPQ();
    pq.push(src, 0);
    while (pq.size) {
      const { value: u } = pq.pop();
      if (done.has(u)) continue;
      done.add(u);
      r.visit(u, `${src} → ${u} settled.`);
      for (const { to, weight } of adj.get(u)) {
        const nd = dist.get(u) + weight;
        if (nd < dist.get(to)) { dist.set(to, nd); pq.push(to, nd); r.result(u, to, `Improve ${src} → ${to}.`); }
      }
    }
    matrix[src] = {};
    for (const n of g.nodes) {
      matrix[src][n] = dist.get(n) === Infinity ? null : dist.get(n) - hMap.get(src) + hMap.get(n);
    }
  }

  r.done("All-pairs shortest paths computed with Johnson's algorithm.");
  return { steps: r.steps, result: { matrix, summary: `All-pairs table for ${g.nodes.length} node(s).` } };
}

module.exports = { dijkstra, bellmanFord, floydWarshall, aStar, johnson };
