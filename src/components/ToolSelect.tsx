import { getToolById, PREDEFINED_TOOLS } from "../types/tools";

interface ToolSelectProps {
  selectedId: string;
  onChange: (toolId: string) => void;
}

export function ToolSelect(props: ToolSelectProps) {
  const currentTool = () => getToolById(props.selectedId);

  return (
    <div class="tool-select-group">
      <label class="tool-select-label">Cutting Tool</label>
      <div class="tool-select-control">
        <select
          class="tool-select-dropdown"
          value={props.selectedId}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        >
          {PREDEFINED_TOOLS.map((t) => (
            <option value={t.id}>
              {t.name} ({t.diameterMm.toFixed(3)} mm)
            </option>
          ))}
        </select>

        <div class="tool-info-badge">
          <span class={`profile-tag profile-${currentTool().profile}`}>
            {currentTool().profile.toUpperCase()}
          </span>
          <span class="tool-dimensions">
            Ø {currentTool().diameterMm.toFixed(3)} mm
          </span>
        </div>
      </div>
    </div>
  );
}
