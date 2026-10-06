/**
 * Voice Assistant
 * Web Speech API + robust algorithm/command matching
 */

export class VoiceAssistant {
  constructor({ onCommand, onStatus }) {
    this.onCommand = onCommand || (() => {});
    this.onStatus = onStatus || (() => {});
    this.listening = false;
    this.recognition = null;

    const SR =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    this.supported = Boolean(SR);

    if (!this.supported) return;

    const rec = new SR();

    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 3;

    rec.onstart = () => {
      this.onStatus("🎤 Listening...");
    };

    rec.onresult = (event) => {
      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        if (!event.results[i].isFinal) continue;

        const result = event.results[i];

        // Try the best available transcript
        const text = result[0].transcript
          .trim()
          .toLowerCase();

        if (text) {
          console.log("🎤 Voice:", text);
          this.onCommand(text);
        }
      }
    };

    rec.onerror = (e) => {
      console.warn("Voice error:", e.error);

      if (e.error === "not-allowed") {
        this.onStatus(
          "❌ Microphone permission denied."
        );
      } else if (e.error === "no-speech") {
        this.onStatus(
          "🎤 No speech detected. Try again."
        );
      } else {
        this.onStatus(`Voice error: ${e.error}`);
      }
    };

    rec.onend = () => {
      if (this.listening) {
        setTimeout(() => {
          try {
            rec.start();
          } catch {
            // Already starting
          }
        }, 200);
      }
    };

    this.recognition = rec;
  }

  start() {
    if (!this.supported) {
      this.onStatus(
        "Voice recognition is not supported in this browser."
      );
      return false;
    }

    this.listening = true;

    try {
      this.recognition.start();
    } catch {
      // Already running
    }

    this.onStatus(
      '🎤 Listening... Try "run BFS", "add node A", "delete node A", "pause", or "reset graph".'
    );

    return true;
  }

  stop() {
    this.listening = false;

    try {
      if (this.recognition) {
        this.recognition.stop();
      }
    } catch {
      // Ignore
    }

    this.onStatus("🔇 Voice control off.");
  }

  toggle() {
    if (this.listening) {
      this.stop();
      return false;
    }

    return this.start();
  }

  speak(text) {
    if (!("speechSynthesis" in window) || !text) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(String(text));

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = "en-US";

    window.speechSynthesis.speak(utterance);
  }

  shutUp() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}


/**
 * Normalize speech text
 */
function normalizeSpeech(text) {
  if (!text) return "";

  let t = String(text)
    .toLowerCase()
    .trim();

  // Common speech-recognition punctuation
  t = t
    .replace(/[.,!?;:'"`]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Spoken letters
  t = t
    .replace(/\bb f s\b/g, "bfs")
    .replace(/\bd f s\b/g, "dfs")
    .replace(/\ba star\b/g, "astar")
    .replace(/\ba-star\b/g, "astar");

  return t;
}


/**
 * Algorithm aliases
 */
const ALIASES = {
  // BFS
  "breadth first search": "bfs",
  "breadth first": "bfs",
  "breadth search": "bfs",
  "breadth first algorithm": "bfs",
  "bfs": "bfs",

  // DFS
  "depth first search": "dfs",
  "depth first": "dfs",
  "depth search": "dfs",
  "depth first algorithm": "dfs",
  "dfs": "dfs",

  // IDDFS
  "iterative deepening": "iddfs",
  "iterative deepening dfs": "iddfs",
  "iterative deepening depth first search": "iddfs",
  "iddfs": "iddfs",

  // Bidirectional BFS
  "bidirectional bfs": "bidirectional-bfs",
  "bidirectional breadth first search": "bidirectional-bfs",
  "bidirectional search": "bidirectional-bfs",

  // Dijkstra
  "dijkstra": "dijkstra",
  "dijkstra's": "dijkstra",
  "dijkstras": "dijkstra",
  "dijkstra algorithm": "dijkstra",
  "dijkstra shortest path": "dijkstra",

  // Bellman Ford
  "bellman ford": "bellman-ford",
  "bellman": "bellman-ford",
  "bellman ford algorithm": "bellman-ford",

  // Floyd Warshall
  "floyd warshall": "floyd-warshall",
  "floyd": "floyd-warshall",
  "warshall": "floyd-warshall",
  "floyd warshall algorithm": "floyd-warshall",

  // A*
  "a star": "astar",
  "a star search": "astar",
  "astar": "astar",
  "a star algorithm": "astar",

  // Johnson
  "johnson": "johnson",
  "johnson algorithm": "johnson",

  // Prim
  "prim": "prim",
  "prims": "prim",
  "prim's": "prim",
  "prim algorithm": "prim",
  "minimum spanning tree prim": "prim",

  // Kruskal
  "kruskal": "kruskal",
  "kruskals": "kruskal",
  "kruskal's": "kruskal",
  "kruskal algorithm": "kruskal",

  // Boruvka
  "boruvka": "boruvka",
  "boruvkas": "boruvka",
  "boruvka algorithm": "boruvka",

  // Topological
  "topological sort": "kahn",
  "topological sorting": "kahn",
  "topological": "kahn",
  "kahn": "kahn",
  "kahn algorithm": "kahn",

  // Cycle
  "cycle detection": "dfs-cycle",
  "detect cycle": "dfs-cycle",
  "cycle": "dfs-cycle",

  // SCC
  "strongly connected components": "tarjan-scc",
  "strong connected components": "tarjan-scc",
  "scc": "tarjan-scc",
  "tarjan scc": "tarjan-scc",

  // Bridges
  "bridges": "tarjan-bridges",
  "bridge": "tarjan-bridges",
  "tarjan bridges": "tarjan-bridges",

  // Articulation
  "articulation point": "articulation-points",
  "articulation points": "articulation-points",
  "cut vertex": "articulation-points",

  // Flow
  "max flow": "edmonds-karp",
  "maximum flow": "edmonds-karp",
  "network flow": "edmonds-karp",
  "edmonds karp": "edmonds-karp",

  // Coloring
  "graph coloring": "graph-coloring",
  "graph colouring": "graph-coloring",
  "coloring": "graph-coloring",
  "colouring": "graph-coloring",

  // Union Find
  "union find": "union-find",
  "union find algorithm": "union-find",
  "disjoint set": "union-find",

  // Euler
  "euler": "hierholzer",
  "eulerian": "hierholzer",
  "eulerian path": "hierholzer",
  "eulerian circuit": "hierholzer",
  "hierholzer": "hierholzer",

  // Hamiltonian
  "hamiltonian": "hamiltonian",
  "hamiltonian path": "hamiltonian",
  "hamiltonian cycle": "hamiltonian"
};


/**
 * Convert an algorithm name/key into a normalized form
 */
function normalizeAlgorithmValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}


/**
 * Match spoken algorithm with available algorithms
 */
function matchAlgorithm(text, algorithms = []) {
  const t = normalizeSpeech(text);

  if (!t) return null;

  /*
   * 1. Check aliases first
   */
  const aliasKeys = Object.keys(ALIASES).sort(
    (a, b) => b.length - a.length
  );

  for (const phrase of aliasKeys) {
    if (t === phrase || t.includes(phrase)) {
      const key = ALIASES[phrase];

      // Verify against actual available algorithms
      const found = algorithms.find(
        (a) =>
          normalizeAlgorithmValue(a.key) ===
          normalizeAlgorithmValue(key)
      );

      if (found) {
        return found.key;
      }

      // If backend key is not available, still return alias
      return key;
    }
  }


  /*
   * 2. Exact algorithm key
   */
  for (const algorithm of algorithms) {
    const key = normalizeSpeech(algorithm.key);

    if (
      t === key ||
      t.includes(key)
    ) {
      return algorithm.key;
    }
  }


  /*
   * 3. Match algorithm display name
   */
  for (const algorithm of algorithms) {
    const name = normalizeSpeech(algorithm.name);

    if (!name) continue;

    if (
      t === name ||
      t.includes(name) ||
      name.includes(t)
    ) {
      return algorithm.key;
    }
  }


  /*
   * 4. Compact comparison
   * Example:
   * "bellman ford" -> "bellmanford"
   */
  const compactText = normalizeAlgorithmValue(t);

  for (const algorithm of algorithms) {
    const key = normalizeAlgorithmValue(
      algorithm.key
    );

    const name = normalizeAlgorithmValue(
      algorithm.name
    );

    if (
      compactText === key ||
      compactText === name ||
      compactText.includes(key) ||
      compactText.includes(name)
    ) {
      return algorithm.key;
    }
  }

  return null;
}


/**
 * Turns spoken phrase into app action.
 */
export function parseCommand(text, algorithmNames = []) {
  const t = normalizeSpeech(text);

  if (!t) return null;


  /*
   * ADD NODE
   *
   * "add node"
   * "add node A"
   * "create node B"
   * "new node C"
   */
  if (/^(add|create|new)\s+(a\s+)?node\b/.test(t)) {
    const m = t.match(
      /node\s+(?:called|named|labelled|labeled)\s+([a-z0-9]{1,3})$/
    );

    const simple = t.match(
      /node\s+([a-z0-9]{1,3})$/
    );

    const label =
      m?.[1] ||
      simple?.[1] ||
      "";

    return {
      action: "add-node",
      payload: {
        label: label.toUpperCase()
      }
    };
  }


  /*
   * DELETE NODE
   */
  if (/^(delete|remove)\s+(a\s+)?node\b/.test(t)) {
    const m = t.match(
      /node\s+([a-z0-9]{1,3})/
    );

    return {
      action: "delete-node",
      payload: {
        id: m ? m[1].toUpperCase() : ""
      }
    };
  }


  /*
   * ADD EDGE
   *
   * "add edge A to B"
   * "add edge from A to B"
   * "add edge A and B"
   * "add edge A to B weight 5"
   */
  if (/^(add|create)\s+(an\s+)?edge\b/.test(t)) {
    const m = t.match(
      /edge\s+(?:from\s+)?([a-z0-9]{1,3})\s+(?:to|and)\s+([a-z0-9]{1,3})(?:\s+weight\s+([0-9]+))?/
    );

    if (m) {
      return {
        action: "add-edge",
        payload: {
          from: m[1].toUpperCase(),
          to: m[2].toUpperCase(),
          weight: m[3]
            ? Number(m[3])
            : 1
        }
      };
    }
  }


  /*
   * DELETE EDGE
   */
  if (/^(delete|remove)\s+(an\s+)?edge\b/.test(t)) {
    const m = t.match(
      /edge\s+(?:from\s+)?([a-z0-9]{1,3})\s+(?:to|and)\s+([a-z0-9]{1,3})/
    );

    if (m) {
      return {
        action: "delete-edge",
        payload: {
          from: m[1].toUpperCase(),
          to: m[2].toUpperCase()
        }
      };
    }
  }


  /*
   * RESET
   */
  if (
    /^(reset|clear)\s+(the\s+)?graph/.test(t) ||
    t === "reset" ||
    t === "clear"
  ) {
    return {
      action: "reset"
    };
  }


  /*
   * RANDOM GRAPH
   */
  if (
    /^(random|generate|generate random)/.test(t)
  ) {
    return {
      action: "random"
    };
  }


  /*
   * SAMPLE GRAPH
   */
  if (
    /sample|example|demo graph|sample graph/.test(t)
  ) {
    return {
      action: "sample"
    };
  }


  /*
   * PAUSE
   */
  if (
    /^(pause|stop|hold|stop animation)/.test(t)
  ) {
    return {
      action: "pause"
    };
  }


  /*
   * RESUME
   */
  if (
    /^(resume|continue|play|start animation)/.test(t)
  ) {
    return {
      action: "resume"
    };
  }


  /*
   * STEP
   */
  if (
    /^(step|next|next step)/.test(t)
  ) {
    return {
      action: "step"
    };
  }


  /*
   * RESTART
   */
  if (
    /^(replay|restart|restart animation)/.test(t)
  ) {
    return {
      action: "restart"
    };
  }


  /*
   * EXPLAIN
   */
  if (
    /^(explain|explain this|explain algorithm)/.test(t)
  ) {
    return {
      action: "explain"
    };
  }


  /*
   * DIRECTED / UNDIRECTED
   */
  if (
    t.includes("directed") ||
    t.includes("undirected")
  ) {
    const value =
      !t.includes("undirected") &&
      !t.includes("not directed");

    return {
      action: "set-directed",
      payload: {
        value
      }
    };
  }


  /*
   * RUN ALGORITHM
   *
   * Examples:
   * run bfs
   * run breadth first search
   * start dijkstra
   * execute bellman ford algorithm
   * show a star
   */
  if (
    /^(run|start|execute|show|use|select)\b/.test(t)
  ) {
    let spoken = t
      .replace(
        /^(run|start|execute|show|use|select)\s*/,
        ""
      )
      .trim();

    spoken = spoken
      .replace(/\balgorithm\b/g, "")
      .replace(/\bsearch\b/g, "search")
      .trim();

    const key = matchAlgorithm(
      spoken,
      algorithmNames
    );

    if (key) {
      return {
        action: "run",
        payload: {
          key
        }
      };
    }

    return {
      action: "unknown-algorithm",
      payload: {
        spoken
      }
    };
  }


  /*
   * Direct algorithm command
   *
   * "bfs"
   * "dijkstra"
   * "breadth first search"
   */
  const key = matchAlgorithm(
    t,
    algorithmNames
  );

  if (key) {
    return {
      action: "run",
      payload: {
        key
      }
    };
  }


  return null;
}
