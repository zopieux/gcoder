import { createSignal, Show } from "solid-js";
import {
  currentGcode,
  currentProject,
  isGcodeModalOpen,
  setIsGcodeModalOpen,
} from "../stores/projectStore";
import { IconCheck, IconClock, IconCopy, IconDownload, IconX } from "./Icons";

export function GcodeModal() {
  const [copied, setCopied] = createSignal(false);
  const data = () => currentGcode();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data().gcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = data().gcode;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([data().gcode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = currentProject()
      .name.toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");
    link.href = url;
    link.download = `${safeName}.nc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Show when={isGcodeModalOpen()}>
      <div class="modal-overlay" onClick={() => setIsGcodeModalOpen(false)}>
        <div
          class="modal-card gcode-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="modal-header">
            <div class="gcode-modal-title">
              <h3>Generated G-Code</h3>
              <div class="gcode-stats">
                <span class="stat-tag">{data().totalLines} lines</span>
                <span class="stat-tag">
                  <IconClock
                    size={11}
                    style={{
                      "margin-right": "4px",
                      "vertical-align": "middle",
                    }}
                  />
                  Est. ~{data().estimatedTimeMin} min
                </span>
                <span class="stat-tag">Standard: MASSO ISO G-Code</span>
              </div>
            </div>
            <button
              class="modal-close-btn"
              onClick={() => setIsGcodeModalOpen(false)}
              title="Close"
            >
              <IconX size={14} />
            </button>
          </div>

          <div class="modal-body gcode-modal-body">
            <pre class="gcode-viewer">
              <code>{data().gcode}</code>
            </pre>
          </div>

          <div class="modal-footer gcode-modal-footer">
            <button
              class={`btn-action ${copied() ? "copied" : ""}`}
              onClick={handleCopy}
            >
              <Show
                when={copied()}
                fallback={
                  <>
                    <IconCopy size={13} />
                    <span>Copy to Clipboard</span>
                  </>
                }
              >
                <IconCheck size={13} />
                <span>Copied to Clipboard!</span>
              </Show>
            </button>
            <button class="btn-primary" onClick={handleDownload}>
              <IconDownload size={13} />
              <span>Download .NC File</span>
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
