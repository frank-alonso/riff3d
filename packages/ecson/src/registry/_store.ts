import type { ComponentDefinition } from "./types";

/**
 * The component registry backing store.
 * Separated into its own module to avoid circular initialization issues
 * when component files import registerComponent from registry.ts.
 */
export const componentRegistry = new Map<string, ComponentDefinition>();
