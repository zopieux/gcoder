import { Show } from "solid-js";
import {
  currentProject,
  isSettingsOpen,
  setIsSettingsOpen,
  updateGlobalSettings,
} from "../stores/projectStore";
import { DimInput } from "./DimInput";
import { IconX } from "./Icons";

export function GlobalSettingsModal() {
  const settings = () => currentProject().settings;

  return (
    <Show when={isSettingsOpen()}>
      <div class="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
        <div
          class="modal-card settings-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="modal-header">
            <h3>Stock & Global Parameters</h3>
            <button
              class="modal-close-btn"
              onClick={() => setIsSettingsOpen(false)}
              title="Close"
            >
              <IconX size={14} />
            </button>
          </div>

          <div class="modal-body settings-body">
            <div class="settings-section">
              <h4 class="section-title">Stock Material Dimensions</h4>
              <p class="section-desc">
                0,0 is the bottom-left corner of the stock. Top surface is Z = 0
                (before offset).
              </p>

              <div class="grid-2">
                <DimInput
                  label="Stock Width (X)"
                  value={settings().stockWidth}
                  placeholder="e.g. 100mm or 4in"
                  onChange={(val) => updateGlobalSettings({ stockWidth: val })}
                />
                <DimInput
                  label="Stock Height (Y)"
                  value={settings().stockHeight}
                  placeholder="e.g. 75mm or 3in"
                  onChange={(val) => updateGlobalSettings({ stockHeight: val })}
                />
              </div>

              <div class="grid-2">
                <DimInput
                  label="Stock Thickness (Z)"
                  value={settings().stockThickness}
                  placeholder="e.g. 12.7mm or 1/2in"
                  tooltip="Total stock height along Z. Cuts go into negative Z."
                  onChange={(val) =>
                    updateGlobalSettings({ stockThickness: val })
                  }
                />
                <DimInput
                  label="Z Offset (Top Surface)"
                  value={settings().zOffset}
                  placeholder="e.g. 0mm"
                  tooltip="Offset from stock top surface (0mm = stock top is Z0)."
                  onChange={(val) => updateGlobalSettings({ zOffset: val })}
                />
              </div>
            </div>

            <div class="settings-section">
              <h4 class="section-title">Safety & Travel</h4>
              <div class="grid-2">
                <DimInput
                  label="Safe Z (Retract Height)"
                  value={settings().safeZ}
                  placeholder="e.g. 5mm or 1/4in"
                  tooltip="Rapid travel height above stock top surface."
                  onChange={(val) => updateGlobalSettings({ safeZ: val })}
                />
                <div class="info-box">
                  <span class="info-label">Parking Command:</span>
                  <span class="info-val">
                    <code>G30</code> (MASSO Work Offset Park)
                  </span>
                  <p class="info-hint">
                    Moves all axes to machine park position on tool change &
                    finish.
                  </p>
                </div>
              </div>
            </div>

            <div class="settings-section">
              <h4 class="section-title">Defaults for New Operations</h4>
              <div class="grid-3">
                <DimInput
                  label="Default Feed Rate"
                  value={settings().defaultFeedRate}
                  placeholder="e.g. 800"
                  tooltip="Horizontal cutting feed in mm/min."
                  onChange={(val) =>
                    updateGlobalSettings({ defaultFeedRate: val })
                  }
                />
                <DimInput
                  label="Default Plunge Rate"
                  value={settings().defaultPlungeRate}
                  placeholder="e.g. 300"
                  tooltip="Vertical plunge feed in mm/min."
                  onChange={(val) =>
                    updateGlobalSettings({ defaultPlungeRate: val })
                  }
                />
                <DimInput
                  label="Spindle RPM"
                  value={settings().defaultSpindleRpm}
                  allowUnits={false}
                  unitSuffix="RPM"
                  placeholder="e.g. 12000 or 12*1000"
                  tooltip="Default spindle speed in rev/min."
                  onChange={(val) =>
                    updateGlobalSettings({ defaultSpindleRpm: val })
                  }
                />
              </div>

              <div class="grid-2">
                <DimInput
                  label="Default Depth Per Pass"
                  value={settings().defaultDepthPerPass}
                  placeholder="e.g. 1.5mm or 1/16in"
                  onChange={(val) =>
                    updateGlobalSettings({ defaultDepthPerPass: val })
                  }
                />
                <div class="dim-input-group">
                  <div class="dim-input-header">
                    <label class="dim-input-label">
                      Default Stepover (% of Tool Dia)
                    </label>
                    <span class="preview-text">
                      {settings().defaultStepoverPercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    class="range-slider"
                    min={10}
                    max={90}
                    value={settings().defaultStepoverPercent}
                    onInput={(e) =>
                      updateGlobalSettings({
                        defaultStepoverPercent:
                          parseInt(e.currentTarget.value) || 40,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button
              class="btn-primary"
              onClick={() => setIsSettingsOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
