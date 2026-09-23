import { onCleanup, onMount } from "solid-js";
import { GcodeModal } from "./components/GcodeModal";
import { GlobalSettingsModal } from "./components/GlobalSettingsModal";
import { Header } from "./components/Header";
import { OperationList } from "./components/OperationList";
import { OperationParamsPane } from "./components/OperationParamsPane";
import { Preview3D } from "./components/Preview3D";
import { ProjectDialog } from "./components/ProjectDialog";
import { WarningBanner } from "./components/WarningBanner";
import { performRedo, performUndo } from "./stores/projectStore";

export function App() {
  // Global keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "z"
      ) {
        e.preventDefault();
        performUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          e.key.toLowerCase() === "z") ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        performRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  return (
    <div class="app-layout">
      <Header />
      <WarningBanner />

      <main class="main-workspace">
        {/* Left Column: Operations List */}
        <aside class="sidebar-operations">
          <OperationList />
        </aside>

        {/* Center Column: Parameters for Selected Operation */}
        <section class="center-params">
          <OperationParamsPane />
        </section>

        {/* Right Column: 3D WebGL CSG Preview */}
        <section class="preview-panel">
          <Preview3D />
        </section>
      </main>

      {/* Modals */}
      <ProjectDialog />
      <GlobalSettingsModal />
      <GcodeModal />
    </div>
  );
}
