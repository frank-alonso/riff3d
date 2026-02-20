import * as pc from "playcanvas";

/**
 * Grid plane configuration.
 */
interface GridConfig {
  /** Grid extent in each direction (default 50 = 100x100 grid). */
  extent: number;
  /** Grid cell size in meters (default 1). */
  gridSize: number;
  /** Major grid line interval (default 10). */
  majorInterval: number;
  /** Minor grid line color. */
  minorColor: pc.Color;
  /** Major grid line color. */
  majorColor: pc.Color;
}

const DEFAULT_CONFIG: GridConfig = {
  extent: 50,
  gridSize: 1,
  majorInterval: 10,
  minorColor: new pc.Color(0.25, 0.25, 0.25, 1),
  majorColor: new pc.Color(0.35, 0.35, 0.35, 1),
};

/**
 * Create a grid plane entity at Y=0.
 *
 * The grid is rendered as a set of line segments using PlayCanvas's
 * renderLines API on each frame. This approach is simpler than creating
 * a mesh entity and ensures the grid is not selectable/pickable.
 *
 * Grid features:
 * - Extends to 100x100 units by default
 * - Minor lines at every `gridSize` interval (subtle neutral color)
 * - Major lines every 10 units (slightly brighter)
 * - Grid is at Y=0 (ground plane)
 * - Not selectable (uses render callback, not entity)
 *
 * @param app - The PlayCanvas Application instance
 * @param gridSize - Grid cell size in meters (default 1)
 * @returns Grid handle for cleanup and updates
 */
export function createGrid(
  app: pc.Application,
  gridSize = 1,
): GridHandle {
  const handle = new GridHandle(app, gridSize);
  handle.start();
  return handle;
}

/**
 * Handle for managing the grid lifecycle.
 */
export class GridHandle {
  private app: pc.Application;
  private gridSize: number;
  private lines: { start: pc.Vec3; end: pc.Vec3; color: pc.Color }[] = [];
  private updateHandler: (() => void) | null = null;
  private layer: pc.Layer | null = null;

  constructor(app: pc.Application, gridSize: number) {
    this.app = app;
    this.gridSize = gridSize;
    this.rebuildLines();
  }

  /**
   * Start rendering the grid each frame.
   */
  start(): void {
    // Find the world layer for rendering
    this.layer = this.app.scene.layers.getLayerByName("World") ?? null;

    this.updateHandler = () => this.render();
    this.app.on("update", this.updateHandler);
  }

  /**
   * Render grid lines using the immediate mode line API.
   */
  private render(): void {
    if (!this.layer) return;

    for (const line of this.lines) {
      this.app.drawLine(line.start, line.end, line.color, false, this.layer);
    }
  }

  /**
   * Rebuild grid line data based on current gridSize.
   */
  private rebuildLines(): void {
    const config: GridConfig = {
      ...DEFAULT_CONFIG,
      gridSize: this.gridSize,
    };

    this.lines = [];
    const extent = config.extent;
    const step = config.gridSize;

    // Generate grid lines along X and Z axes at Y=0
    for (let i = -extent; i <= extent; i += step) {
      // Determine if this is a major line
      const isMajor = Math.abs(i) % config.majorInterval < 0.001 ||
        Math.abs(Math.abs(i) % config.majorInterval - config.majorInterval) < 0.001;
      const color = isMajor ? config.majorColor : config.minorColor;

      // Line along Z axis (at X = i)
      this.lines.push({
        start: new pc.Vec3(i, 0, -extent),
        end: new pc.Vec3(i, 0, extent),
        color,
      });

      // Line along X axis (at Z = i)
      this.lines.push({
        start: new pc.Vec3(-extent, 0, i),
        end: new pc.Vec3(extent, 0, i),
        color,
      });
    }
  }

  /**
   * Update the grid with a new cell size.
   */
  updateGridSize(gridSize: number): void {
    if (gridSize === this.gridSize) return;
    this.gridSize = gridSize;
    this.rebuildLines();
  }

  /**
   * Dispose of the grid and remove the update callback.
   */
  dispose(): void {
    if (this.updateHandler) {
      this.app.off("update", this.updateHandler);
      this.updateHandler = null;
    }
    this.lines = [];
    this.layer = null;
  }
}
