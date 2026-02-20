/**
 * IRDelta -- incremental update types for engine adapters.
 *
 * Instead of rebuilding the entire scene, adapters can apply fine-grained
 * deltas to update individual nodes, components, or environment settings.
 * The `full-rebuild` variant is the fallback for structural changes that
 * cannot be expressed incrementally.
 *
 * These are pure TypeScript interfaces (no Zod schemas) because they are
 * runtime-only types used by the adapter hot path, not persisted or validated.
 */

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export type IRDelta =
  | {
      type: "node-transform";
      nodeId: string;
      transform: { position?: Vec3; rotation?: Quat; scale?: Vec3 };
    }
  | { type: "node-visibility"; nodeId: string; visible: boolean }
  | {
      type: "component-property";
      nodeId: string;
      componentIndex: number;
      property: string;
      value: unknown;
    }
  | { type: "environment"; path: string; value: unknown }
  | { type: "full-rebuild" };
