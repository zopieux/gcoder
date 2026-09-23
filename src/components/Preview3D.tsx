import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { evalDim } from "../lib/exprParser";
import {
  buildAccumulatedPreview,
  buildOperationPreview,
} from "../lib/preview/OpPreview";
import { SceneManager } from "../lib/preview/SceneManager";
import {
  currentGcode,
  currentProject,
  previewMode,
  selectedOperation,
  setPreviewMode,
  setShowToolpathsIn3D,
  showToolpathsIn3D,
} from "../stores/projectStore";

export function Preview3D() {
  let canvasRef!: HTMLCanvasElement;
  let sceneManager: SceneManager | null = null;
  onMount(() => {
    sceneManager = new SceneManager(canvasRef);

    const proj = currentProject();
    const w = Math.max(1, evalDim(proj.settings.stockWidth, 100));
    const h = Math.max(1, evalDim(proj.settings.stockHeight, 75));
    const t = Math.max(0.5, evalDim(proj.settings.stockThickness, 12.7));
    sceneManager.fitView(w, h, t);

    onCleanup(() => {
      sceneManager?.dispose();
    });
  });

  const getInitialShowCut = (): boolean => {
    try {
      const saved = localStorage.getItem("gcoder_show_cut_material");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  };

  const [showCutMaterial, setShowCutMaterial] = createSignal<boolean>(
    getInitialShowCut(),
  );

  const toggleCutMaterial = () => {
    const next = !showCutMaterial();
    setShowCutMaterial(next);
    try {
      localStorage.setItem("gcoder_show_cut_material", JSON.stringify(next));
    } catch {}
  };

  // Recompute meshes when operation, project settings, or preview mode change
  createEffect(() => {
    if (!sceneManager) return;
    const proj = currentProject();
    const op = selectedOperation();
    const mode = previewMode();
    const showPaths = showToolpathsIn3D();
    const showCuts = showCutMaterial();
    const gcodeData = currentGcode();

    const w = Math.max(1, evalDim(proj.settings.stockWidth, 100));
    const h = Math.max(1, evalDim(proj.settings.stockHeight, 75));
    const t = Math.max(0.5, evalDim(proj.settings.stockThickness, 12.7));
    sceneManager.setupHelpers(w, h, t);

    if (mode === "selected" && op) {
      const preview = buildOperationPreview(op, proj.settings);
      sceneManager.updateMeshes(preview, showCuts);

      // Toolpaths for selected op
      const selectedTp = gcodeData.toolpaths.filter((t) => t.opId === op.id);
      sceneManager.updateToolpaths(selectedTp, showPaths);
    } else {
      const preview = buildAccumulatedPreview(proj.operations, proj.settings);
      sceneManager.updateMeshes(preview, showCuts);

      // Toolpaths for all ops
      sceneManager.updateToolpaths(gcodeData.toolpaths, showPaths);
    }
  });

  const handlePreset = (preset: "iso" | "top" | "front" | "right") => {
    if (!sceneManager) return;
    const proj = currentProject();
    const w = Math.max(1, evalDim(proj.settings.stockWidth, 100));
    const h = Math.max(1, evalDim(proj.settings.stockHeight, 75));
    const t = Math.max(0.5, evalDim(proj.settings.stockThickness, 12.7));
    sceneManager.setViewPreset(preset, w, h, t);
  };

  const handleFit = () => {
    if (!sceneManager) return;
    const proj = currentProject();
    const w = Math.max(1, evalDim(proj.settings.stockWidth, 100));
    const h = Math.max(1, evalDim(proj.settings.stockHeight, 75));
    const t = Math.max(0.5, evalDim(proj.settings.stockThickness, 12.7));
    sceneManager.fitView(w, h, t);
  };

  return (
    <div class="preview-container">
      {/* Viewport Toolbar */}
      <div class="preview-toolbar">
        <div class="toolbar-left">
          <div class="segmented-control">
            <button
              class={`seg-btn ${previewMode() === "selected" ? "active" : ""}`}
              onClick={() => setPreviewMode("selected")}
              title="Preview only the selected operation's cut"
            >
              Selected Op
            </button>
            <button
              class={`seg-btn ${previewMode() === "full" ? "active" : ""}`}
              onClick={() => setPreviewMode("full")}
              title="Preview all operations accumulated"
            >
              Full Part
            </button>
          </div>

          <label class="toolbar-toggle" title="Toggle toolpath lines in 3D">
            <input
              type="checkbox"
              checked={showToolpathsIn3D()}
              onChange={(e) => setShowToolpathsIn3D(e.currentTarget.checked)}
            />
            <span>Toolpaths</span>
          </label>
        </div>

        <div class="toolbar-right">
          <div class="btn-group-views">
            <button
              class="btn-view"
              onClick={() => handlePreset("iso")}
              title="Isometric View"
            >
              Iso
            </button>
            <button
              class="btn-view"
              onClick={() => handlePreset("top")}
              title="Top Plan View (XY)"
            >
              Top
            </button>
            <button
              class="btn-view"
              onClick={() => handlePreset("front")}
              title="Front View (XZ)"
            >
              Front
            </button>
            <button
              class="btn-view"
              onClick={() => handlePreset("right")}
              title="Right View (YZ)"
            >
              Right
            </button>
            <button class="btn-view" onClick={handleFit} title="Fit to Stock">
              Fit
            </button>
          </div>
        </div>
      </div>

      {/* 3D WebGL Canvas */}
      <div class="canvas-wrapper">
        <canvas ref={canvasRef} class="webgl-canvas" />

        {/* Legend Overlay */}
        <div class="preview-legend">
          <div class="legend-item">
            <span class="legend-color legend-stock" />
            <span>Stock Body</span>
          </div>
          <button
            type="button"
            class={`legend-item legend-item-toggle ${showCutMaterial() ? "active" : "inactive"}`}
            onClick={toggleCutMaterial}
            title={
              showCutMaterial()
                ? "Click to hide removed material"
                : "Click to show removed material"
            }
          >
            <span
              class={`legend-color legend-cut ${showCutMaterial() ? "" : "dimmed"}`}
            />
            <span>Material Removed</span>
          </button>
          <Show when={showToolpathsIn3D()}>
            <div class="legend-item">
              <span class="legend-color legend-path" />
              <span>Cutting Move</span>
            </div>
            <div class="legend-item">
              <span class="legend-color legend-rapid" />
              <span>Rapid Move</span>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
