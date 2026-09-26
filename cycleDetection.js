"use strict";

const { buildAdjacency, createRecorder, emptyGraphResult } = require("./util");
const { DSU } = require("./mst");

function dfsCycle(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  const adj = buildAdjacency(g);
  const state = new Map(g.nodes.map((n) => [n, 0]));
  let cycleEdge = null;

  r.info(g.directed
    ? "DFS cycle detection (directed): a cycle exists if we meet a node that is still on the recursion stack."
    : "DFS cycle detection (undirected): a cycle exists if we reach a visited node that is not our parent.");

  const walk = (node, parent) => {
    state.set(node, 1);
    r.visit(node, `Visit ${node}.`);
    for (const { to } of adj.get(node)) {
      if (!g.directed && to === parent) continue;
      r.edge(node, to, `Check ${node} → ${to}.`);
      if (state.get(to) === 0) walk(to, node);
      else if (state.get(to) === 1 && !cycleEdge) {
        cycleEdge = [node, to];
        r.reject(node, to, `Cycle found on edge ${node} → ${to}.`);
      }
    }
    state.set(node, 2);
    r.active(node, `Leave ${node}.`);
  };

  for (const n of g.nodes) if (state.get(n) === 0) walk(n, null);

  r.done(cycleEdge ? `Cycle detected at edge ${cycleEdge[0]} → ${cycleEdge[1]}.` : "No cycle: this graph is acyclic.");
  return { steps: r.steps, result: { hasCycle: Boolean(cycleEdge), cycleEdge, summary: cycleEdge ? "Cycle detected." : "Acyclic." } };
}

function unionFindCycle(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  if (g.directed) r.info("Note: Union-Find cycle detection is meant for undirected graphs; edges are treated as undirected here.");
  const dsu = new DSU(g.nodes);
  let found = null;

  r.info("Union-Find: add edges one by one; if both ends already share a root, that edge closes a cycle.");
  for (const e of g.edges) {
    r.edge(e.from, e.to, `Add edge ${e.from} — ${e.to}.`);
    if (!dsu.union(e.from, e.to)) {
      found = [e.from, e.to];
      r.reject(e.from, e.to, `${e.from} and ${e.to} are already connected — cycle!`);
      break;
    }
    r.result(e.from, e.to, `Merged the sets of ${e.from} and ${e.to}.`);
    r.visit(e.from, `${e.from} in set ${dsu.find(e.from)}.`);
    r.visit(e.to, `${e.to} in set ${dsu.find(e.to)}.`);
  }

  r.done(found ? `Cycle detected at ${found[0]} — ${found[1]}.` : "No cycle found.");
  return { steps: r.steps, result: { hasCycle: Boolean(found), cycleEdge: found, summary: found ? "Cycle detected." : "Acyclic." } };
}

/**
 * Floyd's tortoise & hare. Works on a functional graph: each node follows its
 * first outgoing edge, exactly like a linked list `next` pointer.
 */
function floydCycle(g, options) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  const adj = buildAdjacency({ ...g, directed: true });
  const next = (n) => {
    const list = adj.get(n) || [];
    return list.length ? list[0].to : null;
  };
  const start = options && options.start && g.nodes.includes(String(options.start)) ? String(options.start) : g.nodes[0];

  r.info("Floyd's tortoise & hare: follow each node's first outgoing edge like a linked list. Slow moves 1 step, fast moves 2.");
  let slow = start;
  let fast = start;
  let meeting = null;
  let guard = 0;

  while (guard++ < g.nodes.length * 4) {
    slow = next(slow);
    const f1 = next(fast);
    fast = f1 ? next(f1) : null;
    if (!slow || !fast) { r.info("A pointer ran off the end — the chain terminates, so there is no loop."); break; }
    r.visit(slow, `Slow pointer at ${slow}.`);
    r.mark(fast, "goal", `Fast pointer at ${fast}.`);
    if (slow === fast) { meeting = slow; r.mark(slow, "source", `The pointers met at ${slow} — a loop exists.`); break; }
  }

  let entry = null;
  if (meeting) {
    let a = start;
    let b = meeting;
    let g2 = 0;
    while (a !== b && g2++ < g.nodes.length * 2) { a = next(a); b = next(b); }
    entry = a;
    r.mark(entry, "goal", `Loop starts at ${entry}.`);
  }

  r.done(meeting ? `Loop detected, entry node ${entry}.` : "No loop in this chain.");
  return { steps: r.steps, result: { hasCycle: Boolean(meeting), entry, summary: meeting ? `Loop entry ${entry}.` : "No loop." } };
}

module.exports = { dfsCycle, unionFindCycle, floydCycle };
