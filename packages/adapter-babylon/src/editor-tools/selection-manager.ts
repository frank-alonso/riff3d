import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { PBRMetallicRoughnessMaterial } from "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial";

/**
 * Store interface expected by BabylonSelectionManager.
 * Minimal interface to avoid coupling adapter to full editor store.
 */
export interface BabylonSelectionStoreApi {
  getState(): {
    selectedEntityIds: string[];
  };
  subscribe(listener: (state: {
    selectedEntityIds: string[];
  }, prevState: {
    selectedEntityIds: string[];
  }) => void): () => void;
}

/**
 * Callback for setting the selection in the editor store.
 */
export type BabylonSetSelectionCallback = (ids: string[]) => void;

/**
 * Selection manager for the Babylon.js validation adapter.
 *
 * Provides basic click-to-select functionality using Babylon's built-in
 * ray-casting scene.pick(). This is simpler than the PlayCanvas adapter's
 * screen-projection approach because Babylon provides first-class picking.
 *
 * Features:
 * - Click to select (single entity)
 * - Shift+click to toggle in multi-selection
 * - Click empty space to deselect
 * - Emissive highlight on selected entities (matching PlayCanvas pattern)
 *
 * Intentionally omitted (validation adapter, not primary):
 * - Box/marquee selection
 * - Selection rectangle overlay
 *
 * Architecture note: This module is an editor interaction tool, tracked
 * separately from the core adapter LoC budget per the approved exception.
 */
export class BabylonSelectionManager {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private entityMap: Map<string, TransformNode>;
  private setSelection: BabylonSetSelectionCallback;
  private store: BabylonSelectionStoreApi;

  // Reverse map: mesh uniqueId -> ECSON entity ID (for fast pick lookup)
  private meshToEntityId: Map<number, string> = new Map();

  // Highlight state
  private highlightedEntities = new Set<string>();
  private static readonly HIGHLIGHT_COLOR = new Color3(0.3, 0.5, 1);
  private static readonly ORIGINAL_EMISSIVE_KEY = "__riff3d_originalEmissive";

  // Event handlers for cleanup
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private unsubscribers: Array<() => void> = [];

  constructor(
    scene: Scene,
    canvas: HTMLCanvasElement,
    entityMap: Map<string, TransformNode>,
    setSelection: BabylonSetSelectionCallback,
    store: BabylonSelectionStoreApi,
  ) {
    this.scene = scene;
    this.canvas = canvas;
    this.entityMap = entityMap;
    this.setSelection = setSelection;
    this.store = store;
  }

  /**
   * Initialize the selection manager.
   * Builds the mesh -> entity ID reverse map and binds pointer events.
   */
  initialize(): void {
    // Build reverse lookup
    this.rebuildMeshMap();

    // Bind pointer down for click selection
    this.boundPointerDown = (e: PointerEvent) => this.onPointerDown(e);
    this.canvas.addEventListener("pointerdown", this.boundPointerDown);

    // Subscribe to store selection changes for highlight sync
    const unsub = this.store.subscribe((newState, prevState) => {
      if (newState.selectedEntityIds !== prevState.selectedEntityIds) {
        this.updateHighlights(newState.selectedEntityIds);
      }
    });
    this.unsubscribers.push(unsub);

    // Apply initial highlights
    const state = this.store.getState();
    if (state.selectedEntityIds.length > 0) {
      this.updateHighlights(state.selectedEntityIds);
    }
  }

  /**
   * Handle pointer down for click-to-select.
   *
   * Uses Babylon's scene.pick() for ray-based entity picking.
   * Only handles left-click (button 0), skips Alt (camera control).
   */
  private onPointerDown(e: PointerEvent): void {
    // Only handle left-click
    if (e.button !== 0) return;
    // Skip if Alt is held (camera control)
    if (e.altKey) return;

    // Use Babylon's built-in picking
    const pickResult = this.scene.pick(
      e.offsetX,
      e.offsetY,
      (mesh) => {
        // Only pick meshes that are in our entity map
        return this.meshToEntityId.has(mesh.uniqueId);
      },
    );

    if (pickResult?.hit && pickResult.pickedMesh) {
      const entityId = this.findEntityId(pickResult.pickedMesh);
      if (entityId) {
        const currentSelection = this.store.getState().selectedEntityIds;
        if (e.shiftKey) {
          // Shift+click: toggle in selection
          if (currentSelection.includes(entityId)) {
            this.setSelection(currentSelection.filter((id) => id !== entityId));
          } else {
            this.setSelection([...currentSelection, entityId]);
          }
        } else {
          // Normal click: select only this entity
          this.setSelection([entityId]);
        }
        return;
      }
    }

    // Clicked empty space without shift: deselect all
    if (!e.shiftKey) {
      this.setSelection([]);
    }
  }

  /**
   * Find the ECSON entity ID for a picked mesh.
   * Walks up the parent chain to find the mapped entity.
   */
  private findEntityId(mesh: AbstractMesh): string | null {
    // Direct lookup
    const directId = this.meshToEntityId.get(mesh.uniqueId);
    if (directId) return directId;

    // Walk up parents (mesh might be a child of the mapped TransformNode)
    let parent = mesh.parent;
    while (parent) {
      if ("uniqueId" in parent) {
        const parentId = this.meshToEntityId.get(parent.uniqueId as number);
        if (parentId) return parentId;
      }
      parent = parent.parent;
    }

    return null;
  }

  /**
   * Build the reverse map from mesh uniqueId -> ECSON entity ID.
   */
  private rebuildMeshMap(): void {
    this.meshToEntityId.clear();
    for (const [entityId, node] of this.entityMap) {
      // Map the node itself
      this.meshToEntityId.set(node.uniqueId, entityId);

      // Map all child meshes too (component mappers may create sub-meshes)
      const meshes = node.getChildMeshes?.(false);
      if (meshes) {
        for (const mesh of meshes) {
          this.meshToEntityId.set(mesh.uniqueId, entityId);
        }
      }
    }
  }

  /**
   * Update visual highlights for selected entities.
   * Applies emissive color to PBR materials of selected entities.
   */
  private updateHighlights(selectedIds: string[]): void {
    const newSet = new Set(selectedIds);

    // Remove highlights from deselected entities
    for (const entityId of this.highlightedEntities) {
      if (!newSet.has(entityId)) {
        this.removeHighlight(entityId);
      }
    }

    // Add highlights to newly selected entities
    for (const entityId of selectedIds) {
      if (!this.highlightedEntities.has(entityId)) {
        this.applyHighlight(entityId);
      }
    }

    this.highlightedEntities = newSet;
  }

  /**
   * Apply selection highlight to an entity.
   */
  private applyHighlight(entityId: string): void {
    const node = this.entityMap.get(entityId);
    if (!node) return;

    // Get meshes for this entity
    const meshes = this.getMeshes(node);
    for (const mesh of meshes) {
      const mat = mesh.material;
      if (mat && "emissiveColor" in mat) {
        const pbrMat = mat as PBRMetallicRoughnessMaterial;
        // Store original emissive for restoration
        (pbrMat as unknown as Record<string, unknown>)[
          BabylonSelectionManager.ORIGINAL_EMISSIVE_KEY
        ] = pbrMat.emissiveColor?.clone();
        pbrMat.emissiveColor = BabylonSelectionManager.HIGHLIGHT_COLOR.clone();
      }
    }
  }

  /**
   * Remove selection highlight from an entity.
   */
  private removeHighlight(entityId: string): void {
    const node = this.entityMap.get(entityId);
    if (!node) return;

    const meshes = this.getMeshes(node);
    for (const mesh of meshes) {
      const mat = mesh.material;
      if (mat && "emissiveColor" in mat) {
        const pbrMat = mat as PBRMetallicRoughnessMaterial;
        const original = (pbrMat as unknown as Record<string, unknown>)[
          BabylonSelectionManager.ORIGINAL_EMISSIVE_KEY
        ];
        if (original instanceof Color3) {
          pbrMat.emissiveColor = original.clone();
        } else {
          pbrMat.emissiveColor = Color3.Black();
        }
        delete (pbrMat as unknown as Record<string, unknown>)[
          BabylonSelectionManager.ORIGINAL_EMISSIVE_KEY
        ];
      }
    }
  }

  /**
   * Get all meshes associated with a node (the node itself if it's a mesh,
   * plus any child meshes).
   */
  private getMeshes(node: TransformNode): AbstractMesh[] {
    const meshes: AbstractMesh[] = [];

    // Check if node itself is a mesh
    if ("getBoundingInfo" in node && "material" in node) {
      meshes.push(node as unknown as AbstractMesh);
    }

    // Get child meshes
    const children = node.getChildMeshes?.(false);
    if (children) {
      meshes.push(...children);
    }

    return meshes;
  }

  /**
   * Update the entity map reference (called after scene rebuild).
   */
  updateEntityMap(entityMap: Map<string, TransformNode>): void {
    this.highlightedEntities.clear();
    this.entityMap = entityMap;
    this.rebuildMeshMap();

    // Re-apply highlights for current selection
    const state = this.store.getState();
    if (state.selectedEntityIds.length > 0) {
      this.updateHighlights(state.selectedEntityIds);
    }
  }

  /**
   * Clean up event listeners and highlights.
   */
  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    if (this.boundPointerDown) {
      this.canvas.removeEventListener("pointerdown", this.boundPointerDown);
    }

    this.highlightedEntities.clear();
    this.meshToEntityId.clear();
  }
}
