import { createSignal, Show } from "solid-js";
import {
  canRedo,
  canUndo,
  currentGcode,
  currentProject,
  performRedo,
  performUndo,
  renameCurrentProject,
  setIsGcodeModalOpen,
  setIsProjectDialogOpen,
  setIsSettingsOpen,
} from "../stores/projectStore";
import {
  IconCheck,
  IconChevronDown,
  IconCode,
  IconCopy,
  IconDownload,
  IconFolder,
  IconGear,
  IconRedo,
  IconSliders,
  IconUndo,
} from "./Icons";

export function Header() {
  const [isEditingName, setIsEditingName] = createSignal(false);
  const [tempName, setTempName] = createSignal("");
  const [copyToast, setCopyToast] = createSignal(false);

  let lastTapTime = 0;

  const startRename = () => {
    setTempName(currentProject().name);
    setIsEditingName(true);
  };

  const finishRename = () => {
    if (isEditingName()) {
      renameCurrentProject(tempName());
      setIsEditingName(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      finishRename();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
    }
  };

  const handleCopyGcode = async () => {
    const code = currentGcode().gcode;
    try {
      await navigator.clipboard.writeText(code);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    }
  };

  const handleExportGcode = () => {
    const code = currentGcode().gcode;
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
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

  const handleTitleTap = () => {
    const now = Date.now();
    if (now - lastTapTime < 350) {
      startRename();
      lastTapTime = 0;
    } else {
      lastTapTime = now;
    }
  };

  return (
    <header class="app-header">
      <div class="header-left">
        <div class="app-branding">
          <span class="app-logo">
            <IconGear size={16} />
          </span>
          <span class="app-title">GCoder</span>
        </div>

        <div class="project-title-container">
          <Show
            when={isEditingName()}
            fallback={
              <button
                class="project-name-btn"
                onClick={() => {
                  handleTitleTap();
                  setIsProjectDialogOpen(true);
                }}
                onDblClick={(e) => {
                  e.stopPropagation();
                  startRename();
                }}
                title="Click to manage projects • Double-click to rename"
              >
                <span class="folder-icon">
                  <IconFolder size={14} />
                </span>
                <span class="project-name-text">{currentProject().name}</span>
                <span class="dropdown-chevron">
                  <IconChevronDown size={11} />
                </span>
              </button>
            }
          >
            <input
              type="text"
              class="project-rename-input"
              value={tempName()}
              autofocus
              onInput={(e) => setTempName(e.currentTarget.value)}
              onBlur={finishRename}
              onKeyDown={handleKeyDown}
            />
          </Show>
        </div>
      </div>

      <div class="header-center">
        <div class="history-controls">
          <button
            class="btn-icon"
            disabled={!canUndo()}
            onClick={performUndo}
            title="Undo (Ctrl+Z)"
          >
            <IconUndo size={12} style={{ "margin-right": "4px" }} />
            <span>Undo</span>
          </button>
          <button
            class="btn-icon"
            disabled={!canRedo()}
            onClick={performRedo}
            title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
          >
            <IconRedo size={12} style={{ "margin-right": "4px" }} />
            <span>Redo</span>
          </button>
        </div>
      </div>

      <div class="header-right">
        <button
          class="btn-secondary"
          onClick={() => setIsSettingsOpen(true)}
          title="Stock Dimensions & Global Defaults"
        >
          <IconSliders size={13} />
          <span>Stock Settings</span>
        </button>

        <button
          class="btn-secondary"
          onClick={() => setIsGcodeModalOpen(true)}
          title="View G-Code Text"
        >
          <IconCode size={13} />
          <span>G-Code</span>
        </button>

        <button
          class={`btn-action btn-copy ${copyToast() ? "copied" : ""}`}
          onClick={handleCopyGcode}
          title="Copy generated G-Code to clipboard"
        >
          <Show
            when={copyToast()}
            fallback={
              <>
                <IconCopy size={13} />
                <span>Copy G-Code</span>
              </>
            }
          >
            <IconCheck size={13} />
            <span>Copied!</span>
          </Show>
        </button>

        <button
          class="btn-primary btn-export"
          onClick={handleExportGcode}
          title="Download .nc / .gcode file"
        >
          <IconDownload size={13} />
          <span>Export G-Code</span>
        </button>
      </div>
    </header>
  );
}
