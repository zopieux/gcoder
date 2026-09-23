import { createMemo, createSignal, Show } from "solid-js";
import { evalDim } from "../lib/exprParser";
import { selectedOperation, updateOperation } from "../stores/projectStore";
import type {
  HoleOp,
  MillingPattern,
  PocketOp,
  ProfileSide,
  ProfilingOp,
  SurfacingOp,
  ToolpathDirection,
} from "../types/project";
import { getToolById } from "../types/tools";
import { DimInput } from "./DimInput";
import { IconAlertTriangle, IconChevronDown, IconChevronUp } from "./Icons";
import { ToolSelect } from "./ToolSelect";

export function OperationParamsPane() {
  const op = () => selectedOperation();
  const [showFeeds, setShowFeeds] = createSignal(true);

  const tool = createMemo(() => {
    const o = op();
    return o ? getToolById(o.toolId) : null;
  });

  const holeWarning = createMemo(() => {
    const o = op();
    const t = tool();
    if (o && o.type === "hole" && t) {
      const d = evalDim((o as HoleOp).diameter, 0);
      if (d < t.diameterMm - 0.05) {
        return `Hole diameter (${d.toFixed(2)}mm) is smaller than tool diameter (${t.diameterMm.toFixed(2)}mm). Select a smaller tool or increase hole diameter.`;
      }
    }
    return null;
  });

  const pocketWarning = createMemo(() => {
    const o = op();
    const t = tool();
    if (o && o.type === "pocket" && t) {
      const p = o as PocketOp;
      const w = evalDim(p.width, 0);
      const h = evalDim(p.height, 0);
      if (w < t.diameterMm || h < t.diameterMm) {
        return `Pocket dimension is smaller than tool diameter (${t.diameterMm.toFixed(2)}mm).`;
      }
    }
    return null;
  });

  return (
    <Show
      when={op()}
      fallback={
        <div class="params-pane empty-params">
          <p>No operation selected.</p>
          <p class="empty-sub">
            Click "+ Add Operation" to add a machining feature.
          </p>
        </div>
      }
    >
      {(currentOp) => (
        <div class="params-pane">
          <div class="params-header">
            <div class="params-title-row">
              <input
                type="text"
                class="op-name-input"
                value={currentOp().name}
                onInput={(e) =>
                  updateOperation(currentOp().id, {
                    name: e.currentTarget.value,
                  })
                }
              />
              <span class="op-type-tag">{currentOp().type}</span>
            </div>
          </div>

          {/* Warnings */}
          <Show when={holeWarning()}>
            <div class="inline-warning-box">
              <IconAlertTriangle
                size={13}
                style={{
                  "margin-right": "6px",
                  "vertical-align": "text-bottom",
                }}
              />
              <strong>Tool Size Warning:</strong> {holeWarning()}
            </div>
          </Show>
          <Show when={pocketWarning()}>
            <div class="inline-warning-box">
              <IconAlertTriangle
                size={13}
                style={{
                  "margin-right": "6px",
                  "vertical-align": "text-bottom",
                }}
              />
              <strong>Tool Size Warning:</strong> {pocketWarning()}
            </div>
          </Show>

          <div class="params-scroll">
            {/* Tool Selection */}
            <section class="params-group">
              <ToolSelect
                selectedId={currentOp().toolId}
                onChange={(toolId) =>
                  updateOperation(currentOp().id, { toolId })
                }
              />
            </section>

            {/* Operation Specific Geometry */}
            <section class="params-group">
              <h4 class="group-title">Geometry & Dimensions</h4>

              {/* Surfacing */}
              <Show when={currentOp().type === "surfacing"}>
                {(() => {
                  const surf = currentOp() as SurfacingOp;
                  return (
                    <div class="op-fields">
                      <div class="grid-2">
                        <DimInput
                          label="Start X (Bottom-Left)"
                          value={surf.x}
                          placeholder="e.g. 0mm"
                          onChange={(x) => updateOperation(surf.id, { x })}
                        />
                        <DimInput
                          label="Start Y (Bottom-Left)"
                          value={surf.y}
                          placeholder="e.g. 0mm"
                          onChange={(y) => updateOperation(surf.id, { y })}
                        />
                      </div>

                      <div class="grid-2">
                        <DimInput
                          label="Width (X Span)"
                          value={surf.width}
                          placeholder="e.g. 100mm"
                          onChange={(width) =>
                            updateOperation(surf.id, { width })
                          }
                        />
                        <DimInput
                          label="Height (Y Span)"
                          value={surf.height}
                          placeholder="e.g. 75mm"
                          onChange={(height) =>
                            updateOperation(surf.id, { height })
                          }
                        />
                      </div>

                      <DimInput
                        label="Cut Depth (Material to remove)"
                        value={surf.cutDepth}
                        placeholder="e.g. 1.0mm"
                        tooltip="Depth removed from top surface down."
                        onChange={(cutDepth) =>
                          updateOperation(surf.id, { cutDepth })
                        }
                      />

                      {/* Pattern & Direction */}
                      <div class="grid-2">
                        <div class="dim-input-group">
                          <label class="dim-input-label">
                            Clearing Pattern
                          </label>
                          <select
                            class="tool-select-dropdown"
                            value={surf.pattern}
                            onChange={(e) =>
                              updateOperation(surf.id, {
                                pattern: e.currentTarget
                                  .value as MillingPattern,
                              })
                            }
                          >
                            <option value="zigzag-h">
                              Zigzag Horizontal (X)
                            </option>
                            <option value="zigzag-v">
                              Zigzag Vertical (Y)
                            </option>
                            <option value="zigzag-diag">
                              Diagonal Zigzag (45°)
                            </option>
                            <option value="spiral">Spiral</option>
                          </select>
                        </div>

                        <div class="dim-input-group">
                          <label class="dim-input-label">Path Direction</label>
                          <select
                            class="tool-select-dropdown"
                            value={surf.direction}
                            onChange={(e) =>
                              updateOperation(surf.id, {
                                direction: e.currentTarget
                                  .value as ToolpathDirection,
                              })
                            }
                          >
                            <option value="forward">Forward</option>
                            <option value="reversed">
                              Reversed (Start from end)
                            </option>
                          </select>
                        </div>
                      </div>

                      <div class="dim-input-group">
                        <div class="dim-input-header">
                          <label class="dim-input-label">
                            Stepover (% of Tool Dia)
                          </label>
                          <span class="preview-text">
                            {surf.stepoverPercent}%
                          </span>
                        </div>
                        <input
                          type="range"
                          class="range-slider"
                          min={10}
                          max={90}
                          value={surf.stepoverPercent}
                          onInput={(e) =>
                            updateOperation(surf.id, {
                              stepoverPercent:
                                parseInt(e.currentTarget.value) || 40,
                            })
                          }
                        />
                      </div>
                    </div>
                  );
                })()}
              </Show>

              {/* Profiling */}
              <Show when={currentOp().type === "profiling"}>
                {(() => {
                  const prof = currentOp() as ProfilingOp;
                  return (
                    <div class="op-fields">
                      <div class="grid-2">
                        <DimInput
                          label="X (Bottom-Left)"
                          value={prof.x}
                          placeholder="e.g. 5mm"
                          onChange={(x) => updateOperation(prof.id, { x })}
                        />
                        <DimInput
                          label="Y (Bottom-Left)"
                          value={prof.y}
                          placeholder="e.g. 5mm"
                          onChange={(y) => updateOperation(prof.id, { y })}
                        />
                      </div>

                      <div class="grid-2">
                        <DimInput
                          label="Profile Width (X)"
                          value={prof.width}
                          placeholder="e.g. 80mm"
                          onChange={(width) =>
                            updateOperation(prof.id, { width })
                          }
                        />
                        <DimInput
                          label="Profile Height (Y)"
                          value={prof.height}
                          placeholder="e.g. 60mm"
                          onChange={(height) =>
                            updateOperation(prof.id, { height })
                          }
                        />
                      </div>

                      <DimInput
                        label="Cut Depth"
                        value={prof.cutDepth}
                        placeholder="e.g. 6.35mm"
                        onChange={(cutDepth) =>
                          updateOperation(prof.id, { cutDepth })
                        }
                      />

                      <div class="grid-2">
                        <div class="dim-input-group">
                          <label class="dim-input-label">Cut Side</label>
                          <select
                            class="tool-select-dropdown"
                            value={prof.side}
                            onChange={(e) =>
                              updateOperation(prof.id, {
                                side: e.currentTarget.value as ProfileSide,
                              })
                            }
                          >
                            <option value="outside">
                              Outside Profile (Outer boundary)
                            </option>
                            <option value="inside">
                              Inside Profile (Inner cut)
                            </option>
                          </select>
                        </div>

                        <div class="dim-input-group">
                          <label class="dim-input-label">Direction</label>
                          <select
                            class="tool-select-dropdown"
                            value={prof.direction}
                            onChange={(e) =>
                              updateOperation(prof.id, {
                                direction: e.currentTarget
                                  .value as ToolpathDirection,
                              })
                            }
                          >
                            <option value="forward">Forward (Climb)</option>
                            <option value="reversed">
                              Reversed (Conventional)
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </Show>

              {/* Pocket */}
              <Show when={currentOp().type === "pocket"}>
                {(() => {
                  const pock = currentOp() as PocketOp;
                  return (
                    <div class="op-fields">
                      <div class="grid-2">
                        <DimInput
                          label="Pocket X (Bottom-Left)"
                          value={pock.x}
                          placeholder="e.g. 20mm"
                          onChange={(x) => updateOperation(pock.id, { x })}
                        />
                        <DimInput
                          label="Pocket Y (Bottom-Left)"
                          value={pock.y}
                          placeholder="e.g. 15mm"
                          onChange={(y) => updateOperation(pock.id, { y })}
                        />
                      </div>

                      <div class="grid-2">
                        <DimInput
                          label="Pocket Width (X)"
                          value={pock.width}
                          placeholder="e.g. 50mm"
                          onChange={(width) =>
                            updateOperation(pock.id, { width })
                          }
                        />
                        <DimInput
                          label="Pocket Height (Y)"
                          value={pock.height}
                          placeholder="e.g. 40mm"
                          onChange={(height) =>
                            updateOperation(pock.id, { height })
                          }
                        />
                      </div>

                      <DimInput
                        label="Pocket Depth"
                        value={pock.cutDepth}
                        placeholder="e.g. 3mm"
                        onChange={(cutDepth) =>
                          updateOperation(pock.id, { cutDepth })
                        }
                      />

                      {/* Pattern & Direction */}
                      <div class="grid-2">
                        <div class="dim-input-group">
                          <label class="dim-input-label">
                            Clearing Pattern
                          </label>
                          <select
                            class="tool-select-dropdown"
                            value={pock.pattern}
                            onChange={(e) =>
                              updateOperation(pock.id, {
                                pattern: e.currentTarget
                                  .value as MillingPattern,
                              })
                            }
                          >
                            <option value="spiral">Spiral</option>
                            <option value="zigzag-h">
                              Zigzag Horizontal (X)
                            </option>
                            <option value="zigzag-v">
                              Zigzag Vertical (Y)
                            </option>
                            <option value="zigzag-diag">
                              Diagonal Zigzag (45°)
                            </option>
                          </select>
                        </div>

                        <div class="dim-input-group">
                          <label class="dim-input-label">Path Direction</label>
                          <select
                            class="tool-select-dropdown"
                            value={pock.direction}
                            onChange={(e) =>
                              updateOperation(pock.id, {
                                direction: e.currentTarget
                                  .value as ToolpathDirection,
                              })
                            }
                          >
                            <option value="forward">
                              Forward (Outside-in)
                            </option>
                            <option value="reversed">
                              Reversed (Inside-out)
                            </option>
                          </select>
                        </div>
                      </div>

                      <div class="dim-input-group">
                        <div class="dim-input-header">
                          <label class="dim-input-label">
                            Stepover (% of Tool Dia)
                          </label>
                          <span class="preview-text">
                            {pock.stepoverPercent}%
                          </span>
                        </div>
                        <input
                          type="range"
                          class="range-slider"
                          min={10}
                          max={90}
                          value={pock.stepoverPercent}
                          onInput={(e) =>
                            updateOperation(pock.id, {
                              stepoverPercent:
                                parseInt(e.currentTarget.value) || 40,
                            })
                          }
                        />
                      </div>
                    </div>
                  );
                })()}
              </Show>

              {/* Hole */}
              <Show when={currentOp().type === "hole"}>
                {(() => {
                  const hole = currentOp() as HoleOp;
                  return (
                    <div class="op-fields">
                      <div class="grid-2">
                        <DimInput
                          label="Hole Center X"
                          value={hole.x}
                          placeholder="e.g. 50mm"
                          onChange={(x) => updateOperation(hole.id, { x })}
                        />
                        <DimInput
                          label="Hole Center Y"
                          value={hole.y}
                          placeholder="e.g. 37.5mm"
                          onChange={(y) => updateOperation(hole.id, { y })}
                        />
                      </div>

                      <div class="grid-2">
                        <DimInput
                          label="Hole Diameter"
                          value={hole.diameter}
                          placeholder="e.g. 6.35mm"
                          tooltip="Must be ≥ tool diameter. If larger, performs circular milling."
                          onChange={(diameter) =>
                            updateOperation(hole.id, { diameter })
                          }
                        />
                        <DimInput
                          label="Cut Depth (Hole Depth)"
                          value={hole.cutDepth}
                          placeholder="e.g. 10mm"
                          onChange={(cutDepth) =>
                            updateOperation(hole.id, { cutDepth })
                          }
                        />
                      </div>

                      <div class="grid-2">
                        <DimInput
                          label="Peck Depth (Chip break)"
                          value={hole.peckDepth}
                          placeholder="e.g. 2mm (0 = direct plunge)"
                          tooltip="Retracts to clear chips every peck."
                          onChange={(peckDepth) =>
                            updateOperation(hole.id, { peckDepth })
                          }
                        />

                        <div class="dim-input-group">
                          <label class="dim-input-label">
                            Circular Milling Direction
                          </label>
                          <select
                            class="tool-select-dropdown"
                            value={hole.direction}
                            onChange={(e) =>
                              updateOperation(hole.id, {
                                direction: e.currentTarget
                                  .value as ToolpathDirection,
                              })
                            }
                          >
                            <option value="forward">Clockwise (CW - G2)</option>
                            <option value="reversed">
                              Counter-Clockwise (CCW - G3)
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </Show>
            </section>

            {/* Feeds, Speeds, Z-Passes */}
            <section class="params-group">
              <div
                class="group-header-collapsible"
                onClick={() => setShowFeeds(!showFeeds())}
              >
                <h4 class="group-title">Feeds, Speeds & Depths</h4>
                <span class="collapse-icon">
                  {showFeeds() ? (
                    <IconChevronUp size={11} />
                  ) : (
                    <IconChevronDown size={11} />
                  )}
                </span>
              </div>

              <Show when={showFeeds()}>
                <div class="op-fields">
                  <div class="grid-2">
                    <DimInput
                      label="Feed Rate (Cut XY)"
                      value={currentOp().feedRate}
                      placeholder="e.g. 800"
                      tooltip="Horizontal cutting speed in mm/min."
                      onChange={(feedRate) =>
                        updateOperation(currentOp().id, { feedRate })
                      }
                    />
                    <DimInput
                      label="Plunge Rate (Z)"
                      value={currentOp().plungeRate}
                      placeholder="e.g. 300"
                      tooltip="Downward entry speed in mm/min."
                      onChange={(plungeRate) =>
                        updateOperation(currentOp().id, { plungeRate })
                      }
                    />
                  </div>

                  <div class="grid-2">
                    <DimInput
                      label="Spindle RPM"
                      value={currentOp().spindleRpm}
                      allowUnits={false}
                      unitSuffix="RPM"
                      placeholder="e.g. 12000 or 12*1000"
                      tooltip="Spindle rotation speed in rev/min."
                      onChange={(spindleRpm) =>
                        updateOperation(currentOp().id, { spindleRpm })
                      }
                    />

                    <DimInput
                      label="Depth Per Pass"
                      value={currentOp().depthPerPass}
                      placeholder="e.g. 1.5mm"
                      tooltip="Maximum Z cut per layer."
                      onChange={(depthPerPass) =>
                        updateOperation(currentOp().id, { depthPerPass })
                      }
                    />
                  </div>
                </div>
              </Show>
            </section>
          </div>
        </div>
      )}
    </Show>
  );
}
