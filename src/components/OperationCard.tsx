import {
  duplicateOperation,
  removeOperation,
  reorderOperations,
  selectedOpId,
  setSelectedOpId,
  toggleOperation,
} from "../stores/projectStore";
import type { Operation, OpType } from "../types/project";
import { getToolById } from "../types/tools";
import {
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconCutter,
  IconGear,
  IconHole,
  IconPocket,
  IconProfiling,
  IconSurfacing,
  IconTrash,
} from "./Icons";

interface OperationCardProps {
  op: Operation;
  index: number;
  total: number;
}

function RenderTypeIcon(props: { type: OpType }) {
  switch (props.type) {
    case "surfacing":
      return <IconSurfacing size={15} />;
    case "profiling":
      return <IconProfiling size={15} />;
    case "pocket":
      return <IconPocket size={15} />;
    case "hole":
      return <IconHole size={15} />;
    default:
      return <IconGear size={15} />;
  }
}

export function OperationCard(props: OperationCardProps) {
  const isSelected = () => selectedOpId() === props.op.id;
  const tool = () => getToolById(props.op.toolId);

  return (
    <div
      class={`op-card ${isSelected() ? "op-selected" : ""} ${!props.op.enabled ? "op-disabled" : ""}`}
      onClick={() => setSelectedOpId(props.op.id)}
    >
      <div class="op-card-header">
        <div class="op-header-left">
          <input
            type="checkbox"
            class="op-toggle-checkbox"
            checked={props.op.enabled}
            onClick={(e) => {
              e.stopPropagation();
              toggleOperation(props.op.id);
            }}
            title={props.op.enabled ? "Disable operation" : "Enable operation"}
          />
          <span class="op-type-icon">
            <RenderTypeIcon type={props.op.type} />
          </span>
          <span class="op-title">{props.op.name}</span>
        </div>

        <div class="op-card-actions" onClick={(e) => e.stopPropagation()}>
          <button
            class="btn-tiny"
            disabled={props.index === 0}
            onClick={() => reorderOperations(props.index, props.index - 1)}
            title="Move Up"
          >
            <IconChevronUp size={11} />
          </button>
          <button
            class="btn-tiny"
            disabled={props.index === props.total - 1}
            onClick={() => reorderOperations(props.index, props.index + 1)}
            title="Move Down"
          >
            <IconChevronDown size={11} />
          </button>
          <button
            class="btn-tiny"
            onClick={() => duplicateOperation(props.op.id)}
            title="Duplicate"
          >
            <IconCopy size={11} />
          </button>
          <button
            class="btn-tiny btn-tiny-danger"
            onClick={() => removeOperation(props.op.id)}
            title="Delete"
          >
            <IconTrash size={11} />
          </button>
        </div>
      </div>

      <div class="op-card-footer">
        <span class="op-badge-type">{props.op.type}</span>
        <span class="op-tool-indicator">
          <IconCutter
            size={11}
            style={{ "margin-right": "4px", "vertical-align": "middle" }}
          />
          {tool().name}
        </span>
      </div>
    </div>
  );
}
