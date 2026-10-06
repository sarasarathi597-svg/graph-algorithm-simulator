"use strict";

/**
 * Shared helpers for every algorithm module.
 *
 * Graph shape sent by the frontend:
 * {
 *   directed: boolean,
 *   nodes: [{ id: "A" }, ...],
 *   edges: [{ from: "A", to: "B", weight: 3 }, ...]
 * }
 */

function normalizeGraph(graph) {
  const g = graph && typeof graph === "object" ? graph : {};
  const directed = Boolean(g.directed);

  const nodes = [];
  const seen = new Set();
  for (const n of Array.isArray(g.nodes) ? g.nodes : []) {
    const id = String(typeof n === "object" && n !== null ? n.id : n);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    nodes.push(id);
  }

  const edges = [];
  for (const e of Array.isArray(g.edges) ? g.edges : []) {
    if (!e || typeof e !== "object") continue;
    const from = String(e.from);
    const to = String(e.to);
    if (!seen.has(from) || !seen.has(to)) continue;
    const weight = Number.isFinite(Number(e.weight)) ? Number(e.weight) : 1;
    edges.push({ from, to, weight });
  }

  return { directed, nodes, edges };
}

/** adjacency: Map<id, [{ to, weight }]> */
function buildAdjacency(g, { forceUndirected = false, reverse = false } = {}) {
  const adj = new Map();
  for (const n of g.nodes) adj.set(n, []);
  for (const e of g.edges) {
    const a = reverse ? e.to : e.from;
    const b = reverse ? e.from : e.to;
    adj.get(a).push({ to: b, weight: e.weight });
    if (forceUndirected || !g.directed) {
      adj.get(b).push({ to: a, weight: e.weight });
    }
  }
  for (const list of adj.values()) list.sort((x, y) => (x.to < y.to ? -1 : x.to > y.to ? 1 : 0));
  return adj;
}

/** Recorder that collects animation steps for the frontend. */
function createRecorder() {
  const steps = [];
  return {
    steps,
    info(message) {
      steps.push({ type: "info", message: String(message) });
    },
    visit(node, message) {
      steps.push({ type: "visit", node: String(node), message: String(message || `Visit ${node}`) });
    },
    active(node, message) {
      steps.push({ type: "active", node: String(node), message: String(message || `Processing ${node}`) });
    },
    edge(from, to, message, kind) {
      steps.push({
        type: "edge",
        edge: [String(from), String(to)],
        kind: kind || "explore",
        message: String(message || `Edge ${from} → ${to}`),
      });
    },
    result(from, to, message) {
      steps.push({
        type: "edge",
        edge: [String(from), String(to)],
        kind: "result",
        message: String(message || `Keep edge ${from} → ${to}`),
      });
    },
    reject(from, to, message) {
      steps.push({
        type: "edge",
        edge: [String(from), String(to)],
        kind: "reject",
        message: String(message || `Reject edge ${from} → ${to}`),
      });
    },
    mark(node, color, message) {
      steps.push({ type: "mark", node: String(node), color: String(color), message: String(message || "") });
    },
    done(message) {
      steps.push({ type: "done", message: String(message || "Finished") });
    },
  };
}

function pickStart(g, options) {
  const wanted = options && options.start != null ? String(options.start) : null;
  if (wanted && g.nodes.includes(wanted)) return wanted;
  return g.nodes[0] || null;
}

function pickEnd(g, options) {
  const wanted = options && options.end != null ? String(options.end) : null;
  if (wanted && g.nodes.includes(wanted)) return wanted;
  return g.nodes[g.nodes.length - 1] || null;
}

/** Simple binary-heap-free priority queue (fine for teaching-size graphs). */
function createPQ() {
  const items = [];
  return {
    push(value, priority) {
      items.push({ value, priority });
    },
    pop() {
      if (items.length === 0) return null;
      let best = 0;
      for (let i = 1; i < items.length; i++) {
        if (items[i].priority < items[best].priority) best = i;
      }
      return items.splice(best, 1)[0];
    },
    get size() {
      return items.length;
    },
  };
}

function rebuildPath(prev, start, end) {
  if (start === end) return [start];
  if (!prev.has(end)) return [];
  const path = [end];
  let cur = end;
  const guard = new Set([end]);
  while (cur !== start) {
    cur = prev.get(cur);
    if (cur == null || guard.has(cur)) return [];
    guard.add(cur);
    path.push(cur);
  }
  return path.reverse();
}

function emptyGraphResult(recorder, message) {
  recorder.info(message || "The graph is empty — add some nodes first.");
  recorder.done("Nothing to run.");
  return { steps: recorder.steps, result: { summary: message || "Empty graph" } };
}

module.exports = {
  normalizeGraph,
  buildAdjacency,
  createRecorder,
  createPQ,
  pickStart,
  pickEnd,
  rebuildPath,
  emptyGraphResult,
};
