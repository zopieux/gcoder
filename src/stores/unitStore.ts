import { createSignal } from "solid-js";

/**
 * Global signal for temporarily previewing values in inches.
 * Activated while holding Ctrl+Shift anywhere in the application.
 */
export const [showInches, setShowInches] = createSignal(false);

if (typeof window !== "undefined") {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey) {
      setShowInches(true);
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Control" || e.key === "Shift" || !e.ctrlKey || !e.shiftKey) {
      setShowInches(false);
    }
  };

  const handleBlur = () => {
    setShowInches(false);
  };

  window.addEventListener("keydown", handleKeyDown, { passive: true });
  window.addEventListener("keyup", handleKeyUp, { passive: true });
  window.addEventListener("blur", handleBlur);
}
