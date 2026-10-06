"use strict";

const { buildAdjacency, createRecorder, emptyGraphResult } = require("./util");

function kosaraju(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  const adj = buildAdjacency({ ...g, directed: true });
  const radj = buildAdjacency({ ...g, directed: true }, { reverse: true });

  r.info("Kosaraju: DFS to get a finishing order, then DFS on the reversed graph in that order.");
  const seen = new Set();
  const order = [];
  const walk1 = (n) => {
    seen.add(n);
    r.visit(n, `First pass: visit ${n}.`);
    for (const { to } of adj.get(n)) if (!seen.has(to)) { r.edge(n, to, `Follow ${n} → ${to}.`); walk1(to); }
    order.push(n);
    r.active(n, `${n} finished.`);
  };
  for (const n of g.nodes) if (!seen.has(n)) walk1(n);

  r.info("--- Second pass on the reversed graph ---");
  const comp = new Map();
  const components = [];
  const seen2 = new Set();
  const walk2 = (n, id) => {
    seen2.add(n);
    comp.set(n, id);
    components[id].push(n);
    r.mark(n, `comp-${id}`, `${n} belongs to component ${id + 1}.`);
    for (const { to } of radj.get(n)) if (!seen2.has(to)) { r.result(n, to, `${to} is in the same component.`); walk2(to, id); }
  };
  for (let i = order.length - 1; i >= 0; i--) {
    const n = order[i];
    if (seen2.has(n)) continue;
    components.push([]);
    walk2(n, components.length - 1);
  }

  r.done(`${components.length} strongly connected component(s).`);
  return { steps: r.steps, result: { components, summary: components.map((c, i) => `#${i + 1}: ${c.join(",")}`).join(" | ") } };
}

function tarjanSCC(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  const adj = buildAdjacency({ ...g, directed: true });
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const components = [];
  let counter = 0;

  r.info("Tarjan SCC: one DFS, tracking discovery index and the lowest reachable index.");
  const strongConnect = (v) => {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    r.visit(v, `Visit ${v} (index ${index.get(v)}).`);
    for (const { to } of adj.get(v)) {
      r.edge(v, to, `Check ${v} → ${to}.`);
      if (!index.has(to)) { strongConnect(to); low.set(v, Math.min(low.get(v), low.get(to))); }
      else if (onStack.has(to)) { low.set(v, Math.min(low.get(v), index.get(to))); r.reject(v, to, `${to} is on the stack — update low-link of ${v} to ${low.get(v)}.`); }
    }
    if (low.get(v) === index.get(v)) {
      const comp = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); comp.push(w); r.mark(w, `comp-${components.length}`, `${w} joins component ${components.length + 1}.`); } while (w !== v);
      components.push(comp);
    }
  };
  for (const n of g.nodes) if (!index.has(n)) strongConnect(n);

  r.done(`${components.length} strongly connected component(s).`);
  return { steps: r.steps, result: { components, summary: components.map((c, i) => `#${i + 1}: ${c.join(",")}`).join(" | ") } };
}

function bridges(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  const adj = buildAdjacency(g, { forceUndirected: true });
  const disc = new Map();
  const low = new Map();
  const found = [];
  let timer = 0;

  r.info("Tarjan bridges: an edge (u, v) is a bridge when nothing in v's subtree reaches back above u.");
  const walk = (u, parent) => {
    disc.set(u, timer);
    low.set(u, timer);
    timer++;
    r.visit(u, `Visit ${u} (disc ${disc.get(u)}).`);
    let skippedParent = false;
    for (const { to: v } of adj.get(u)) {
      if (v === parent && !skippedParent) { skippedParent = true; continue; }
      if (!disc.has(v)) {
        r.edge(u, v, `Tree edge ${u} — ${v}.`);
        walk(v, u);
        low.set(u, Math.min(low.get(u), low.get(v)));
        if (low.get(v) > disc.get(u)) { found.push([u, v]); r.result(u, v, `${u} — ${v} is a bridge!`); }
      } else {
        low.set(u, Math.min(low.get(u), disc.get(v)));
        r.reject(u, v, `Back edge ${u} — ${v}: low[${u}] = ${low.get(u)}.`);
      }
    }
  };
  for (const n of g.nodes) if (!disc.has(n)) walk(n, null);

  r.done(found.length ? `${found.length} bridge(s): ${found.map((b) => b.join("—")).join(", ")}` : "No bridges — the graph has no single point of edge failure.");
  return { steps: r.steps, result: { bridges: found, summary: found.length ? found.map((b) => b.join("—")).join(", ") : "No bridges." } };
}

function articulationPoints(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  const adj = buildAdjacency(g, { forceUndirected: true });
  const disc = new Map();
  const low = new Map();
  const points = new Set();
  let timer = 0;

  r.info("Articulation points: nodes whose removal would split the graph.");
  const walk = (u, parent) => {
    disc.set(u, timer);
    low.set(u, timer);
    timer++;
    let children = 0;
    r.visit(u, `Visit ${u}.`);
    for (const { to: v } of adj.get(u)) {
      if (v === parent) continue;
      if (!disc.has(v)) {
        children++;
        r.edge(u, v, `Tree edge ${u} — ${v}.`);
        walk(v, u);
        low.set(u, Math.min(low.get(u), low.get(v)));
        if (parent !== null && low.get(v) >= disc.get(u)) { points.add(u); r.mark(u, "goal", `${u} is an articulation point.`); }
      } else {
        low.set(u, Math.min(low.get(u), disc.get(v)));
        r.reject(u, v, `Back edge ${u} — ${v}.`);
      }
    }
    if (parent === null && children > 1) { points.add(u); r.mark(u, "goal", `Root ${u} has ${children} DFS children — articulation point.`); }
  };
  for (const n of g.nodes) if (!disc.has(n)) walk(n, null);

  const list = [...points];
  r.done(list.length ? `Articulation points: ${list.join(", ")}` : "No articulation points.");
  return { steps: r.steps, result: { articulationPoints: list, summary: list.length ? list.join(", ") : "None." } };
}

module.exports = { kosaraju, tarjanSCC, bridges, articulationPoints };
