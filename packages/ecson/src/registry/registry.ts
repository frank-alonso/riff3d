import { z } from "zod";
import type { ComponentDefinition } from "./types.js";
import { componentRegistry } from "./_store.js";

/**
 * Register a component definition.
 * @throws Error if a component with the same type is already registered.
 */
export function registerComponent(def: ComponentDefinition): void {
  if (componentRegistry.has(def.type)) {
    throw new Error(
      `Component type '${def.type}' is already registered. Duplicate registration is not allowed.`,
    );
  }
  componentRegistry.set(def.type, def);
}

/**
 * Look up a component definition by type string.
 */
export function getComponentDef(
  type: string,
): ComponentDefinition | undefined {
  return componentRegistry.get(type);
}

/**
 * Validate a set of properties against a component's Zod schema.
 * Returns a Zod SafeParseReturnType (success/failure with errors).
 */
export function validateComponentProperties(
  type: string,
  properties: Record<string, unknown>,
): z.SafeParseReturnType<unknown, unknown> {
  const def = componentRegistry.get(type);
  if (!def) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: "custom",
          path: [],
          message: `Unknown component type: '${type}'`,
        },
      ]),
    } as z.SafeParseReturnType<unknown, unknown>;
  }
  return def.schema.safeParse(properties);
}

/**
 * List all registered component definitions.
 */
export function listComponents(): ComponentDefinition[] {
  return Array.from(componentRegistry.values());
}

/**
 * List components filtered by category.
 */
export function listComponentsByCategory(
  category: string,
): ComponentDefinition[] {
  return Array.from(componentRegistry.values()).filter(
    (def) => def.category === category,
  );
}

// Import all components to trigger self-registration side effects.
// This must come after the function declarations above.
import "./components/index.js";

export { componentRegistry };
