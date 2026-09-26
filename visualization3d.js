import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const COLORS = {
  idle: 0x5b6b93,
  visited: 0x6ee7ff,
  active: 0xfbbf24,
  result: 0x34d399,
  reject: 0xfb7185,
  source: 0xa78bfa,
  goal: 0xf472b6,
};

const PALETTE = [0x6ee7ff, 0xa78bfa, 0x34d399, 0xfbbf24, 0xfb7185, 0xf472b6, 0x60a5fa, 0xfdba74, 0x4ade80, 0xe879f9];

function stateColor(state) {
  if (!state) return COLORS.idle;
  if (state.startsWith("color-") || state.startsWith("comp-")) {
    const n = parseInt(state.split("-")[1], 10) || 0;
    return PALETTE[n % PALETTE.length];
  }
  return COLORS[state] ?? COLORS.idle;
}

function labelSprite(text) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 62px Segoe UI, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 10;
  ctx.fillText(String(text).slice(0, 4), size / 2, size / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(1.8, 1.8, 1);
  return sprite;
}

export class Visualizer {
  constructor(container, graph) {
    this.container = container;
    this.graph = graph;
    this.nodeMeshes = new Map();
    this.edgeObjects = new Map();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a12);
    this.scene.fog = new THREE.FogExp2(0x070a12, 0.012);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
    this.camera.position.set(0, 8, 26);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 120;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xbfd6ff, 1.1);
    key.position.set(12, 18, 14);
    this.scene.add(key);
    const rim = new THREE.PointLight(0xa78bfa, 90, 120);
    rim.position.set(-18, -10, -12);
    this.scene.add(rim);

    const grid = new THREE.GridHelper(80, 40, 0x1d2b4d, 0x121a2e);
    grid.position.y = -12;
    this.scene.add(grid);

    this.nodeGeometry = new THREE.SphereGeometry(1, 32, 24);
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.animate = this.animate.bind(this);
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(this.animate);
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  edgeKey(from, to) {
    return this.graph.directed ? `${from}->${to}` : [from, to].sort().join("--");
  }

  /** Rebuild the scene from the current graph model. */
  sync() {
    for (const [id, mesh] of this.nodeMeshes) {
      if (!this.graph.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose?.();
        mesh.material.dispose?.();
        this.nodeMeshes.delete(id);
      }
    }
    for (const node of this.graph.nodes) {
      let mesh = this.nodeMeshes.get(node.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          this.nodeGeometry,
          new THREE.MeshStandardMaterial({ color: COLORS.idle, emissive: 0x0a1226, roughness: 0.35, metalness: 0.25 })
        );
        mesh.userData.nodeId = node.id;
        const label = labelSprite(node.id);
        label.position.set(0, 1.9, 0);
        mesh.add(label);
        this.group.add(mesh);
        this.nodeMeshes.set(node.id, mesh);
      }
      mesh.position.set(node.x, node.y, node.z);
    }

    for (const [key, obj] of this.edgeObjects) {
      this.group.remove(obj.root);
      obj.dispose();
      this.edgeObjects.delete(key);
    }
    for (const edge of this.graph.edges) {
      const a = this.nodeMeshes.get(edge.from);
      const b = this.nodeMeshes.get(edge.to);
      if (!a || !b) continue;
      this.edgeObjects.set(this.edgeKey(edge.from, edge.to), this.createEdge(a.position, b.position, edge));
    }
    this.resetStates();
  }

  createEdge(p1, p2, edge) {
    const root = new THREE.Group();
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const length = dir.length() || 0.001;
    const material = new THREE.MeshStandardMaterial({ color: COLORS.idle, emissive: 0x000000, roughness: 0.6 });
    const geometry = new THREE.CylinderGeometry(0.07, 0.07, length, 8, 1);
    const tube = new THREE.Mesh(geometry, material);
    tube.position.copy(p1).add(p2).multiplyScalar(0.5);
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    root.add(tube);

    let head = null;
    if (this.graph.directed) {
      head = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 12), material);
      const back = dir.clone().normalize().multiplyScalar(1.4);
      head.position.copy(p2).sub(back);
      head.quaternion.copy(tube.quaternion);
      root.add(head);
    }

    const label = labelSprite(String(edge.weight));
    label.scale.set(1.2, 1.2, 1);
    label.position.copy(p1).add(p2).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.8, 0));
    root.add(label);

    this.group.add(root);
    return {
      root,
      material,
      dispose() {
        geometry.dispose();
        material.dispose();
        head?.geometry.dispose();
        label.material.map?.dispose();
        label.material.dispose();
      },
    };
  }

  setNodeState(id, state) {
    const mesh = this.nodeMeshes.get(id);
    if (!mesh) return;
    const color = stateColor(state);
    mesh.material.color.setHex(color);
    mesh.material.emissive.setHex(state && state !== "idle" ? color : 0x0a1226);
    mesh.material.emissiveIntensity = state && state !== "idle" ? 0.55 : 0.2;
    mesh.scale.setScalar(state === "active" ? 1.35 : 1);
  }

  setEdgeState(from, to, state) {
    const obj = this.edgeObjects.get(this.edgeKey(from, to)) || this.edgeObjects.get(this.edgeKey(to, from));
    if (!obj) return;
    const color = stateColor(state);
    obj.material.color.setHex(color);
    obj.material.emissive.setHex(state && state !== "idle" ? color : 0x000000);
    obj.material.emissiveIntensity = state && state !== "idle" ? 0.6 : 0;
  }

  resetStates() {
    for (const id of this.nodeMeshes.keys()) this.setNodeState(id, "idle");
    for (const [key] of this.edgeObjects) {
      const [from, to] = key.includes("->") ? key.split("->") : key.split("--");
      this.setEdgeState(from, to, "idle");
    }
  }

  frameAll() {
    this.controls.target.set(0, 0, 0);
    const radius = 8 + this.graph.nodes.length * 0.9;
    this.camera.position.set(radius * 0.4, radius * 0.45, radius * 1.4);
    this.controls.update();
  }

  animate() {
    const t = this.clock.getElapsedTime();
    for (const mesh of this.nodeMeshes.values()) {
      mesh.rotation.y = t * 0.25;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
