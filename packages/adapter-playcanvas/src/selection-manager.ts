import * as pc from "playcanvas";

/**
 * Store interface expected by SelectionManager.
 * Minimal interface to avoid coupling adapter to full editor store.
 */
export interface SelectionStoreApi {
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
export type SetSelectionCallback = (ids: string[]) => void;

/**
 * SelectionManager handles entity picking in the viewport.
 *
 * Supports three selection modes:
 * 1. **Click selection** -- Click to select one entity (deselects others).
 * 2. **Shift+click** -- Toggle entity in/out of multi-selection.
 * 3. **Box/marquee selection** -- Drag to draw a rectangle, select all entities within.
 *
 * Selection visual feedback:
 * - Selected entities are tracked in the editor store
 * - Visual highlight is applied via render component tint
 *
 * Entity picking uses frustum-based screen-space projection: all entity bounding
 * boxes are projected to screen space, and the click/rectangle is tested against
 * those projected bounds. This avoids framebuffer-based picking overhead.
 *
 * The selection rectangle overlay is a CSS-based div (not Canvas-drawn) to avoid
 * WebGL state conflicts.
 */
export class SelectionManager {
  private app: pc.Application;
  private cameraEntity: pc.Entity;
  private entityMap: Map<string, pc.Entity>;
  private setSelection: SetSelectionCallback;
  private store: SelectionStoreApi;

  // Mouse state for click vs drag detection
  private mouseDownPos: { x: number; y: number } | null = null;
  private mouseDownTime = 0;
  private isDragging = false;

  // Box selection overlay
  private selectionRect: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;

  // Highlight state
  private highlightedEntities = new Set<string>();

  // Selection highlight color
  private static readonly HIGHLIGHT_COLOR = new pc.Color(0.3, 0.5, 1, 1);
  private static readonly ORIGINAL_TINT_KEY = "__originalTint";

  // Click vs drag threshold
  private static readonly CLICK_DISTANCE_THRESHOLD = 5; // pixels
  private static readonly CLICK_TIME_THRESHOLD = 300; // ms

  // Bound event handlers for cleanup
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: ((e: MouseEvent) => void) | null = null;

  private unsubscribers: Array<() => void> = [];

  constructor(
    app: pc.Application,
    cameraEntity: pc.Entity,
    entityMap: Map<string, pc.Entity>,
    setSelection: SetSelectionCallback,
    store: SelectionStoreApi,
  ) {
    this.app = app;
    this.cameraEntity = cameraEntity;
    this.entityMap = entityMap;
    this.setSelection = setSelection;
    this.store = store;
  }

  /**
   * Initialize the selection manager. Binds mouse events to the canvas.
   */
  initialize(): void {
    const graphicsCanvas = this.app.graphicsDevice.canvas;
    if (!(graphicsCanvas instanceof HTMLCanvasElement)) return;
    this.canvas = graphicsCanvas;

    // Bind event handlers
    this.boundMouseDown = (e: MouseEvent) => this.onMouseDown(e);
    this.boundMouseMove = (e: MouseEvent) => this.onMouseMove(e);
    this.boundMouseUp = (e: MouseEvent) => this.onMouseUp(e);
    this.canvas.addEventListener("mousedown", this.boundMouseDown);
    this.canvas.addEventListener("mousemove", this.boundMouseMove);
    this.canvas.addEventListener("mouseup", this.boundMouseUp);

    // Create the selection rectangle overlay element
    this.createSelectionRectOverlay();

    // Subscribe to selection changes for highlight updates
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
   * Create the CSS-based selection rectangle overlay div.
   */
  private createSelectionRectOverlay(): void {
    if (!this.canvas) return;

    this.selectionRect = document.createElement("div");
    this.selectionRect.style.position = "absolute";
    this.selectionRect.style.border = "1px dashed rgba(100, 150, 255, 0.8)";
    this.selectionRect.style.backgroundColor = "rgba(100, 150, 255, 0.15)";
    this.selectionRect.style.pointerEvents = "none";
    this.selectionRect.style.display = "none";
    this.selectionRect.style.zIndex = "10";

    // Insert into canvas parent
    const parent = this.canvas.parentElement;
    if (parent) {
      parent.style.position = "relative";
      parent.appendChild(this.selectionRect);
    }
  }

  private onMouseDown(e: MouseEvent): void {
    // Only handle left-click
    if (e.button !== 0) return;
    // Skip if Alt is held (camera control)
    if (e.altKey) return;

    this.mouseDownPos = { x: e.clientX, y: e.clientY };
    this.mouseDownTime = Date.now();
    this.isDragging = false;
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.mouseDownPos) return;
    if (e.altKey) return;

    const dx = e.clientX - this.mouseDownPos.x;
    const dy = e.clientY - this.mouseDownPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > SelectionManager.CLICK_DISTANCE_THRESHOLD) {
      this.isDragging = true;
      this.updateSelectionRect(e);
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (!this.mouseDownPos) return;
    if (e.button !== 0) return;

    const elapsed = Date.now() - this.mouseDownTime;
    const dx = e.clientX - this.mouseDownPos.x;
    const dy = e.clientY - this.mouseDownPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (
      !this.isDragging &&
      distance < SelectionManager.CLICK_DISTANCE_THRESHOLD &&
      elapsed < SelectionManager.CLICK_TIME_THRESHOLD
    ) {
      // Click selection
      this.handleClickSelect(e);
    } else if (this.isDragging) {
      // Box selection
      this.handleBoxSelect(e);
    }

    // Reset state
    this.mouseDownPos = null;
    this.isDragging = false;
    this.hideSelectionRect();
  }

  /**
   * Handle single click selection.
   * Projects all entity bounding boxes to screen and finds the closest one.
   */
  private handleClickSelect(e: MouseEvent): void {
    if (!this.canvas) return;

    const canvasRect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - canvasRect.left;
    const clickY = e.clientY - canvasRect.top;

    const camera = this.cameraEntity.camera;
    if (!camera) return;

    // Find the closest entity under the click
    let closestId: string | null = null;
    let closestDist = Infinity;

    for (const [entityId, pcEntity] of this.entityMap) {
      // Skip entities without render components (lights, empty groups, etc.)
      if (!pcEntity.render && !pcEntity.model) continue;

      const screenPos = this.projectEntityToScreen(pcEntity);
      if (!screenPos) continue;

      // Check if click is within projected bounding area
      const dx = clickX - screenPos.centerX;
      const dy = clickY - screenPos.centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Use the bounding radius for hit test
      if (dist <= screenPos.radius && screenPos.depth < closestDist) {
        closestId = entityId;
        closestDist = screenPos.depth;
      }
    }

    const currentSelection = this.store.getState().selectedEntityIds;

    if (closestId) {
      if (e.shiftKey) {
        // Shift+click: toggle in selection
        if (currentSelection.includes(closestId)) {
          this.setSelection(currentSelection.filter((id) => id !== closestId));
        } else {
          this.setSelection([...currentSelection, closestId]);
        }
      } else {
        // Normal click: select only this entity
        this.setSelection([closestId]);
      }
    } else if (!e.shiftKey) {
      // Click on empty space without shift: deselect all
      this.setSelection([]);
    }
  }

  /**
   * Handle box/marquee selection.
   */
  private handleBoxSelect(e: MouseEvent): void {
    if (!this.canvas || !this.mouseDownPos) return;

    const canvasRect = this.canvas.getBoundingClientRect();

    // Compute selection rectangle in canvas-relative coordinates
    const x1 = Math.min(this.mouseDownPos.x, e.clientX) - canvasRect.left;
    const y1 = Math.min(this.mouseDownPos.y, e.clientY) - canvasRect.top;
    const x2 = Math.max(this.mouseDownPos.x, e.clientX) - canvasRect.left;
    const y2 = Math.max(this.mouseDownPos.y, e.clientY) - canvasRect.top;

    const selectedIds: string[] = [];

    for (const [entityId, pcEntity] of this.entityMap) {
      if (!pcEntity.render && !pcEntity.model) continue;

      const screenPos = this.projectEntityToScreen(pcEntity);
      if (!screenPos) continue;

      // Check if entity center is within the selection rectangle
      if (
        screenPos.centerX >= x1 &&
        screenPos.centerX <= x2 &&
        screenPos.centerY >= y1 &&
        screenPos.centerY <= y2
      ) {
        selectedIds.push(entityId);
      }
    }

    if (e.shiftKey) {
      // Shift: add to current selection
      const current = this.store.getState().selectedEntityIds;
      const merged = new Set([...current, ...selectedIds]);
      this.setSelection([...merged]);
    } else {
      this.setSelection(selectedIds);
    }
  }

  /**
   * Project an entity's world position to screen space.
   * Returns the screen-space center, bounding radius, and depth.
   */
  private projectEntityToScreen(pcEntity: pc.Entity): {
    centerX: number;
    centerY: number;
    radius: number;
    depth: number;
  } | null {
    const camera = this.cameraEntity.camera;
    if (!camera || !this.canvas) return null;

    const worldPos = pcEntity.getPosition();

    // Project world position to screen
    const screenPos = new pc.Vec3();
    camera.worldToScreen(worldPos, screenPos);

    // Check if behind camera (z < 0)
    if (screenPos.z < 0) return null;

    // Compute approximate screen-space bounding radius
    // Use entity scale as a rough size estimate
    const scale = pcEntity.getLocalScale();
    const maxScale = Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));

    // Project a point offset by maxScale to estimate screen radius
    const offsetPos = worldPos.clone().add(
      new pc.Vec3(maxScale * 0.5, 0, 0),
    );
    const offsetScreen = new pc.Vec3();
    camera.worldToScreen(offsetPos, offsetScreen);

    const radius = Math.max(
      20, // Minimum clickable radius
      Math.abs(offsetScreen.x - screenPos.x) * 2,
    );

    return {
      centerX: screenPos.x,
      centerY: screenPos.y,
      radius,
      depth: screenPos.z,
    };
  }

  /**
   * Update the selection rectangle overlay position/size.
   */
  private updateSelectionRect(e: MouseEvent): void {
    if (!this.selectionRect || !this.mouseDownPos || !this.canvas) return;

    const canvasRect = this.canvas.getBoundingClientRect();

    const x1 = Math.min(this.mouseDownPos.x, e.clientX) - canvasRect.left;
    const y1 = Math.min(this.mouseDownPos.y, e.clientY) - canvasRect.top;
    const width = Math.abs(e.clientX - this.mouseDownPos.x);
    const height = Math.abs(e.clientY - this.mouseDownPos.y);

    this.selectionRect.style.display = "block";
    this.selectionRect.style.left = `${x1}px`;
    this.selectionRect.style.top = `${y1}px`;
    this.selectionRect.style.width = `${width}px`;
    this.selectionRect.style.height = `${height}px`;
  }

  /**
   * Hide the selection rectangle overlay.
   */
  private hideSelectionRect(): void {
    if (this.selectionRect) {
      this.selectionRect.style.display = "none";
    }
  }

  /**
   * Update visual highlights for selected entities.
   * Applies a tint to render components of selected entities.
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
    const pcEntity = this.entityMap.get(entityId);
    if (!pcEntity) return;

    // Apply tint to render component meshInstances
    const render = pcEntity.render;
    if (render?.meshInstances) {
      for (const mi of render.meshInstances) {
        const mat = mi.material;
        if (mat && "diffuse" in mat) {
          const stdMat = mat as pc.StandardMaterial;
          // Store original emissive for restoration
          (stdMat as unknown as Record<string, unknown>)[SelectionManager.ORIGINAL_TINT_KEY] = stdMat.emissive.clone();
          stdMat.emissive.copy(SelectionManager.HIGHLIGHT_COLOR);
          stdMat.update();
        }
      }
    }
  }

  /**
   * Remove selection highlight from an entity.
   */
  private removeHighlight(entityId: string): void {
    const pcEntity = this.entityMap.get(entityId);
    if (!pcEntity) return;

    const render = pcEntity.render;
    if (render?.meshInstances) {
      for (const mi of render.meshInstances) {
        const mat = mi.material;
        if (mat && "diffuse" in mat) {
          const stdMat = mat as pc.StandardMaterial;
          const original = (stdMat as unknown as Record<string, unknown>)[SelectionManager.ORIGINAL_TINT_KEY];
          if (original instanceof pc.Color) {
            stdMat.emissive.copy(original);
            stdMat.update();
          }
          delete (stdMat as unknown as Record<string, unknown>)[SelectionManager.ORIGINAL_TINT_KEY];
        }
      }
    }
  }

  /**
   * Update the entity map reference (called after scene rebuild).
   */
  updateEntityMap(entityMap: Map<string, pc.Entity>): void {
    // Clear old highlights (entities may have been destroyed)
    this.highlightedEntities.clear();
    this.entityMap = entityMap;

    // Re-apply highlights for current selection
    const state = this.store.getState();
    if (state.selectedEntityIds.length > 0) {
      this.updateHighlights(state.selectedEntityIds);
    }
  }

  /**
   * Clean up event listeners and DOM elements.
   */
  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    if (this.canvas) {
      if (this.boundMouseDown) this.canvas.removeEventListener("mousedown", this.boundMouseDown);
      if (this.boundMouseMove) this.canvas.removeEventListener("mousemove", this.boundMouseMove);
      if (this.boundMouseUp) this.canvas.removeEventListener("mouseup", this.boundMouseUp);
    }
    // Remove selection rect overlay
    if (this.selectionRect?.parentElement) {
      this.selectionRect.parentElement.removeChild(this.selectionRect);
    }
    this.selectionRect = null;

    // Clear highlights
    this.highlightedEntities.clear();
  }
}
