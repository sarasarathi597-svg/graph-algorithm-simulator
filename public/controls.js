/** DOM lookups and small UI helpers shared by app.js. */
export const els = {
  algoSelect: document.getElementById("algo-select"),
  algoExplanation: document.getElementById("algo-explanation"),
  btnExplain: document.getElementById("btn-explain"),
  btnRun: document.getElementById("btn-run"),
  btnPause: document.getElementById("btn-pause"),
  btnStep: document.getElementById("btn-step"),
  btnRestart: document.getElementById("btn-restart"),
  speed: document.getElementById("speed"),
  speedOut: document.getElementById("speed-out"),

  nodeLabel: document.getElementById("node-label"),
  btnAddNode: document.getElementById("btn-add-node"),
  edgeFrom: document.getElementById("edge-from"),
  edgeTo: document.getElementById("edge-to"),
  edgeArrow: document.getElementById("edge-arrow"),
  edgeWeight: document.getElementById("edge-weight"),
  btnAddEdge: document.getElementById("btn-add-edge"),
  btnDelEdge: document.getElementById("btn-del-edge"),
  nodeTarget: document.getElementById("node-target"),
  btnDelNode: document.getElementById("btn-del-node"),
  directed: document.getElementById("directed"),
  btnSample: document.getElementById("btn-sample"),
  btnRandom: document.getElementById("btn-random"),
  btnReset: document.getElementById("btn-reset"),

  startNode: document.getElementById("start-node"),
  endNode: document.getElementById("end-node"),
  depthLimit: document.getElementById("depth-limit"),

  resultBox: document.getElementById("result-box"),
  status: document.getElementById("status"),
  progressFill: document.getElementById("progress-fill"),
  canvasWrap: document.getElementById("canvas-wrap"),
  loading: document.getElementById("loading"),
  legendHost: document.querySelector(".legend"),

  btnVoice: document.getElementById("btn-voice"),
  btnMenu: document.getElementById("btn-menu"),
  sidebar: document.getElementById("sidebar"),
};

export function setStatus(message) {
  els.status.textContent = message;
}

export function setResult(value) {
  els.resultBox.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export function setProgress(ratio) {
  els.progressFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
}

/** Keeps every node dropdown in sync with the graph, preserving selections. */
export function refreshNodeSelects(graph) {
  const ids = graph.ids;
  for (const select of [els.edgeFrom, els.edgeTo, els.nodeTarget, els.startNode, els.endNode]) {
    const previous = select.value;
    select.innerHTML = "";
    for (const id of ids) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = id;
      select.appendChild(option);
    }
    if (ids.includes(previous)) select.value = previous;
  }
  if (ids.length > 1) {
    if (els.edgeFrom.value === els.edgeTo.value) els.edgeTo.value = ids[ids.length - 1];
    if (els.startNode.value === els.endNode.value) els.endNode.value = ids[ids.length - 1];
  }
  els.edgeArrow.textContent = graph.directed ? "→" : "—";
  els.directed.checked = graph.directed;
}

export function populateAlgorithms(categories) {
  els.algoSelect.innerHTML = "";
  for (const group of categories) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.category;
    for (const algo of group.algorithms) {
      const option = document.createElement("option");
      option.value = algo.key;
      option.textContent = algo.name;
      optgroup.appendChild(option);
    }
    els.algoSelect.appendChild(optgroup);
  }
}

export function toggleSidebar(force) {
  const open = force ?? !els.sidebar.classList.contains("open");
  els.sidebar.classList.toggle("open", open);
  els.btnMenu.setAttribute("aria-expanded", String(open));
}
