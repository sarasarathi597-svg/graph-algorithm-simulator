"use strict";

const { buildAdjacency, createRecorder, emptyGraphResult } = require("./util");

function kahn(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  if (!g.directed) r.info("Note: topological sorting needs a directed graph. Switch the graph to directed for a meaningful result.");

  const adj = buildAdjacency({ ...g, directed: true });
  const indeg = new Map(g.nodes.map((n) => [n, 0]));
  for (const e of g.edges) indeg.set(e.to, (indeg.get(e.to) || 0) + 1);

  r.info("Kahn's algorithm: repeatedly take a node with no incoming edges.");
  const queue = g.nodes.filter((n) => indeg.get(n) === 0);
  queue.forEach((n) => r.mark(n, "source", `${n} has in-degree 0.`));
  const order = [];

  while (queue.length) {
    const cur = queue.shift();
    order.push(cur);
    r.visit(cur, `Output ${cur} (position ${order.length}).`);
    for (const { to } of adj.get(cur)) {
      indeg.set(to, indeg.get(to) - 1);
      r.edge(cur, to, `Remove edge ${cur} → ${to}; in-degree of ${to} is now ${indeg.get(to)}.`);
      if (indeg.get(to) === 0) { queue.push(to); r.result(cur, to, `${to} is now free — enqueue it.`); }
    }
  }

  const hasCycle = order.length !== g.nodes.length;
  r.done(hasCycle ? "A cycle exists — no topological order." : `Topological order: ${order.join(" → ")}`);
  return { steps: r.steps, result: { order: hasCycle ? [] : order, hasCycle, summary: hasCycle ? "Cycle found." : order.join(" → ") } };
}

function dfsTopological(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  if (!g.directed) r.info("Note: topological sorting needs a directed graph.");

  const adj = buildAdjacency({ ...g, directed: true });
  const state = new Map(g.nodes.map((n) => [n, 0])); // 0 unvisited, 1 in stack, 2 done
  const order = [];
  let cycle = false;

  r.info("DFS-based topological sort: push a node onto the output only after all of its successors are done.");
  const walk = (node) => {
    state.set(node, 1);
    r.active(node, `Enter ${node}.`);
    for (const { to } of adj.get(node)) {
      r.edge(node, to, `Follow ${node} → ${to}.`);
      if (state.get(to) === 0) walk(to);
      else if (state.get(to) === 1) { cycle = true; r.reject(node, to, `Back edge ${node} → ${to}: cycle!`); }
    }
    state.set(node, 2);
    order.push(node);
    r.visit(node, `${node} finished — prepend it to the order.`);
  };
  for (const n of g.nodes) if (state.get(n) === 0) walk(n);

  order.reverse();
  r.done(cycle ? "A cycle exists — no valid topological order." : `Topological order: ${order.join(" → ")}`);
  return { steps: r.steps, result: { order: cycle ? [] : order, hasCycle: cycle, summary: cycle ? "Cycle found." : order.join(" → ") } };
}

module.exports = { kahn, dfsTopological };
