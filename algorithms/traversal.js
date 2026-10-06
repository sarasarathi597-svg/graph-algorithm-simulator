"use strict";

const {
  buildAdjacency,
  createRecorder,
  pickStart,
  pickEnd,
  emptyGraphResult,
  rebuildPath,
} = require("./util");

function bfs(g, options) {
  const r = createRecorder();
  const start = pickStart(g, options);
  if (!start) return emptyGraphResult(r);
  const adj = buildAdjacency(g);
  const visited = new Set([start]);
  const order = [];
  const queue = [start];

  r.info(`BFS from ${start}: explore level by level using a queue.`);
  r.visit(start, `Start at ${start} and put it in the queue.`);

  while (queue.length) {
    const cur = queue.shift();
    order.push(cur);
    r.active(cur, `Dequeue ${cur} and look at its neighbours.`);
    for (const { to } of adj.get(cur)) {
      r.edge(cur, to, `Check edge ${cur} → ${to}.`);
      if (!visited.has(to)) {
        visited.add(to);
        queue.push(to);
        r.visit(to, `${to} is new — enqueue it.`);
        r.result(cur, to, `${cur} → ${to} belongs to the BFS tree.`);
      } else {
        r.reject(cur, to, `${to} is already visited — skip.`);
      }
    }
  }

  r.done(`BFS order: ${order.join(" → ")}`);
  return { steps: r.steps, result: { visited: order, summary: `Visited ${order.length} node(s).` } };
}

function dfs(g, options) {
  const r = createRecorder();
  const start = pickStart(g, options);
  if (!start) return emptyGraphResult(r);
  const adj = buildAdjacency(g);
  const visited = new Set();
  const order = [];

  r.info(`DFS from ${start}: go as deep as possible before backtracking.`);

  (function walk(node, parent) {
    visited.add(node);
    order.push(node);
    if (parent) r.result(parent, node, `${parent} → ${node} is a tree edge.`);
    r.visit(node, `Visit ${node}.`);
    for (const { to } of adj.get(node)) {
      r.edge(node, to, `Check edge ${node} → ${to}.`);
      if (!visited.has(to)) walk(to, node);
      else r.reject(node, to, `${to} already visited — backtrack.`);
    }
    r.active(node, `Finished ${node}, backtracking.`);
  })(start, null);

  r.done(`DFS order: ${order.join(" → ")}`);
  return { steps: r.steps, result: { visited: order, summary: `Visited ${order.length} node(s).` } };
}

function dls(g, options) {
  const r = createRecorder();
  const start = pickStart(g, options);
  if (!start) return emptyGraphResult(r);
  const limit = Number.isFinite(Number(options && options.limit)) ? Number(options.limit) : 2;
  const adj = buildAdjacency(g);
  const order = [];
  const visited = new Set();

  r.info(`Depth-Limited Search from ${start} with depth limit ${limit}.`);
  (function walk(node, depth, parent) {
    visited.add(node);
    order.push(node);
    if (parent) r.result(parent, node, `${parent} → ${node} (depth ${depth}).`);
    r.visit(node, `Visit ${node} at depth ${depth}.`);
    if (depth >= limit) {
      r.active(node, `Depth limit ${limit} reached at ${node} — stop going deeper.`);
      return;
    }
    for (const { to } of adj.get(node)) {
      if (!visited.has(to)) walk(to, depth + 1, node);
    }
  })(start, 0, null);

  r.done(`Reached ${order.length} node(s) within depth ${limit}.`);
  return { steps: r.steps, result: { visited: order, limit, summary: `Depth limit ${limit}.` } };
}

function iddfs(g, options) {
  const r = createRecorder();
  const start = pickStart(g, options);
  if (!start) return emptyGraphResult(r);
  const target = pickEnd(g, options);
  const maxDepth = Number.isFinite(Number(options && options.limit))
    ? Number(options.limit)
    : Math.max(1, g.nodes.length - 1);
  const adj = buildAdjacency(g);
  let found = null;
  const allVisited = [];

  r.info(`IDDFS from ${start} looking for ${target}: repeated DFS with growing depth.`);

  for (let depth = 0; depth <= maxDepth && !found; depth++) {
    r.info(`--- Iteration with depth limit ${depth} ---`);
    const visited = new Set();
    (function walk(node, d, parent) {
      if (found) return;
      visited.add(node);
      allVisited.push(node);
      if (parent) r.result(parent, node, `${parent} → ${node}.`);
      r.visit(node, `Depth ${d}: visit ${node}.`);
      if (node === target) {
        found = { depth: d };
        r.mark(node, "goal", `Found target ${node} at depth ${d}.`);
        return;
      }
      if (d >= depth) return;
      for (const { to } of adj.get(node)) {
        if (!visited.has(to)) walk(to, d + 1, node);
      }
    })(start, 0, null);
  }

  r.done(found ? `Target ${target} found at depth ${found.depth}.` : `Target ${target} not reachable.`);
  return {
    steps: r.steps,
    result: { target, found: Boolean(found), depth: found ? found.depth : null, summary: found ? `Found at depth ${found.depth}.` : "Not found." },
  };
}

function bidirectionalBFS(g, options) {
  const r = createRecorder();
  const start = pickStart(g, options);
  const end = pickEnd(g, options);
  if (!start) return emptyGraphResult(r);
  const adj = buildAdjacency(g, { forceUndirected: true });

  r.info(`Bidirectional BFS: search from ${start} and ${end} at the same time.`);
  if (start === end) {
    r.done("Start and goal are the same node.");
    return { steps: r.steps, result: { path: [start], summary: "Trivial path." } };
  }

  const prevF = new Map();
  const prevB = new Map();
  const visF = new Set([start]);
  const visB = new Set([end]);
  let qF = [start];
  let qB = [end];
  r.mark(start, "source", `Forward frontier starts at ${start}.`);
  r.mark(end, "goal", `Backward frontier starts at ${end}.`);
  let meet = null;

  while (qF.length && qB.length && !meet) {
    const nextF = [];
    for (const cur of qF) {
      for (const { to } of adj.get(cur)) {
        if (visF.has(to)) continue;
        visF.add(to);
        prevF.set(to, cur);
        nextF.push(to);
        r.visit(to, `Forward search reaches ${to}.`);
        r.result(cur, to, `Forward tree edge ${cur} → ${to}.`);
        if (visB.has(to)) { meet = to; break; }
      }
      if (meet) break;
    }
    qF = nextF;
    if (meet) break;

    const nextB = [];
    for (const cur of qB) {
      for (const { to } of adj.get(cur)) {
        if (visB.has(to)) continue;
        visB.add(to);
        prevB.set(to, cur);
        nextB.push(to);
        r.visit(to, `Backward search reaches ${to}.`);
        r.result(cur, to, `Backward tree edge ${cur} → ${to}.`);
        if (visF.has(to)) { meet = to; break; }
      }
      if (meet) break;
    }
    qB = nextB;
  }

  let path = [];
  if (meet) {
    const left = rebuildPath(prevF, start, meet);
    const right = rebuildPath(prevB, end, meet).reverse();
    path = left.concat(right.slice(1));
    r.mark(meet, "goal", `The two frontiers met at ${meet}.`);
    for (let i = 0; i + 1 < path.length; i++) r.result(path[i], path[i + 1], `Path edge ${path[i]} → ${path[i + 1]}.`);
  }

  r.done(path.length ? `Path: ${path.join(" → ")}` : `${end} is not reachable from ${start}.`);
  return { steps: r.steps, result: { path, summary: path.length ? `Path length ${path.length - 1}.` : "No path." } };
}

module.exports = { bfs, dfs, dls, iddfs, bidirectionalBFS };
