import * as pc from "playcanvas";
import type { CanonicalComponent, CanonicalNode } from "@riff3d/canonical-ir";
import { applyMeshRenderer } from "./mesh-renderer";
import { applyLight } from "./light";
import { applyCamera } from "./camera";

/**
 * Registry of component mappers that translate IR components to PlayCanvas.
 *
 * Each mapper function receives the PlayCanvas Application, the target
 * pc.Entity, the IR component, and the full IR node (for cross-component
 * references like MeshRenderer needing Material data).
 */
type ComponentMapper = (
  app: pc.Application,
  entity: pc.Entity,
  component: CanonicalComponent,
  node: CanonicalNode,
) => void;

const MAPPER_REGISTRY: Record<string, ComponentMapper> = {
  MeshRenderer: applyMeshRenderer,
  Light: (_app, entity, component) => applyLight(entity, component),
  Camera: (_app, entity, component) => applyCamera(entity, component),
  // Material is handled by MeshRenderer (it looks up the Material component
  // on the same node), so we skip it here to avoid double-processing.
  Material: () => {
    /* handled by MeshRenderer */
  },
};

/**
 * Apply all components from an IR node to a PlayCanvas entity.
 *
 * Components are applied in a specific order to handle dependencies:
 * MeshRenderer must run after Material is available on the node, but since
 * MeshRenderer reads Material from the node's components array directly,
 * the order of mapper calls doesn't matter.
 *
 * Unrecognized component types are silently skipped -- they may be
 * game-runtime components that don't have a visual representation.
 */
export function applyComponents(
  app: pc.Application,
  entity: pc.Entity,
  node: CanonicalNode,
): void {
  for (const component of node.components) {
    const mapper = MAPPER_REGISTRY[component.type];
    if (mapper) {
      mapper(app, entity, component, node);
    }
    // Unknown components are silently skipped.
    // They may be runtime-only (physics, triggers, etc.)
  }
}

export { applyMeshRenderer } from "./mesh-renderer";
export { applyLight } from "./light";
export { applyCamera } from "./camera";
export { createMaterial, hexToColor } from "./material";
