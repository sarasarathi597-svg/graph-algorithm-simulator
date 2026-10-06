"use strict";

const { createRecorder, pickStart, pickEnd, emptyGraphResult } = require("./util");

/** Residual capacity map: Map<from, Map<to, capacity>> */
function buildResidual(g) {
  const cap = new Map(g.nodes.map((n) => [n, new Map()]));
  const ensure = (a, b) => { if (!cap.get(a).has(b)) cap.get(a).set(b, 0); };
  for (const e of g.edges) {
    ensure(e.from, e.to);
    ensure(e.to, e.from);
    cap.get(e.from).set(e.to, cap.get(e.from).get(e.to) + Math.max(0, e.weight));
    if (!g.directed) cap.get(e.to).set(e.from, cap.get(e.to).get(e.from) + Math.max(0, e.weight));
  }
  return cap;
}

function augmentAlongPath(cap, path, r) {
  let bottleneck = Infinity;
  for (let i = 0; i + 1 < path.length; i++) bottleneck = Math.min(bottleneck, cap.get(path[i]).get(path[i + 1]));
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    cap.get(a).set(b, cap.get(a).get(b) - bottleneck);
    cap.get(b).set(a, (cap.get(b).get(a) || 0) + bottleneck);
    r.result(a, b, `Push ${bottleneck} unit(s) along ${a} → ${b}.`);
  }
  return bottleneck;
}

function findPathDFS(cap, s, t) {
  const seen = new Set([s]);
  const path = [];
  const walk = (u) => {
    path.push(u);
    if (u === t) return true;
    for (const [v, c] of cap.get(u)) {
      if (c > 0 && !seen.has(v)) { seen.add(v); if (walk(v)) return true; }
    }
    path.pop();
    return false;
  };
  return walk(s) ? path : null;
}

function findPathBFS(cap, s, t) {
  const prev = new Map();
  const seen = new Set([s]);
  const q = [s];
  while (q.length) {
    const u = q.shift();
    for (const [v, c] of cap.get(u)) {
      if (c > 0 && !seen.has(v)) {
        seen.add(v);
        prev.set(v, u);
        if (v === t) {
          const path = [t];
          let cur = t;
          while (cur !== s) { cur = prev.get(cur); path.push(cur); }
          return path.reverse();
        }
        q.push(v);
      }
    }
  }
  return null;
}

function runFlow(g, options, mode) {
  const r = createRecorder();
  const source = pickStart(g, options);
  const sink = pickEnd(g, options);
  if (!source || source === sink) {
    r.info("Pick a source and a sink that are different nodes (Start / End in the sidebar).");
    r.done("Nothing to run.");
    return { steps: r.steps, result: { maxFlow: 0, summary: "Source and sink must differ." } };
  }
  const cap = buildResidual(g);
  const label = mode === "dfs" ? "Ford-Fulkerson (DFS augmenting paths)" : "Edmonds-Karp (shortest augmenting paths via BFS)";
  r.info(`${label}: source ${source}, sink ${sink}. Edge weight is the capacity.`);
  r.mark(source, "source", `Source: ${source}.`);
  r.mark(sink, "goal", `Sink: ${sink}.`);

  let flow = 0;
  let guard = 0;
  while (guard++ < 200) {
    const path = mode === "dfs" ? findPathDFS(cap, source, sink) : findPathBFS(cap, source, sink);
    if (!path) { r.info("No augmenting path left in the residual graph."); break; }
    path.forEach((n) => r.visit(n, `Augmenting path passes ${n}.`));
    const added = augmentAlongPath(cap, path, r);
    flow += added;
    r.info(`Augmenting path ${path.join(" → ")} adds ${added}. Total flow: ${flow}.`);
  }

  r.done(`Maximum flow from ${source} to ${sink}: ${flow}.`);
  return { steps: r.steps, result: { maxFlow: flow, source, sink, summary: `Max flow ${flow}.` } };
}

function fordFulkerson(g, options) { return runFlow(g, options, "dfs"); }
function edmondsKarp(g, options) { return runFlow(g, options, "bfs"); }

function dinic(g, options) {
  const r = createRecorder();
  const source = pickStart(g, options);
  const sink = pickEnd(g, options);
  if (!g.nodes.length) return emptyGraphResult(r);
  if (!source || source === sink) {
    r.info("Pick a source and a sink that are different nodes.");
    r.done("Nothing to run.");
    return { steps: r.steps, result: { maxFlow: 0, summary: "Source and sink must differ." } };
  }
  const cap = buildResidual(g);
  r.info(`Dinic: build a level graph with BFS, then push blocking flows with DFS. Source ${source}, sink ${sink}.`);
  r.mark(source, "source", `Source: ${source}.`);
  r.mark(sink, "goal", `Sink: ${sink}.`);

  let flow = 0;
  let phase = 1;
  while (phase < 100) {
    // BFS levels
    const level = new Map([[source, 0]]);
    const q = [source];
    while (q.length) {
      const u = q.shift();
      for (const [v, c] of cap.get(u)) if (c > 0 && !level.has(v)) { level.set(v, level.get(u) + 1); r.visit(v, `Level ${level.get(v)}: ${v}.`); q.push(v); }
    }
    if (!level.has(sink)) { r.info("The sink is no longer reachable — Dinic stops."); break; }
    r.info(`--- Phase ${phase++}: level graph built, sink at level ${level.get(sink)} ---`);

    const dfs = (u, pushed) => {
      if (u === sink) return pushed;
      for (const [v, c] of cap.get(u)) {
        if (c <= 0 || level.get(v) !== level.get(u) + 1) continue;
        const got = dfs(v, Math.min(pushed, c));
        if (got > 0) {
          cap.get(u).set(v, c - got);
          cap.get(v).set(u, (cap.get(v).get(u) || 0) + got);
          r.result(u, v, `Push ${got} along ${u} → ${v}.`);
          return got;
        }
      }
      return 0;
    };

    let pushed;
    while ((pushed = dfs(source, Infinity)) > 0) {
      flow += pushed;
      r.info(`Blocking-flow push of ${pushed}. Total ${flow}.`);
    }
  }

  r.done(`Maximum flow from ${source} to ${sink}: ${flow}.`);
  return { steps: r.steps, result: { maxFlow: flow, source, sink, summary: `Max flow ${flow}.` } };
}

module.exports = { fordFulkerson, edmondsKarp, dinic };
