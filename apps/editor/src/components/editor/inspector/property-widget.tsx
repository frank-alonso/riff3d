"use client";

import type { EditorHint } from "@riff3d/ecson";
import { SliderField } from "./widgets/slider-field";
import { ColorPicker } from "./widgets/color-picker";
import { Vec3Input } from "./widgets/vec3-input";
import { CheckboxField } from "./widgets/checkbox-field";
import { DropdownField } from "./widgets/dropdown-field";
import { NumberField } from "./widgets/number-field";
import { TextboxField } from "./widgets/textbox-field";

interface PropertyWidgetProps {
  propName: string;
  hint: EditorHint;
  value: unknown;
  /** Enum options extracted from Zod schema for dropdown hints */
  enumOptions?: string[];
  onChange: (value: unknown) => void;
}

/**
 * Dispatcher component that maps EditorHint.editorHint type to the correct widget.
 *
 * Key link: Each widget calls onChange(newValue) which the ComponentInspector
 * wraps to dispatch a SetComponentProperty PatchOp.
 */
export function PropertyWidget({
  propName,
  hint,
  value,
  enumOptions,
  onChange,
}: PropertyWidgetProps) {
  const label = hint.label ?? propName;

  switch (hint.editorHint) {
    case "slider":
      return (
        <SliderField
          label={label}
          value={typeof value === "number" ? value : 0}
          min={hint.min}
          max={hint.max}
          step={hint.step}
          onChange={onChange}
        />
      );

    case "color":
      return (
        <ColorPicker
          label={label}
          value={typeof value === "string" ? value : "#000000"}
          onChange={onChange}
        />
      );

    case "vec3":
      return (
        <Vec3Input
          label={label}
          value={
            value && typeof value === "object" && "x" in value
              ? (value as { x: number; y: number; z: number })
              : { x: 0, y: 0, z: 0 }
          }
          onChange={onChange}
        />
      );

    case "checkbox":
      return (
        <CheckboxField
          label={label}
          value={typeof value === "boolean" ? value : false}
          onChange={onChange}
        />
      );

    case "dropdown":
      return (
        <DropdownField
          label={label}
          value={typeof value === "string" ? value : String(value ?? "")}
          options={enumOptions}
          onChange={onChange}
        />
      );

    case "number":
      return (
        <NumberField
          label={label}
          value={typeof value === "number" ? value : 0}
          min={hint.min}
          max={hint.max}
          step={hint.step}
          onChange={onChange}
        />
      );

    case "textbox":
      return (
        <TextboxField
          label={label}
          value={typeof value === "string" ? value : String(value ?? "")}
          onChange={onChange}
        />
      );

    case "asset-ref":
      return (
        <TextboxField
          label={label}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
        />
      );

    case "entity-ref":
      return (
        <TextboxField
          label={label}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
        />
      );

    case "entity-ref-list":
      return (
        <TextboxField
          label={label}
          value={Array.isArray(value) ? value.join(", ") : ""}
          onChange={onChange}
        />
      );

    case "array":
      return (
        <TextboxField
          label={label}
          value={Array.isArray(value) ? JSON.stringify(value) : "[]"}
          onChange={onChange}
        />
      );

    case "tags":
      return (
        <TextboxField
          label={label}
          value={Array.isArray(value) ? value.join(", ") : ""}
          onChange={(v) => {
            const str = typeof v === "string" ? v : "";
            onChange(
              str
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            );
          }}
        />
      );

    default:
      return (
        <TextboxField
          label={label}
          value={String(value ?? "")}
          onChange={onChange}
        />
      );
  }
}
