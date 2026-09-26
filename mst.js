"use strict";

const { buildAdjacency, createRecorder, createPQ, pickStart, emptyGraphResult } = require("./util");

class DSU {
  constructor(items) {
    this.parent = new Map(items.map((i) => [i, i]));
    this.rank = new Map(items.map((i) => [i, 0]));
  }
  find(x) {
    while (this.parent.get(x) !== x) {
      this.parent.set(x, this.parent.get(this.parent.get(x)));
      x = this.parent.get(x);
    }
    return x;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    const rka = this.rank.get(ra);
    const rkb = this.rank.get(rb);
    if (rka < rkb) this.parent.set(ra, rb);
    else if (rka > rkb) this.parent.set(rb, ra);
    else { this.parent.set(rb, ra); this.rank.set(ra, rka + 1); }
    return true;
  }
}

function prim(g, options) {
  const r = createRecorder();
  const start = pickStart(g, options);
  if (!start) return emptyGraphResult(r);
  const adj = buildAdjacency(g, { forceUndirected: true });
  const inTree = new Set([start]);
  const chosen = [];
  let total = 0;
  const pq = createPQ();

  r.info(`Prim from ${start}: grow one tree by always taking the cheapest edge leaving it.`);
  r.visit(start, `Start the tree at ${start}.`);
  for (const { to, weight } of adj.get(start)) pq.push({ from: start, to, weight }, weight);

  while (pq.size && inTree.size < g.nodes.length) {
    const { value: e } = pq.pop();
    r.edge(e.from, e.to, `Cheapest candidate: ${e.from} — ${e.to} (${e.weight}).`);
    if (inTree.has(e.to)) { r.reject(e.from, e.to, `${e.to} is already in the tree — would create a cycle.`); continue; }
    inTree.add(e.to);
    chosen.push(e);
    total += e.weight;
    r.visit(e.to, `Add ${e.to} to the tree.`);
    r.result(e.from, e.to, `Keep edge ${e.from} — ${e.to} (${e.weight}). Total ${total}.`);
    for (const { to, weight } of adj.get(e.to)) if (!inTree.has(to)) pq.push({ from: e.to, to, weight }, weight);
  }

  const connected = inTree.size === g.nodes.length;
  r.done(connected ? `MST weight: ${total}` : `Graph is disconnected — spanning tree of one component, weight ${total}.`);
  return { steps: r.steps, result: { edges: chosen, totalWeight: total, connected, summary: `Total weight ${total}.` } };
}

function kruskal(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  const sorted = g.edges.slice().sort((a, b) => a.weight - b.weight);
  const dsu = new DSU(g.nodes);
  const chosen = [];
  let total = 0;

  r.info("Kruskal: sort every edge by weight and keep the ones that do not close a cycle.");
  for (const e of sorted) {
    r.edge(e.from, e.to, `Consider ${e.from} — ${e.to} (${e.weight}).`);
    if (dsu.union(e.from, e.to)) {
      chosen.push(e);
      total += e.weight;
      r.visit(e.from, `${e.from} joins the forest.`);
      r.visit(e.to, `${e.to} joins the forest.`);
      r.result(e.from, e.to, `Keep it. Total ${total}.`);
    } else {
      r.reject(e.from, e.to, `Both ends already connected — dropping it.`);
    }
  }

  r.done(`MST weight: ${total} using ${chosen.length} edge(s).`);
  return { steps: r.steps, result: { edges: chosen, totalWeight: total, summary: `Total weight ${total}.` } };
}

function boruvka(g) {
  const r = createRecorder();
  if (!g.nodes.length) return emptyGraphResult(r);
  const dsu = new DSU(g.nodes);
  const chosen = [];
  let total = 0;
  let components = g.nodes.length;
  let round = 1;

  r.info("Borůvka: every component picks its own cheapest outgoing edge, then components merge.");
  while (components > 1) {
    r.info(`--- Round ${round++} ---`);
    const cheapest = new Map();
    for (const e of g.edges) {
      const a = dsu.find(e.from);
      const b = dsu.find(e.to);
      if (a === b) continue;
      r.edge(e.from, e.to, `Candidate ${e.from} — ${e.to} (${e.weight}).`);
      if (!cheapest.has(a) || e.weight < cheapest.get(a).weight) cheapest.set(a, e);
      if (!cheapest.has(b) || e.weight < cheapest.get(b).weight) cheapest.set(b, e);
    }
    if (cheapest.size === 0) { r.info("No edges left between components — the graph is disconnected."); break; }
    let merged = false;
    for (const e of cheapest.values()) {
      if (dsu.union(e.from, e.to)) {
        chosen.push(e);
        total += e.weight;
        components--;
        merged = true;
        r.visit(e.from, `${e.from} merged.`);
        r.visit(e.to, `${e.to} merged.`);
        r.result(e.from, e.to, `Keep ${e.from} — ${e.to} (${e.weight}). Total ${total}.`);
      }
    }
    if (!merged) break;
  }

  r.done(`Borůvka finished with weight ${total}.`);
  return { steps: r.steps, result: { edges: chosen, totalWeight: total, summary: `Total weight ${total}.` } };
}

module.exports = { prim, kruskal, boruvka, DSU };
