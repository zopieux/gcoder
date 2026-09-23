import { For, Show } from "solid-js";
import { currentGcode } from "../stores/projectStore";
import { IconAlertTriangle } from "./Icons";

export function WarningBanner() {
  const warnings = () => currentGcode().warnings;

  return (
    <Show when={warnings().length > 0}>
      <div class="warning-banner">
        <div class="warning-banner-icon">
          <IconAlertTriangle size={15} />
        </div>
        <div class="warning-banner-content">
          <div class="warning-banner-title">Toolpath Warnings:</div>
          <ul class="warning-banner-list">
            <For each={warnings()}>
              {(w) => <li class="warning-item">{w}</li>}
            </For>
          </ul>
        </div>
      </div>
    </Show>
  );
}
