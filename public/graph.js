/**
 * In-memory graph model. No database — everything lives here in the browser
 * and is sent to the Express API when an algorithm runs.
 */
export class GraphModel {
  constructor() {
    this.nodes = []; // { id, x, y, z }
    this.edges = []; // { from, to, weight }
    this.directed = false;
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this);
  }

  get ids() {
    return this.nodes.map((n) => n.id);
  }

  has(id) {
    return this.nodes.some((n) => n.id === id);
  }

  nextLabel() {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let round = 0; round < 10; round++) {
      for (const ch of alphabet) {
        const label = round === 0 ? ch : ch + round;
        if (!this.has(label)) return label;
      }
    }
    return `N${this.nodes.length + 1}`;
  }

  /** Spread nodes on a sphere so the 3D scene never looks flat. */
  positionFor(index, total) {
    const count = Math.max(total, 1);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const y = count === 1 ? 0 : 1 - (index / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * index;
    const R = 6 + Math.min(count, 24) * 0.22;
    return { x: Math.cos(theta) * radius * R, y: y * R * 0.7, z: Math.sin(theta) * radius * R };
  }

  relayout() {
    const total = this.nodes.length;
    this.nodes.forEach((n, i) => Object.assign(n, this.positionFor(i, total)));
  }

  addNode(label) {
    const id = (label || "").trim() || this.nextLabel();
    if (this.has(id)) return { ok: false, message: `Node ${id} already exists.` };
    this.nodes.push({ id, x: 0, y: 0, z: 0 });
    this.relayout();
    this.emit();
    return { ok: true, id, message: `Added node ${id}.` };
  }

  deleteNode(id) {
    if (!this.has(id)) return { ok: false, message: `No node called ${id}.` };
    this.nodes = this.nodes.filter((n) => n.id !== id);
    this.edges = this.edges.filter((e) => e.from !== id && e.to !== id);
    this.relayout();
    this.emit();
    return { ok: true, message: `Deleted node ${id} and its edges.` };
  }

  findEdge(from, to) {
    return this.edges.find(
      (e) => (e.from === from && e.to === to) || (!this.directed && e.from === to && e.to === from)
    );
  }

  addEdge(from, to, weight) {
    if (!this.has(from) || !this.has(to)) return { ok: false, message: "Both nodes must exist." };
    if (from === to) return { ok: false, message: "Self loops are not supported." };
    if (this.findEdge(from, to)) return { ok: false, message: `Edge ${from} → ${to} already exists.` };
    const w = Number.isFinite(Number(weight)) ? Number(weight) : 1;
    this.edges.push({ from, to, weight: w });
    this.emit();
    return { ok: true, message: `Added edge ${from} → ${to} (weight ${w}).` };
  }

  deleteEdge(from, to) {
    const edge = this.findEdge(from, to);
    if (!edge) return { ok: false, message: `No edge between ${from} and ${to}.` };
    this.edges = this.edges.filter((e) => e !== edge);
    this.emit();
    return { ok: true, message: `Deleted edge ${from} — ${to}.` };
  }

  setDirected(flag) {
    this.directed = Boolean(flag);
    this.emit();
  }

  clear() {
    this.nodes = [];
    this.edges = [];
    this.emit();
    return { ok: true, message: "Graph cleared." };
  }

  load({ nodes = [], edges = [], directed = false }) {
    this.nodes = nodes.map((n) => ({ id: String(n.id ?? n), x: 0, y: 0, z: 0 }));
    this.edges = edges
      .filter((e) => this.has(String(e.from)) && this.has(String(e.to)))
      .map((e) => ({ from: String(e.from), to: String(e.to), weight: Number(e.weight) || 1 }));
    this.directed = Boolean(directed);
    this.relayout();
    this.emit();
  }

  sample() {
    this.load({
      directed: false,
      nodes: ["A", "B", "C", "D", "E", "F", "G"].map((id) => ({ id })),
      edges: [
        { from: "A", to: "B", weight: 4 },
        { from: "A", to: "C", weight: 2 },
        { from: "B", to: "C", weight: 5 },
        { from: "B", to: "D", weight: 10 },
        { from: "C", to: "E", weight: 3 },
        { from: "E", to: "D", weight: 4 },
        { from: "D", to: "F", weight: 11 },
        { from: "E", to: "F", weight: 8 },
        { from: "F", to: "G", weight: 2 },
        { from: "C", to: "G", weight: 9 },
      ],
    });
    return { ok: true, message: "Loaded the sample graph (7 nodes, 10 edges)." };
  }

  random(nodeCount = 7) {
    const count = Math.max(2, Math.min(14, Math.round(nodeCount)));
    const ids = Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
    const edges = [];
    for (let i = 1; i < count; i++) {
      const j = Math.floor(Math.random() * i);
      edges.push({ from: ids[j], to: ids[i], weight: 1 + Math.floor(Math.random() * 9) });
    }
    const extra = Math.max(1, Math.round(count * 0.6));
    for (let k = 0; k < extra; k++) {
      const a = ids[Math.floor(Math.random() * count)];
      const b = ids[Math.floor(Math.random() * count)];
      if (a === b || edges.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a))) continue;
      edges.push({ from: a, to: b, weight: 1 + Math.floor(Math.random() * 9) });
    }
    this.load({ directed: this.directed, nodes: ids.map((id) => ({ id })), edges });
    return { ok: true, message: `Random graph with ${count} nodes and ${edges.length} edges.` };
  }

  toJSON() {
    return {
      directed: this.directed,
      nodes: this.nodes.map((n) => ({ id: n.id })),
      edges: this.edges.map((e) => ({ from: e.from, to: e.to, weight: e.weight })),
    };
  }

  positions() {
    const out = {};
    for (const n of this.nodes) out[n.id] = { x: n.x, y: n.y, z: n.z };
    return out;
  }
}
