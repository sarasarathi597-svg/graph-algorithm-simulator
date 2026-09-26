"use strict";

const { buildAdjacency, createRecorder, pickStart, emptyGraphResult } = require("./util");
const { DSU } = require("./mst");

function unionFind(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  const dsu = new DSU(g.nodes);
  r.info("Union-Find / DSU: merge the sets of every edge, then read off the connected components.");
  for (const e of g.edges) {
    r.edge(e.from, e.to, `Union(${e.from}, ${e.to}).`);
    if (dsu.union(e.from, e.to)) r.result(e.from, e.to, `Sets merged; root is now ${dsu.find(e.from)}.`);
    else r.reject(e.from, e.to, `Already in the same set (root ${dsu.find(e.from)}).`);
  }
  const groups = new Map();
  for (const n of g.nodes) {
    const root = dsu.find(n);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(n);
  }
  const components = [...groups.values()];
  components.forEach((c, i) => c.forEach((n) => r.mark(n, `comp-${i}`, `${n} is in component ${i + 1}.`)));
  r.done(`${components.length} connected component(s).`);
  return { steps: r.steps, result: { components, summary: components.map((c, i) => `#${i + 1}: ${c.join(",")}`).join(" | ") } };
}

function graphColoring(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  const adj = buildAdjacency(g, { forceUndirected: true });
  const color = new Map();
  r.info("Greedy graph colouring: give each node the smallest colour none of its neighbours uses.");
  for (const n of g.nodes) {
    const used = new Set();
    for (const { to } of adj.get(n)) {
      if (color.has(to)) { used.add(color.get(to)); r.edge(n, to, `Neighbour ${to} uses colour ${color.get(to) + 1}.`); }
    }
    let c = 0;
    while (used.has(c)) c++;
    color.set(n, c);
    r.mark(n, `color-${c}`, `${n} gets colour ${c + 1}.`);
    r.visit(n, `${n} coloured ${c + 1}.`);
  }
  const total = new Set(color.values()).size;
  r.done(`Used ${total} colour(s).`);
  return { steps: r.steps, result: { colors: Object.fromEntries([...color].map(([k, v]) => [k, v + 1])), colorsUsed: total, summary: `${total} colour(s).` } };
}

function bipartite(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  const adj = buildAdjacency(g, { forceUndirected: true });
  const side = new Map();
  let ok = true;
  r.info("Bipartite check: 2-colour the graph with BFS. A conflict means an odd cycle exists.");
  for (const start of g.nodes) {
    if (side.has(start)) continue;
    side.set(start, 0);
    r.mark(start, "color-0", `${start} goes to side A.`);
    const q = [start];
    while (q.length) {
      const u = q.shift();
      for (const { to } of adj.get(u)) {
        r.edge(u, to, `Check ${u} — ${to}.`);
        if (!side.has(to)) {
          side.set(to, 1 - side.get(u));
          r.mark(to, `color-${side.get(to)}`, `${to} goes to side ${side.get(to) === 0 ? "A" : "B"}.`);
          q.push(to);
        } else if (side.get(to) === side.get(u)) {
          ok = false;
          r.reject(u, to, `${u} and ${to} are on the same side — not bipartite.`);
        }
      }
    }
  }
  r.done(ok ? "The graph is bipartite." : "The graph is NOT bipartite (it contains an odd cycle).");
  return {
    steps: r.steps,
    result: {
      bipartite: ok,
      sideA: [...side].filter(([, v]) => v === 0).map(([k]) => k),
      sideB: [...side].filter(([, v]) => v === 1).map(([k]) => k),
      summary: ok ? "Bipartite." : "Not bipartite.",
    },
  };
}

function hierholzer(g, options) {
  const r = createRecorder();
  if (!g.nodes.length || !g.edges.length) return emptyGraphResult(r, "Add some edges before looking for an Eulerian trail.");
  r.info("Hierholzer: walk edges until stuck, then splice in detours. Finds an Eulerian circuit or trail.");

  const remaining = new Map(g.nodes.map((n) => [n, []]));
  g.edges.forEach((e, i) => {
    remaining.get(e.from).push({ to: e.to, id: i });
    if (!g.directed) remaining.get(e.to).push({ to: e.from, id: i });
  });
  const used = new Set();

  let start = pickStart(g, options);
  if (g.directed) {
    const out = new Map(g.nodes.map((n) => [n, remaining.get(n).length]));
    const inn = new Map(g.nodes.map((n) => [n, 0]));
    for (const e of g.edges) inn.set(e.to, inn.get(e.to) + 1);
    const odd = g.nodes.filter((n) => out.get(n) - inn.get(n) === 1);
    if (odd.length) start = odd[0];
    const bad = g.nodes.filter((n) => Math.abs(out.get(n) - inn.get(n)) > 1);
    if (bad.length) r.info(`Degrees are unbalanced at ${bad.join(", ")} — a full Eulerian trail may not exist.`);
  } else {
    const odd = g.nodes.filter((n) => remaining.get(n).length % 2 === 1);
    if (odd.length === 2) { start = odd[0]; r.info(`Two odd-degree nodes (${odd.join(", ")}) — starting at ${start} for an Eulerian trail.`); }
    else if (odd.length > 2) r.info(`${odd.length} odd-degree nodes — no Eulerian trail exists; showing the best partial walk.`);
    else r.info("Every degree is even — an Eulerian circuit should exist.");
  }

  const stack = [start];
  const circuit = [];
  while (stack.length) {
    const v = stack[stack.length - 1];
    const list = remaining.get(v).filter((x) => !used.has(x.id));
    if (list.length) {
      const e = list[0];
      used.add(e.id);
      r.edge(v, e.to, `Walk edge ${v} → ${e.to}.`);
      stack.push(e.to);
      r.visit(e.to, `Now at ${e.to}.`);
    } else {
      circuit.push(stack.pop());
      r.active(v, `Stuck at ${v} — add it to the trail.`);
    }
  }
  circuit.reverse();
  for (let i = 0; i + 1 < circuit.length; i++) r.result(circuit[i], circuit[i + 1], `Trail edge ${circuit[i]} → ${circuit[i + 1]}.`);

  const complete = used.size === g.edges.length;
  r.done(complete ? `Eulerian trail: ${circuit.join(" → ")}` : `Only ${used.size}/${g.edges.length} edges could be used — no Eulerian trail.`);
  return { steps: r.steps, result: { trail: circuit, complete, summary: complete ? circuit.join(" → ") : "No Eulerian trail." } };
}

function hamiltonianPath(g, options) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  if (g.nodes.length > 12) {
    r.info("This is a backtracking search — keep the graph at 12 nodes or fewer for a quick answer.");
  }
  const adj = buildAdjacency(g);
  const wanted = options && options.start && g.nodes.includes(String(options.start)) ? [String(options.start)] : g.nodes;
  r.info("Hamiltonian path: backtracking search for a path that visits every node exactly once.");

  let solution = null;
  const visited = new Set();
  const path = [];

  const walk = (u) => {
    visited.add(u);
    path.push(u);
    r.visit(u, `Try ${u} (path: ${path.join(" → ")}).`);
    if (path.length === g.nodes.length) { solution = path.slice(); return true; }
    for (const { to } of adj.get(u)) {
      if (visited.has(to)) continue;
      r.edge(u, to, `Extend with ${u} → ${to}.`);
      if (walk(to)) return true;
    }
    visited.delete(u);
    path.pop();
    r.active(u, `Dead end — backtrack from ${u}.`);
    return false;
  };

  for (const s of wanted) { visited.clear(); path.length = 0; if (walk(s)) break; }

  if (solution) for (let i = 0; i + 1 < solution.length; i++) r.result(solution[i], solution[i + 1], `Hamiltonian edge ${solution[i]} → ${solution[i + 1]}.`);
  r.done(solution ? `Hamiltonian path: ${solution.join(" → ")}` : "No Hamiltonian path exists in this graph.");
  return { steps: r.steps, result: { path: solution || [], found: Boolean(solution), summary: solution ? solution.join(" → ") : "Not found." } };
}

module.exports = { unionFind, graphColoring, bipartite, hierholzer, hamiltonianPath };
