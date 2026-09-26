/**
 * Voice assistant: Web Speech API for recognition (commands) and synthesis
 * (spoken explanations). Everything degrades gracefully when the browser has
 * no support — the buttons keep working.
 */
export class VoiceAssistant {
  constructor({ onCommand, onStatus }) {
    this.onCommand = onCommand || (() => {});
    this.onStatus = onStatus || (() => {});
    this.listening = false;
    this.recognition = null;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = Boolean(SR);
    if (!this.supported) return;

    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        const text = event.results[i][0].transcript.trim().toLowerCase();
        if (text) this.onCommand(text);
      }
    };
    rec.onerror = (e) => this.onStatus(`Voice error: ${e.error}`);
    rec.onend = () => { if (this.listening) { try { rec.start(); } catch { /* already starting */ } } };
    this.recognition = rec;
  }

  start() {
    if (!this.supported) { this.onStatus("Voice recognition is not supported in this browser — use the buttons."); return false; }
    this.listening = true;
    try { this.recognition.start(); } catch { /* already running */ }
    this.onStatus("Listening… try “run bfs”, “add node”, “pause”, “reset graph”.");
    return true;
  }

  stop() {
    this.listening = false;
    try { this.recognition && this.recognition.stop(); } catch { /* ignore */ }
    this.onStatus("Voice control off.");
  }

  toggle() {
    if (this.listening) { this.stop(); return false; }
    return this.start();
  }

  speak(text) {
    if (!("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(String(text));
    utter.rate = 1;
    utter.pitch = 1;
    utter.lang = "en-US";
    window.speechSynthesis.speak(utter);
  }

  shutUp() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
}

/**
 * Turns a spoken phrase into an app action.
 * Returns { action, payload } or null when nothing matched.
 */
export function parseCommand(text, algorithmNames) {
  const t = text.replace(/[^a-z0-9*\s-]/g, " ").replace(/\s+/g, " ").trim();

  if (/^(add|create|new) (a )?node/.test(t)) {
    const m = t.match(/node (?:called |named |labelled |labeled )?([a-z0-9]{1,3})$/);
    return { action: "add-node", payload: { label: m ? m[1].toUpperCase() : "" } };
  }
  if (/^(delete|remove) (a )?node/.test(t)) {
    const m = t.match(/node ([a-z0-9]{1,3})/);
    return { action: "delete-node", payload: { id: m ? m[1].toUpperCase() : "" } };
  }
  if (/^(add|create) (an )?edge/.test(t)) {
    const m = t.match(/edge (?:from )?([a-z0-9]{1,3})(?: to| and)? ([a-z0-9]{1,3})(?: weight ([0-9]+))?/);
    if (m) return { action: "add-edge", payload: { from: m[1].toUpperCase(), to: m[2].toUpperCase(), weight: m[3] ? Number(m[3]) : 1 } };
  }
  if (/^(delete|remove) (an )?edge/.test(t)) {
    const m = t.match(/edge (?:from )?([a-z0-9]{1,3})(?: to| and)? ([a-z0-9]{1,3})/);
    if (m) return { action: "delete-edge", payload: { from: m[1].toUpperCase(), to: m[2].toUpperCase() } };
  }
  if (/^(reset|clear) (the )?graph/.test(t)) return { action: "reset" };
  if (/^(random|generate)/.test(t)) return { action: "random" };
  if (/sample|example|demo graph/.test(t)) return { action: "sample" };
  if (/^(pause|stop|hold)/.test(t)) return { action: "pause" };
  if (/^(resume|continue|play)/.test(t)) return { action: "resume" };
  if (/^(step|next)/.test(t)) return { action: "step" };
  if (/^(replay|restart)/.test(t)) return { action: "restart" };
  if (/explain/.test(t)) return { action: "explain" };
  if (/directed/.test(t)) return { action: "set-directed", payload: { value: !/undirected|not directed/.test(t) } };

  if (/^(run|start|execute|show)/.test(t)) {
    const spoken = t.replace(/^(run|start|execute|show)\s*/, "").replace(/\balgorithm\b/g, "").trim();
    const key = matchAlgorithm(spoken, algorithmNames);
    if (key) return { action: "run", payload: { key } };
    return { action: "unknown-algorithm", payload: { spoken } };
  }

  const key = matchAlgorithm(t, algorithmNames);
  if (key) return { action: "run", payload: { key } };
  return null;
}

const ALIASES = {
  "breadth first search": "bfs",
  "breadth first": "bfs",
  "b f s": "bfs",
  "depth first search": "dfs",
  "depth first": "dfs",
  "d f s": "dfs",
  "a star": "astar",
  "a-star": "astar",
  "shortest path": "dijkstra",
  dijkstras: "dijkstra",
  "bellman ford": "bellman-ford",
  "floyd warshall": "floyd-warshall",
  "minimum spanning tree": "kruskal",
  prims: "prim",
  kruskals: "kruskal",
  "topological sort": "kahn",
  "cycle detection": "dfs-cycle",
  "strongly connected components": "tarjan-scc",
  bridges: "tarjan-bridges",
  "articulation point": "articulation-points",
  "max flow": "edmonds-karp",
  "maximum flow": "edmonds-karp",
  coloring: "graph-coloring",
  colouring: "graph-coloring",
  "union find": "union-find",
  euler: "hierholzer",
  eulerian: "hierholzer",
  hamiltonian: "hamiltonian",
};

function matchAlgorithm(text, algorithms) {
  if (!text) return null;
  for (const [phrase, key] of Object.entries(ALIASES)) {
    if (text.includes(phrase)) return key;
  }
  let best = null;
  for (const a of algorithms) {
    const name = a.name.toLowerCase();
    if (text === a.key || text.includes(a.key)) return a.key;
    const plain = name.replace(/[^a-z0-9 ]/g, " ").trim();
    if (text.includes(plain) || plain.includes(text)) best = best || a.key;
  }
  return best;
}
