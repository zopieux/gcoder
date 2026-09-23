import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GeneratedToolpath } from "../toolpaths/types";
import type { PreviewMeshes } from "./OpPreview";

export class SceneManager {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private meshGroup: THREE.Group;
  private toolpathGroup: THREE.Group;
  private helpersGroup: THREE.Group;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x121214); // Neutral charcoal background

    // Camera (Z is up in CNC world!)
    const aspect = canvas.clientWidth / (canvas.clientHeight || 1);
    this.camera = new THREE.PerspectiveCamera(45, aspect, 1.0, 2000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(120, -140, 100);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(50, 40, -6);
    this.controls.update();

    // Groups
    this.meshGroup = new THREE.Group();
    this.toolpathGroup = new THREE.Group();
    this.helpersGroup = new THREE.Group();

    this.scene.add(this.meshGroup);
    this.scene.add(this.toolpathGroup);
    this.scene.add(this.helpersGroup);

    this.setupLights();
    this.setupHelpers(100, 75, 12.7);

    // Resize observer
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(canvas);

    this.startRenderLoop();
  }

  private setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(100, -100, 150);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.4);
    dirLight2.position.set(-80, 80, -50);
    this.scene.add(dirLight2);

    const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 0.4);
    this.scene.add(hemiLight);
  }

  public setupHelpers(stockW: number, stockH: number, stockT = 12.7) {
    this.helpersGroup.clear();

    // Axes helper at bottom-left corner (0, 0, 0)
    // Red = X, Green = Y, Blue = Z
    const axes = new THREE.AxesHelper(
      Math.max(30, Math.min(stockW, stockH) * 0.5),
    );
    axes.position.set(0, 0, 0);
    this.helpersGroup.add(axes);

    // Coordinate grid on the spoilboard level (underneath stock)
    const gridSize = Math.max(150, Math.max(stockW, stockH) * 1.6);
    const grid = new THREE.GridHelper(
      gridSize,
      Math.round(gridSize / 10),
      0x38383e,
      0x222226,
    );
    grid.rotateX(Math.PI / 2); // Rotate to XY plane
    grid.position.set(stockW / 2, stockH / 2, -stockT - 0.2);
    this.helpersGroup.add(grid);
  }

  public updateMeshes(preview: PreviewMeshes, showCutMaterial = true) {
    this.meshGroup.clear();

    if (preview.remainingStock) {
      this.meshGroup.add(preview.remainingStock);
    }

    if (showCutMaterial && preview.cutVolume) {
      this.meshGroup.add(preview.cutVolume);
    }

    if (preview.wireframes) {
      for (let i = 0; i < preview.wireframes.length; i++) {
        const wire = preview.wireframes[i];
        const isStockOutline = i === preview.wireframes.length - 1;
        if (isStockOutline || showCutMaterial) {
          this.meshGroup.add(wire);
        }
      }
    }
  }

  public updateToolpaths(toolpaths: GeneratedToolpath[], visible = true) {
    this.toolpathGroup.clear();
    if (!visible || toolpaths.length === 0) return;

    for (const tp of toolpaths) {
      const cuttingPoints: THREE.Vector3[] = [];
      const rapidPoints: THREE.Vector3[] = [];
      let lastPos = new THREE.Vector3(0, 0, 10);

      for (const move of tp.moves) {
        const nextPos = new THREE.Vector3(
          move.x !== undefined ? move.x : lastPos.x,
          move.y !== undefined ? move.y : lastPos.y,
          move.z !== undefined ? move.z : lastPos.z,
        );

        if (move.type === "rapid") {
          rapidPoints.push(lastPos.clone(), nextPos.clone());
        } else if (move.type === "arc-cw" || move.type === "arc-ccw") {
          const isCw = move.type === "arc-cw";
          const i = move.i ?? 0;
          const j = move.j ?? 0;
          const centerX = lastPos.x + i;
          const centerY = lastPos.y + j;
          const radius = Math.hypot(i, j);

          if (radius > 1e-4) {
            const startAngle = Math.atan2(
              lastPos.y - centerY,
              lastPos.x - centerX,
            );
            const endAngle = Math.atan2(
              nextPos.y - centerY,
              nextPos.x - centerX,
            );

            let sweep = isCw ? startAngle - endAngle : endAngle - startAngle;
            while (sweep <= 1e-5) sweep += 2 * Math.PI;

            const steps = 24;
            let prevArcPt = lastPos.clone();

            for (let s = 1; s <= steps; s++) {
              const frac = s / steps;
              const angle = isCw
                ? startAngle - frac * sweep
                : startAngle + frac * sweep;
              const arcZ = lastPos.z + frac * (nextPos.z - lastPos.z);
              const currArcPt = new THREE.Vector3(
                centerX + radius * Math.cos(angle),
                centerY + radius * Math.sin(angle),
                arcZ,
              );
              cuttingPoints.push(prevArcPt.clone(), currArcPt.clone());
              prevArcPt = currArcPt;
            }
          } else {
            cuttingPoints.push(lastPos.clone(), nextPos.clone());
          }
        } else {
          cuttingPoints.push(lastPos.clone(), nextPos.clone());
        }

        lastPos = nextPos;
      }

      if (cuttingPoints.length > 0) {
        const cutGeo = new THREE.BufferGeometry().setFromPoints(cuttingPoints);
        const cutMat = new THREE.LineBasicMaterial({
          color: 0x06b6d4,
          linewidth: 1.5,
        });
        const cutLines = new THREE.LineSegments(cutGeo, cutMat);
        this.toolpathGroup.add(cutLines);
      }

      if (rapidPoints.length > 0) {
        const rapidGeo = new THREE.BufferGeometry().setFromPoints(rapidPoints);
        const rapidMat = new THREE.LineDashedMaterial({
          color: 0xeab308,
          dashSize: 2,
          gapSize: 1.5,
          transparent: true,
          opacity: 0.5,
        });
        const rapidLines = new THREE.LineSegments(rapidGeo, rapidMat);
        rapidLines.computeLineDistances();
        this.toolpathGroup.add(rapidLines);
      }
    }
  }

  public fitView(stockW: number, stockH: number, stockT: number) {
    const cx = stockW / 2;
    const cy = stockH / 2;
    const cz = -stockT / 2;

    this.controls.target.set(cx, cy, cz);
    const maxDim = Math.max(stockW, stockH, stockT);
    this.camera.position.set(
      cx + maxDim * 0.9,
      cy - maxDim * 1.2,
      cz + maxDim * 1.1,
    );
    this.controls.update();
  }

  public setViewPreset(
    preset: "iso" | "top" | "front" | "right",
    stockW: number,
    stockH: number,
    stockT: number,
  ) {
    const cx = stockW / 2;
    const cy = stockH / 2;
    const cz = -stockT / 2;
    const dist = Math.max(stockW, stockH) * 1.6;

    this.controls.target.set(cx, cy, cz);

    switch (preset) {
      case "iso":
        this.camera.position.set(
          cx + dist * 0.7,
          cy - dist * 0.9,
          cz + dist * 0.8,
        );
        break;
      case "top":
        this.camera.position.set(cx, cy, cz + dist * 1.3);
        break;
      case "front":
        this.camera.position.set(cx, cy - dist * 1.3, cz);
        break;
      case "right":
        this.camera.position.set(cx + dist * 1.3, cy, cz);
        break;
    }
    this.controls.update();
  }

  private handleResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private startRenderLoop() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  public dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.controls.dispose();
    this.renderer.dispose();
  }
}
