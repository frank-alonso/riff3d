import { z } from "zod";

/**
 * Editor hint types that map to inspector panel widgets.
 * Each hint tells the editor what UI widget to render for a property.
 */
export interface EditorHint {
  editorHint:
    | "dropdown"
    | "color"
    | "slider"
    | "checkbox"
    | "number"
    | "textbox"
    | "vec3"
    | "asset-ref"
    | "entity-ref"
    | "entity-ref-list"
    | "array"
    | "tags";
  label?: string;
  /** Minimum value for slider/number hints */
  min?: number;
  /** Maximum value for slider/number hints */
  max?: number;
  /** Step increment for slider hints */
  step?: number;
  /** Asset type for asset-ref hints */
  assetType?: string;
}

/**
 * An event that a component can emit.
 */
export interface ComponentEvent {
  name: string;
  label: string;
}

/**
 * An action that a component can receive.
 */
export interface ComponentAction {
  name: string;
  label: string;
}

/**
 * A component definition registered in the component registry.
 *
 * Each definition declares the component's type key, category, schema (for validation),
 * editor hints (for inspector auto-generation), and optional events/actions.
 */
export interface ComponentDefinition {
  /** Registry key, e.g. 'Light', 'MeshRenderer' */
  type: string;
  /** Category for grouping in the editor panel */
  category:
    | "rendering"
    | "physics"
    | "audio"
    | "gameplay"
    | "logic"
    | "settings";
  /** Human-readable description of the component */
  description: string;
  /** If true, at most one instance per entity */
  singleton: boolean;
  /** Zod schema for validating component properties */
  schema: z.ZodType;
  /** Editor hints keyed by property name */
  editorHints: Record<string, EditorHint>;
  /** Events this component can emit */
  events?: ComponentEvent[];
  /** Actions this component can receive */
  actions?: ComponentAction[];
}
