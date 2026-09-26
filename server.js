"use strict";

const path = require("path");
const express = require("express");
const { listAlgorithms, runAlgorithm } = require("./algorithms");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

/** In-memory graph store — no database is used. */
let currentGraph = { directed: false, nodes: [], edges: [] };

app.get("/api/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get("/api/algorithms", (req, res) => {
  res.json({ categories: listAlgorithms() });
});

app.get("/api/graph", (req, res) => {
  res.json({ graph: currentGraph });
});

app.post("/api/graph", (req, res) => {
  const g = req.body && req.body.graph;
  if (!g || typeof g !== "object") return res.status(400).json({ error: "Body must be { graph: { nodes, edges, directed } }" });
  currentGraph = {
    directed: Boolean(g.directed),
    nodes: Array.isArray(g.nodes) ? g.nodes : [],
    edges: Array.isArray(g.edges) ? g.edges : [],
  };
  res.json({ ok: true, graph: currentGraph });
});

app.post("/api/run", (req, res) => {
  try {
    const { algorithm, graph, options } = req.body || {};
    if (!algorithm) return res.status(400).json({ error: "Missing 'algorithm'." });
    const useGraph = graph && Array.isArray(graph.nodes) ? graph : currentGraph;
    const payload = runAlgorithm(algorithm, useGraph, options);
    res.json(payload);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message || "Algorithm failed." });
  }
});

// Keep API failures machine-readable instead of returning the frontend HTML.
app.use("/api", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

// Browser navigation falls back to the single page app. Other methods should
// not silently receive HTML for a route that does not exist.
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"), (err) => {
    if (err) next(err);
  });
});

// express.json reports malformed or oversized requests through this handler.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Internal server error." : err.message });
});

app.listen(PORT, () => {
  console.log(`Graph Algorithm Simulator running at http://localhost:${PORT}`);
});
