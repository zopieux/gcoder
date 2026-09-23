import { createSignal, For, Show } from "solid-js";
import { addOperation, currentProject } from "../stores/projectStore";
import type { OpType } from "../types/project";
import {
  IconHole,
  IconPlus,
  IconPocket,
  IconProfiling,
  IconSurfacing,
  IconX,
} from "./Icons";
import { OperationCard } from "./OperationCard";

export function OperationList() {
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const ops = () => currentProject().operations;

  const handleAdd = (type: OpType) => {
    addOperation(type);
    setIsMenuOpen(false);
  };

  return (
    <div class="operation-list-container">
      <div class="operation-list-header">
        <h3 class="panel-heading">Operations ({ops().length})</h3>
        <span class="panel-hint">Executed top-to-bottom</span>
      </div>

      <div class="operation-cards-scroll">
        <Show
          when={ops().length > 0}
          fallback={
            <div class="empty-ops-state">
              <p>No operations yet.</p>
              <p class="empty-sub">Click below to add a machining feature.</p>
            </div>
          }
        >
          <For each={ops()}>
            {(op, index) => (
              <OperationCard op={op} index={index()} total={ops().length} />
            )}
          </For>
        </Show>
      </div>

      <div class="add-operation-section">
        <Show
          when={isMenuOpen()}
          fallback={
            <button class="btn-add-op" onClick={() => setIsMenuOpen(true)}>
              <IconPlus
                size={13}
                style={{ "margin-right": "6px", "vertical-align": "middle" }}
              />
              <span>Add Operation</span>
            </button>
          }
        >
          <div class="add-op-menu">
            <div class="add-op-menu-header">
              <span>Select Operation Type</span>
              <button
                class="btn-tiny"
                onClick={() => setIsMenuOpen(false)}
                title="Close"
              >
                <IconX size={12} />
              </button>
            </div>
            <div class="add-op-menu-buttons">
              <button
                class="btn-op-type"
                onClick={() => handleAdd("surfacing")}
              >
                <span class="type-icon">
                  <IconSurfacing size={16} />
                </span>
                <div class="type-meta">
                  <strong>Rect Surfacing</strong>
                  <span>Face top surface to flat depth</span>
                </div>
              </button>

              <button
                class="btn-op-type"
                onClick={() => handleAdd("profiling")}
              >
                <span class="type-icon">
                  <IconProfiling size={16} />
                </span>
                <div class="type-meta">
                  <strong>Rect Profiling</strong>
                  <span>Cut outer contour or inside slot</span>
                </div>
              </button>

              <button class="btn-op-type" onClick={() => handleAdd("pocket")}>
                <span class="type-icon">
                  <IconPocket size={16} />
                </span>
                <div class="type-meta">
                  <strong>Pocketing</strong>
                  <span>Hollow out rectangular cavity</span>
                </div>
              </button>

              <button class="btn-op-type" onClick={() => handleAdd("hole")}>
                <span class="type-icon">
                  <IconHole size={16} />
                </span>
                <div class="type-meta">
                  <strong>Hole Drilling</strong>
                  <span>Plunge, peck, or circular bore</span>
                </div>
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
