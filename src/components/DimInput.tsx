import { createEffect, createMemo, createSignal } from "solid-js";
import { parseExpression } from "../lib/exprParser";
import { showInches } from "../stores/unitStore";
import { IconAlertTriangle } from "./Icons";

interface DimInputProps {
  label: string;
  value: string | number;
  onChange: (newValue: string) => void;
  placeholder?: string;
  tooltip?: string;
  min?: number;
  max?: number;
  allowUnits?: boolean; // Defaults to true
  unitSuffix?: string; // Optional unit preview e.g. "RPM"
}

export function DimInput(props: DimInputProps) {
  const [localValue, setLocalValue] = createSignal(String(props.value ?? ""));
  const [isFocused, setIsFocused] = createSignal(false);
  const allowUnits = () => props.allowUnits ?? true;

  // Sync external changes
  createEffect(() => {
    setLocalValue(String(props.value ?? ""));
  });

  const parsed = createMemo(() =>
    parseExpression(localValue(), { allowUnits: allowUnits() }),
  );

  const handleBlur = () => {
    setIsFocused(false);
    if (!parsed().error && localValue() !== String(props.value)) {
      props.onChange(localValue());
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div class="dim-input-group">
      <div class="dim-input-header">
        <label class="dim-input-label">{props.label}</label>
        <span
          class={`dim-input-preview ${parsed().error ? "dim-error" : "dim-valid"}`}
          title={
            parsed().error ||
            (allowUnits()
              ? showInches()
                ? parsed().formattedIn
                : parsed().formattedMm
              : parsed().formatted)
          }
        >
          {parsed().error ? (
            <span class="error-badge">
              <IconAlertTriangle
                size={11}
                style={{
                  "margin-right": "3px",
                  "vertical-align": "text-bottom",
                }}
              />
              {parsed().error}
            </span>
          ) : (
            <span class="preview-text">
              <span class="mm-val">
                {allowUnits()
                  ? showInches()
                    ? parsed().formattedIn
                    : parsed().formattedMm
                  : `${parsed().formatted}${props.unitSuffix ? ` ${props.unitSuffix}` : ""}`}
              </span>
            </span>
          )}
        </span>
      </div>

      <div
        class={`dim-input-wrapper ${parsed().error ? "has-error" : ""} ${isFocused() ? "is-focused" : ""}`}
      >
        <input
          type="text"
          class="dim-input-field"
          value={localValue()}
          placeholder={
            props.placeholder ||
            (allowUnits() ? "e.g. 1/4in or 10mm" : "e.g. 12000 or 12*1000")
          }
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onInput={(e) => {
            setLocalValue(e.currentTarget.value);
            const p = parseExpression(e.currentTarget.value, {
              allowUnits: allowUnits(),
            });
            if (!p.error) {
              props.onChange(e.currentTarget.value);
            }
          }}
          onKeyDown={handleKeyDown}
        />
      </div>
      {props.tooltip && <p class="dim-input-tooltip">{props.tooltip}</p>}
    </div>
  );
}
