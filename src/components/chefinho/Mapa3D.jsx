import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RotateCcw, Box, Eye } from "lucide-react";

/* Componente de visualização 3D do layout de produção (ChefMapLayout + ChefAsset) */
export default function Mapa3D({ items = [], assets = [], equipment = [], areas = [] }) {
  const mountRef = useRef(null);
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Inicializa cena/câmera/renderer uma única vez
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = readBgColor();
    scene.fog = new THREE.Fog(readBgColor(1), 220, 520);

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 2000);
    camera.position.set(120, 110, 150);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight || 400);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.borderRadius = "0.5rem";
    renderer.domElement.style.display = "block";

    // Luzes
    const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2f3a, 0.85);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(80, 140, 60);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -200; dir.shadow.camera.right = 200;
    dir.shadow.camera.top = 200; dir.shadow.camera.bottom = -200;
    dir.shadow.camera.near = 10; dir.shadow.camera.far = 400;
    scene.add(dir);

    // Chão
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ color: readFloorColor(), roughness: 0.95, metalness: 0.0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grade
    const grid = new THREE.GridHelper(600, 60, hslToken("--border", 0x3b4254), hslToken("--border", 0x22262e));
    grid.position.y = 0;
    (grid.material).opacity = 0.55; (grid.material).transparent = true;
    scene.add(grid);

    // Eixos discretos
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 40; controls.maxDistance = 480;

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    let raf;
    const animate = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(animate); };
    animate();

    const onResize = () => {
      if (!mount || !renderer || !camera) return;
      const w = mount.clientWidth, h = mount.clientHeight || 400;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);
    setReady(true);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      // limpa geometrias/materiais
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.()); else o.material.dispose?.(); }
      });
    };
  }, []);

  // Reconstroi os objetos toda vez que os dados mudam
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !ready) return;

    // Remove grupo de conteúdo anterior
    const existing = scene.getObjectByName("content");
    if (existing) {
      scene.remove(existing);
      existing.traverse(o => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) { if (o.material.map) o.material.map.dispose?.(); if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.()); else o.material.dispose?.(); }
      });
    }
    const content = new THREE.Group();
    content.name = "content";

    const SCALE = 0.25; // px (layout) -> unidades 3D
    const toX = (px) => (px || 0) * SCALE;
    const toZ = (px) => (px || 0) * SCALE;

    // Centraliza em torno do centróide dos itens
    const pts = items.map(m => ({ x: m.pos_x || 0, z: m.pos_y || 0 }));
    const cx = pts.length ? pts.reduce((s, p) => s + p.x, 0) / pts.length : 0;
    const cz = pts.length ? pts.reduce((s, p) => s + p.z, 0) / pts.length : 0;
    const ox = toX(cx), oz = toZ(cz);

    // 1) Áreas (planos no chão)
    items.filter(m => m.element_type === "area").forEach(m => {
      const w = (m.width || 120) * SCALE;
      const h = (m.height || 100) * SCALE;
      const mat = new THREE.MeshStandardMaterial({ color: m.color || "#3b82f6", transparent: true, opacity: 0.22, roughness: 0.9 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, h), mat);
      mesh.position.set(toX(m.pos_x || 0) - ox, 0.05, toZ(m.pos_y || 0) - oz);
      mesh.receiveShadow = true;
      content.add(mesh);
      // borda
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: m.color || "#3b82f6" }));
      edges.position.copy(mesh.position);
      content.add(edges);
      content.add(makeLabel(m.name, mesh.position.x, 0.6, mesh.position.z, 1.4));
    });

    // 2) Faixas / corredores / limites / separadores (barras finas)
    items.filter(m => ["faixa","corredor","limite","separador"].includes(m.element_type)).forEach(m => {
      const len = (m.length || 120) * SCALE;
      const th = (m.thickness || 6) * SCALE;
      const geo = m.orientation === "vertical" ? new THREE.BoxGeometry(th, 1.2, len) : new THREE.BoxGeometry(len, 1.2, th);
      const mat = new THREE.MeshStandardMaterial({ color: m.color || "#fbbf24", roughness: 0.6, metalness: 0.05, emissive: m.color, emissiveIntensity: 0.08 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(toX(m.pos_x || 0) - ox, 0.6, toZ(m.pos_y || 0) - oz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      content.add(mesh);
      content.add(makeLabel(m.name, mesh.position.x, 2.2, mesh.position.z, 1.0));
    });

    // 3) Bancadas (blocos 3D)
    items.filter(m => m.element_type === "bancada").forEach(m => {
      const w = Math.max(8, (m.width || 80) * SCALE);
      const d = Math.max(8, (m.height || 40) * SCALE);
      const h = 10;
      const color = m.color || "#22c55e";
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.18 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(toX(m.pos_x || 0) - ox, h / 2, toZ(m.pos_y || 0) - oz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      content.add(mesh);
      // tampo mais claro
      const top = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 1.2, d * 1.02), new THREE.MeshStandardMaterial({ color: lighten(color, 0.25), roughness: 0.3, metalness: 0.1 }));
      top.position.set(mesh.position.x, h + 0.6, mesh.position.z);
      top.castShadow = true;
      content.add(top);
      content.add(makeLabel(m.name, mesh.position.x, h + 7, mesh.position.z, 1.4));
    });

    // 4) Setas (cones)
    items.filter(m => m.element_type === "seta").forEach(m => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(4, 10, 16),
        new THREE.MeshStandardMaterial({ color: m.color || "#ef4444", roughness: 0.4, emissive: m.color, emissiveIntensity: 0.15 })
      );
      cone.rotation.x = m.rotation === 90 ? Math.PI / 2 : (m.rotation === -90 ? -Math.PI / 2 : 0);
      cone.rotation.y = (m.rotation || 0) * Math.PI / 180;
      cone.position.set(toX(m.pos_x || 0) - ox, 5, toZ(m.pos_y || 0) - oz);
      cone.castShadow = true;
      content.add(cone);
    });

    // 5) Assets (máquinas / armários / esteiras) — blocos distintivos
    const assetColor = { machine: "#64748b", workbench: "#16a34a", cabinet: "#a16207", shelf: "#7c3aed", scanner: "#0ea5e9", tool: "#dc2626" };
    assets.forEach((a, i) => {
      const px = a.position_x || (60 + i * 22);
      const pz = a.position_y || (40 + i % 3 * 30);
      const w = 14, d = 14, h = a.category === "machine" ? 18 : 12;
      const c = assetColor[a.category] || "#94a3b8";
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.25 }));
      mesh.position.set(toX(px) - ox, h / 2, toZ(pz) - oz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      content.add(mesh);
      const stColor = a.status === "maintenance" ? "#f59e0b" : a.status === "inactive" ? "#ef4444" : "#22c55e";
      const dot = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 12), new THREE.MeshStandardMaterial({ color: stColor, emissive: stColor, emissiveIntensity: 0.6 }));
      dot.position.set(mesh.position.x, h + 3, mesh.position.z);
      content.add(dot);
      content.add(makeLabel(a.name, mesh.position.x, h + 6, mesh.position.z, 1.1));
    });

    content.position.y = 0;
    scene.add(content);

    // Ajusta o alvo dos controles para o centro do conteúdo
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 6, 0);
      controlsRef.current.update();
    }
  }, [items, assets, equipment, areas, ready]);

  const resetCamera = () => {
    const cam = cameraRef.current, ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    cam.position.set(120, 110, 150);
    ctrl.target.set(0, 6, 0);
    ctrl.update();
  };

  return (
    <div className="relative w-full">
      <div ref={mountRef} className="w-full rounded-lg overflow-hidden bg-background" style={{ minHeight: 460 }} />
      {/* Overlay de controles */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <button onClick={resetCamera} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-card/90 border border-border text-[11px] text-muted-foreground hover:text-foreground backdrop-blur" title="Resetar câmera">
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>
      <div className="absolute bottom-3 left-3 flex items-center gap-3 px-3 py-1.5 rounded-md bg-card/80 border border-border backdrop-blur text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Arraste para girar</span>
        <span>· Scroll para zoom · Botão direito para mover</span>
      </div>
    </div>
  );
}

/* ---- helpers 3D ---- */
function makeLabel(text, x, y, z, scale = 1.4) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const label = String(text || "");
  const fontSize = 40;
  ctx.font = `600 ${fontSize}px Inter, Arial`;
  const w = Math.ceil(ctx.measureText(label).width) + 24;
  canvas.width = w; canvas.height = 72;
  ctx.fillStyle = "rgba(15,23,42,0.86)";
  roundRect(ctx, 0, 0, w, 72, 12); ctx.fill();
  ctx.fillStyle = "#e2e8f0";
  ctx.font = `600 ${fontSize}px Inter, Arial`;
  ctx.textBaseline = "middle";
  ctx.fillText(label, 12, 38);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(w * 0.04 * scale, 72 * 0.04 * scale, 1);
  spr.position.set(x, y, z);
  spr.renderOrder = 999;
  return spr;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function readBgColor(alpha = 1) {
  const ch = window.getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
  if (ch) return new THREE.Color(`hsl(${ch})`);
  return new THREE.Color("#0e1116");
}
function readFloorColor() {
  const ch = window.getComputedStyle(document.documentElement).getPropertyValue("--card").trim();
  if (!ch) return new THREE.Color("#161a22");
  const c = new THREE.Color(`hsl(${ch})`);
  c.multiplyScalar(0.6);
  return c;
}
function hslToken(name, fallback) {
  const ch = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (ch) return new THREE.Color(`hsl(${ch})`).getHex();
  return fallback;
}
function lighten(hex, amt) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color("#ffffff"), amt);
  return "#" + c.getHexString();
}