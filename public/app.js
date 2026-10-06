import { GraphModel } from "./graph.js";
import { Visualizer } from "./visualization3d.js";
import { VoiceAssistant, parseCommand } from "./voice.js";
import { els, setStatus, setResult, setProgress, refreshNodeSelects, populateAlgorithms, toggleSidebar } from "./controls.js";

const graph = new GraphModel();
let viz = null;
let algorithms = [];      // flat list { key, name, explanation }
let run = null;           // { steps, index, timer, playing, explanation, name }
let speed = 1;

/* ---------------- boot ---------------- */

async function boot() {
  graph.sample();
  try {
    viz = new Visualizer(els.canvasWrap, graph);
    viz.sync();
    viz.frameAll();
    els.loading.remove();
  } catch (err) {
    els.loading.textContent = "3D scene could not start: " + err.message;
    console.error(err);
  }

  graph.onChange(() => {
    refreshNodeSelects(graph);
    viz?.sync();
  });
  refreshNodeSelects(graph);

  try {
    const res = await fetch("/api/algorithms");
    const data = await res.json();
    populateAlgorithms(data.categories);
    algorithms = data.categories.flatMap((c) => c.algorithms);
    showExplanation();
  } catch (err) {
    setStatus("Could not load the algorithm list — is the server running? (npm start)");
    console.error(err);
  }

  wireUI();
  setStatus("Ready. Sample graph loaded — pick an algorithm and press Run.");
}

function currentAlgorithm() {
  return algorithms.find((a) => a.key === els.algoSelect.value) || null;
}

function showExplanation() {
  const algo = currentAlgorithm();
  els.algoExplanation.textContent = algo ? algo.explanation : "Pick an algorithm to see what it does.";
}

/* ---------------- running ---------------- */

async function runAlgorithm(key) {
  if (key) els.algoSelect.value = key;
  const algo = currentAlgorithm();
  if (!algo) return;
  if (!graph.nodes.length) { setStatus("Add at least one node first."); return; }

  stopPlayback();
  viz?.resetStates();
  setStatus(`Running ${algo.name}…`);

  const body = {
    algorithm: algo.key,
    graph: graph.toJSON(),
    options: {
      start: els.startNode.value || undefined,
      end: els.endNode.value || undefined,
      limit: Number(els.depthLimit.value),
      positions: graph.positions(),
    },
  };

  let data;
  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
  } catch (err) {
    setStatus(`Could not run the algorithm: ${err.message}`);
    return;
  }

  run = { steps: data.steps, index: 0, playing: true, timer: null, name: data.name, explanation: data.explanation };
  setResult(`${data.name} — ${data.category}\n\n${JSON.stringify(data.result, null, 2)}`);
  els.btnPause.textContent = "⏸ Pause";
  tick();
}

function applyStep(step) {
  if (!step) return;
  if (step.type === "visit") viz?.setNodeState(step.node, "visited");
  else if (step.type === "active") viz?.setNodeState(step.node, "active");
  else if (step.type === "mark") viz?.setNodeState(step.node, step.color);
  else if (step.type === "edge") {
    const [a, b] = step.edge;
    viz?.setEdgeState(a, b, step.kind === "result" ? "result" : step.kind === "reject" ? "reject" : "active");
  }
  if (step.message) setStatus(step.message);
}

function tick() {
  if (!run) return;
  if (run.index >= run.steps.length) {
    run.playing = false;
    setProgress(1);
    els.btnPause.textContent = "▶ Resume";
    return;
  }
  applyStep(run.steps[run.index]);
  run.index++;
  setProgress(run.index / Math.max(run.steps.length, 1));
  if (run.playing) run.timer = setTimeout(tick, Math.max(90, 650 / speed));
}

function stopPlayback() {
  if (run && run.timer) clearTimeout(run.timer);
  if (run) run.playing = false;
  setProgress(0);
}

function pause() {
  if (!run) return;
  run.playing = false;
  if (run.timer) clearTimeout(run.timer);
  els.btnPause.textContent = "▶ Resume";
  setStatus("Paused.");
}

function resume() {
  if (!run || run.index >= run.steps.length) return;
  run.playing = true;
  els.btnPause.textContent = "⏸ Pause";
  tick();
}

function stepOnce() {
  if (!run) return;
  run.playing = false;
  if (run.timer) clearTimeout(run.timer);
  els.btnPause.textContent = "▶ Resume";
  if (run.index >= run.steps.length) { setStatus("End of the animation — press Replay."); return; }
  applyStep(run.steps[run.index]);
  run.index++;
  setProgress(run.index / Math.max(run.steps.length, 1));
}

function replay() {
  if (!run) { runAlgorithm(); return; }
  stopPlayback();
  viz?.resetStates();
  run.index = 0;
  run.playing = true;
  els.btnPause.textContent = "⏸ Pause";
  tick();
}

/* ---------------- voice ---------------- */

const voice = new VoiceAssistant({
  onCommand: handleVoiceCommand,
  onStatus: setStatus,
});

function handleVoiceCommand(text) {
  const parsed = parseCommand(text, algorithms);
  if (!parsed) { setStatus(`Heard “${text}” — no matching command.`); return; }
  setStatus(`Heard “${text}”.`);
  switch (parsed.action) {
    case "add-node": report(graph.addNode(parsed.payload.label)); break;
    case "delete-node": report(graph.deleteNode(parsed.payload.id || els.nodeTarget.value)); break;
    case "add-edge": report(graph.addEdge(parsed.payload.from, parsed.payload.to, parsed.payload.weight)); break;
    case "delete-edge": report(graph.deleteEdge(parsed.payload.from, parsed.payload.to)); break;
    case "reset": report(graph.clear()); break;
    case "sample": report(graph.sample()); viz?.frameAll(); break;
    case "random": report(graph.random(7)); viz?.frameAll(); break;
    case "set-directed": graph.setDirected(parsed.payload.value); voice.speak(parsed.payload.value ? "Directed graph." : "Undirected graph."); break;
    case "pause": pause(); voice.speak("Paused."); break;
    case "resume": resume(); break;
    case "step": stepOnce(); break;
    case "restart": replay(); break;
    case "explain": explain(); break;
    case "run": runAlgorithm(parsed.payload.key).then(() => voice.speak(`Running ${currentAlgorithm()?.name || "algorithm"}.`)); break;
    case "unknown-algorithm": voice.speak(`I could not find an algorithm called ${parsed.payload.spoken}.`); break;
    default: break;
  }
}

function report(outcome) {
  setStatus(outcome.message);
  voice.speak(outcome.message);
}

function explain() {
  const algo = currentAlgorithm();
  if (!algo) return;
  setStatus(`Explaining ${algo.name}.`);
  voice.speak(`${algo.name}. ${algo.explanation}`);
}

/* ---------------- UI wiring ---------------- */

function wireUI() {
  els.algoSelect.addEventListener("change", showExplanation);
  els.btnExplain.addEventListener("click", explain);
  els.btnRun.addEventListener("click", () => runAlgorithm());
  els.btnPause.addEventListener("click", () => (run && run.playing ? pause() : resume()));
  els.btnStep.addEventListener("click", stepOnce);
  els.btnRestart.addEventListener("click", replay);
  els.speed.addEventListener("input", () => {
    speed = Number(els.speed.value) || 1;
    els.speedOut.textContent = `${speed.toFixed(2)}×`;
  });

  els.btnAddNode.addEventListener("click", () => {
    const outcome = graph.addNode(els.nodeLabel.value.toUpperCase());
    els.nodeLabel.value = "";
    setStatus(outcome.message);
  });
  els.nodeLabel.addEventListener("keydown", (e) => { if (e.key === "Enter") els.btnAddNode.click(); });
  els.btnDelNode.addEventListener("click", () => setStatus(graph.deleteNode(els.nodeTarget.value).message));
  els.btnAddEdge.addEventListener("click", () =>
    setStatus(graph.addEdge(els.edgeFrom.value, els.edgeTo.value, els.edgeWeight.value).message)
  );
  els.btnDelEdge.addEventListener("click", () => setStatus(graph.deleteEdge(els.edgeFrom.value, els.edgeTo.value).message));
  els.directed.addEventListener("change", () => graph.setDirected(els.directed.checked));
  els.btnSample.addEventListener("click", () => { setStatus(graph.sample().message); viz?.frameAll(); });
  els.btnRandom.addEventListener("click", () => { setStatus(graph.random(2 + Math.floor(Math.random() * 7)).message); viz?.frameAll(); });
  els.btnReset.addEventListener("click", () => {
    stopPlayback();
    run = null;
    setResult("Run an algorithm to see its output here.");
    setStatus(graph.clear().message);
  });

  els.btnVoice.addEventListener("click", () => {
    const on = voice.toggle();
    els.btnVoice.setAttribute("aria-pressed", String(Boolean(on)));
    els.btnVoice.textContent = on ? "🎙 Voice on" : "🎙 Voice off";
  });
  els.btnMenu.addEventListener("click", () => toggleSidebar());

  window.addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
    if (e.key === " ") { e.preventDefault(); run && run.playing ? pause() : resume(); }
    if (e.key === "ArrowRight") stepOnce();
    if (e.key.toLowerCase() === "r") replay();
  });

  // Keep the server's in-memory copy of the graph up to date.
  graph.onChange(() => {
    fetch("/api/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ graph: graph.toJSON() }),
    }).catch(() => {});
  });
}

boot();
