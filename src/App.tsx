import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  sampleLedger,
  sampleMonth,
  sampleTotal,
  type LedgerEntry,
} from "./data/sampleLedger";

/** 1 CNY = 0.01 world units, so Food ¥850 renders 8.5 units tall. */
const HEIGHT_SCALE = 1 / 100;
const BUILDING_W = 3;
const BUILDING_D = 3;
const GAP = 1.6;

interface Tooltip {
  x: number;
  y: number;
  entry: LedgerEntry;
  share: number;
}

/** Canvas facade: dark base with a grid of windows, some lit. */
function makeFacadeTexture(baseColor: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 4;
  const rows = 10;
  const w = 128 / cols;
  const h = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() > 0.45;
      ctx.fillStyle = lit ? "#ffd166" : "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(c * w + w * 0.22, r * h + h * 0.22, w * 0.56, h * 0.56);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Floating label sprite pinned above a building. */
function makeLabelSprite(title: string, sub: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(10, 15, 30, 0.72)";
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 56px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, 256, 68);
  ctx.font = "44px system-ui, sans-serif";
  ctx.fillStyle = "#ffd166";
  ctx.fillText(sub, 256, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4.5, 1.4, 1);
  return sprite;
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const homeRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(
    null
  );
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // --- renderer / scene / camera ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0b1020");
    scene.fog = new THREE.Fog("#0b1020", 30, 70);

    const camera = new THREE.PerspectiveCamera(
      50,
      mount.clientWidth / mount.clientHeight,
      0.1,
      200
    );
    camera.position.set(11, 9, 15);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.7;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 6;
    controls.maxDistance = 45;
    controls.update();
    controlsRef.current = controls;
    homeRef.current = {
      pos: camera.position.clone(),
      target: controls.target.clone(),
    };

    // Pause auto-rotate while the user drags, resume after 3s idle.
    let resumeTimer: number | undefined;
    const pauseAutoRotate = () => {
      controls.autoRotate = false;
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        controls.autoRotate = true;
      }, 3000);
    };
    controls.addEventListener("start", pauseAutoRotate);

    // --- lights ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(12, 18, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -16;
    scene.add(sun);

    // --- ground ---
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: "#141a2e", roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(60, 30, "#2a3355", "#1c2340");
    grid.position.y = 0.01;
    scene.add(grid);

    // --- buildings: one per category, height proportional to spend ---
    const pickables: THREE.Mesh[] = [];
    const meshToEntry = new Map<string, LedgerEntry>();
    const meshToMats = new Map<string, THREE.MeshStandardMaterial[]>();

    sampleLedger.forEach((entry, i) => {
      const height = Math.max(entry.amount * HEIGHT_SCALE, 0.6);
      const geo = new THREE.BoxGeometry(BUILDING_W, height, BUILDING_D);
      const facadeTex = makeFacadeTexture(entry.color);
      const side = new THREE.MeshStandardMaterial({
        map: facadeTex,
        roughness: 0.85,
        metalness: 0.05,
      });
      const top = new THREE.MeshStandardMaterial({
        color: entry.color,
        roughness: 0.6,
      });
      const bottom = new THREE.MeshStandardMaterial({ color: "#111827" });
      const mats = [side, side, top, bottom, side, side];
      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set((i - 2) * (BUILDING_W + GAP), height / 2, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.entry = entry;
      scene.add(mesh);
      pickables.push(mesh);
      meshToEntry.set(mesh.uuid, entry);
      meshToMats.set(mesh.uuid, mats);

      const label = makeLabelSprite(entry.category, `¥${entry.amount}`);
      label.position.set(mesh.position.x, height + 1.3, 0);
      scene.add(label);
    });

    // --- hover highlight + tooltip (raycast) ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoveredUuid: string | null = null;

    const setHighlight = (uuid: string | null) => {
      if (hoveredUuid && hoveredUuid !== uuid) {
        const prevMats = meshToMats.get(hoveredUuid);
        prevMats?.forEach((m) => {
          m.emissive.setHex(0x000000);
          m.emissiveIntensity = 1;
        });
      }
      hoveredUuid = uuid;
      if (uuid) {
        const entry = meshToEntry.get(uuid);
        const mats = meshToMats.get(uuid);
        mats?.forEach((m) => {
          m.emissive.set(entry ? entry.color : "#ffffff");
          m.emissiveIntensity = 0.35;
        });
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      if (hits.length > 0) {
        const mesh = hits[0].object as THREE.Mesh;
        const entry = mesh.userData.entry as LedgerEntry;
        setHighlight(mesh.uuid);
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          entry,
          share: (entry.amount / sampleTotal) * 100,
        });
      } else {
        setHighlight(null);
        setTooltip(null);
      }
    };
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", () => {
      setHighlight(null);
      setTooltip(null);
    });

    // --- resize ---
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // --- loop ---
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- cleanup (StrictMode-safe: removes everything this setup added) ---
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resumeTimer);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      controls.removeEventListener("start", pauseAutoRotate);
      controls.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          mats.forEach((m) => {
            const mat = m as THREE.MeshStandardMaterial;
            mat.map?.dispose();
            mat.dispose();
          });
        }
        if (obj instanceof THREE.Sprite) {
          const mat = obj.material as THREE.SpriteMaterial;
          mat.map?.dispose();
          mat.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      controlsRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  const resetView = () => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const home = homeRef.current;
    if (!controls || !camera || !home) return;
    camera.position.copy(home.pos);
    controls.target.copy(home.target);
    controls.update();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#0b1020",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#fff",
      }}
    >
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* header */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800 }}>Spending City</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>
          {sampleMonth} · ¥{sampleTotal.toLocaleString()} total · drag to orbit,
          scroll to zoom
        </div>
      </div>

      {/* legend */}
      <div
        style={{
          position: "absolute",
          left: 16,
          bottom: 16,
          background: "rgba(10, 15, 30, 0.78)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: "12px 14px",
          minWidth: 230,
          backdropFilter: "blur(6px)",
        }}
      >
        {sampleLedger.map((e) => {
          const share = (e.amount / sampleTotal) * 100;
          return (
            <div
              key={e.category}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "3px 0",
                fontSize: 13,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: e.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ width: 96 }}>{e.category}</span>
              <span style={{ fontWeight: 700 }}>¥{e.amount}</span>
              <span style={{ opacity: 0.65, marginLeft: "auto" }}>
                {share.toFixed(0)}%
              </span>
              <span
                style={{
                  display: "inline-block",
                  height: 6,
                  width: 54,
                  borderRadius: 3,
                  background: "rgba(255,255,255,0.14)",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${share}%`,
                    background: e.color,
                    borderRadius: 3,
                  }}
                />
              </span>
            </div>
          );
        })}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.14)",
            marginTop: 8,
            paddingTop: 8,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Total ¥{sampleTotal.toLocaleString()}
        </div>
      </div>

      {/* reset view */}
      <button
        onClick={resetView}
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
          background: "rgba(10, 15, 30, 0.78)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 10,
          padding: "8px 14px",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Reset view
      </button>

      {/* hover tooltip */}
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 14,
            top: tooltip.y + 14,
            background: "rgba(10, 15, 30, 0.9)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 700 }}>{tooltip.entry.category}</div>
          <div>
            ¥{tooltip.entry.amount} · {tooltip.share.toFixed(1)}% of total
          </div>
        </div>
      )}
    </div>
  );
}
