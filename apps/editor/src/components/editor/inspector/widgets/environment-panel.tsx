"use client";

import { useCallback } from "react";
import { useEditorStore } from "@/stores/hooks";
import { editorStore } from "@/stores/editor-store";
import { generateOpId } from "@riff3d/ecson";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import type { PatchOp } from "@riff3d/patchops";
import { ColorPicker } from "./color-picker";
import { SliderField } from "./slider-field";
import { DropdownField } from "./dropdown-field";
import { CheckboxField } from "./checkbox-field";

/**
 * Dispatch a SetProperty PatchOp for an environment property.
 * Uses a special entityId of "__environment__" to signal that
 * this targets the document environment rather than an entity.
 *
 * The PatchOps engine handles environment paths (environment.*)
 * by mutating ecsonDoc.environment directly.
 */
function dispatchEnvironmentOp(
  path: string,
  value: unknown,
  previousValue: unknown,
): void {
  const op: PatchOp = {
    id: generateOpId(),
    timestamp: Date.now(),
    origin: "user",
    version: CURRENT_PATCHOP_VERSION,
    type: "SetProperty",
    payload: {
      entityId: "__environment__",
      path,
      value,
      previousValue,
    },
  };
  editorStore.getState().dispatchOp(op);
}

// ─── Sub-components ───────────────────────────────────────────────────

function EnvironmentSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--panel)] p-2">
      <h5 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        {title}
      </h5>
      {children}
    </div>
  );
}

function EnvironmentColor({
  label,
  path,
  value,
}: {
  label: string;
  path: string;
  value: string;
}) {
  const handleChange = useCallback(
    (newValue: string) => {
      dispatchEnvironmentOp(path, newValue, value);
    },
    [path, value],
  );

  return <ColorPicker label={label} value={value} onChange={handleChange} />;
}

function EnvironmentSlider({
  label,
  path,
  value,
  min,
  max,
  step,
}: {
  label: string;
  path: string;
  value: number;
  min: number;
  max: number;
  step: number;
}) {
  const handleChange = useCallback(
    (newValue: number) => {
      dispatchEnvironmentOp(path, newValue, value);
    },
    [path, value],
  );

  return (
    <SliderField
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={handleChange}
    />
  );
}

function EnvironmentDropdown({
  label,
  path,
  value,
  options,
}: {
  label: string;
  path: string;
  value: string;
  options: string[];
}) {
  const handleChange = useCallback(
    (newValue: string) => {
      dispatchEnvironmentOp(path, newValue, value);
    },
    [path, value],
  );

  return (
    <DropdownField
      label={label}
      value={value}
      options={options}
      onChange={handleChange}
    />
  );
}

function EnvironmentCheckbox({
  label,
  path,
  value,
}: {
  label: string;
  path: string;
  value: boolean;
}) {
  const handleChange = useCallback(
    (newValue: boolean) => {
      dispatchEnvironmentOp(path, newValue, value);
    },
    [path, value],
  );

  return <CheckboxField label={label} value={value} onChange={handleChange} />;
}

/**
 * Environment settings editor panel.
 *
 * Shown in the inspector when no entity is selected. Allows editing:
 * - Ambient light: color + intensity
 * - Fog: enabled toggle, type dropdown, color, density/start/end
 * - Sky: solid color (image-based skybox marked "coming soon")
 *
 * Each change dispatches a SetProperty PatchOp targeting the
 * environment path of the ECSON document. Changes flow through
 * PatchOps -> ECSON -> IR recompile -> adapter applyEnvironment().
 */
export function EnvironmentPanel() {
  const ecsonDoc = useEditorStore((s) => s.ecsonDoc);

  if (!ecsonDoc) return null;

  const env = ecsonDoc.environment;

  return (
    <div className="space-y-4 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        Environment
      </h4>

      {/* Ambient Light */}
      <EnvironmentSection title="Ambient Light">
        <EnvironmentColor
          label="Color"
          path="environment.ambientLight.color"
          value={env.ambientLight.color}
        />
        <EnvironmentSlider
          label="Intensity"
          path="environment.ambientLight.intensity"
          value={env.ambientLight.intensity}
          min={0}
          max={3}
          step={0.05}
        />
      </EnvironmentSection>

      {/* Sky */}
      <EnvironmentSection title="Sky">
        <EnvironmentColor
          label="Color"
          path="environment.skybox.color"
          value={env.skybox.color ?? "#1a1a2e"}
        />
        <div className="px-1 text-[10px] italic text-[var(--muted-foreground)]">
          Image-based skybox coming soon
        </div>
      </EnvironmentSection>

      {/* Fog */}
      <EnvironmentSection title="Fog">
        <EnvironmentCheckbox
          label="Enabled"
          path="environment.fog.enabled"
          value={env.fog.enabled}
        />
        {env.fog.enabled && (
          <>
            <EnvironmentDropdown
              label="Type"
              path="environment.fog.type"
              value={env.fog.type}
              options={["linear", "exponential", "exponential2"]}
            />
            <EnvironmentColor
              label="Color"
              path="environment.fog.color"
              value={env.fog.color}
            />
            {env.fog.type === "linear" ? (
              <>
                <EnvironmentSlider
                  label="Near"
                  path="environment.fog.near"
                  value={env.fog.near}
                  min={0}
                  max={500}
                  step={1}
                />
                <EnvironmentSlider
                  label="Far"
                  path="environment.fog.far"
                  value={env.fog.far}
                  min={0}
                  max={1000}
                  step={1}
                />
              </>
            ) : (
              <EnvironmentSlider
                label="Density"
                path="environment.fog.density"
                value={env.fog.density}
                min={0}
                max={1}
                step={0.001}
              />
            )}
          </>
        )}
      </EnvironmentSection>
    </div>
  );
}
