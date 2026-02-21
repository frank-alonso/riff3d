import * as pc from "playcanvas";

/**
 * Remote user data for presence rendering.
 */
export interface RemoteUserPresence {
  name: string;
  color: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  fov: number;
  mode: "editor" | "avatar";
}

/**
 * PresenceRenderer -- renders camera frustum cones with floating name labels
 * for each remote user in the 3D viewport.
 *
 * Follows the same immediate-mode drawing pattern as Grid (grid.ts):
 * draws lines each frame via `app.drawLine()`.
 *
 * For each remote user in 'editor' mode:
 * - Draws a simplified frustum cone (4 lines from camera position to
 *   near plane corners, 4 lines connecting corners)
 * - Colors all lines in the user's assigned color
 * - Maintains a DOM overlay div for the name label, positioned via
 *   3D-to-2D screen-space projection each frame
 *
 * Users in 'avatar' mode are skipped (avatar rendering handled in 05-05).
 */
export class PresenceRenderer {
  private app: pc.Application;
  private cameraEntity: pc.Entity;
  private layer: pc.Layer | null = null;
  private updateHandler: (() => void) | null = null;
  private users: RemoteUserPresence[] = [];

  /** DOM container for name labels, positioned absolutely over the canvas. */
  private labelContainer: HTMLDivElement | null = null;
  /** Map from user name to their label element. */
  private labels: Map<string, HTMLDivElement> = new Map();

  /** Frustum cone distance from camera position (meters). */
  private static readonly CONE_DEPTH = 3;
  /** Default aspect ratio for frustum calculation. */
  private static readonly ASPECT = 16 / 9;
  /** Y offset for the name label above the frustum cone. */
  private static readonly LABEL_Y_OFFSET = 0.5;

  constructor(app: pc.Application, cameraEntity: pc.Entity) {
    this.app = app;
    this.cameraEntity = cameraEntity;
  }

  /**
   * Start rendering presence indicators each frame.
   * Creates the DOM overlay container for name labels.
   */
  start(): void {
    this.layer = this.app.scene.layers.getLayerByName("World") ?? null;

    // Create DOM overlay container for name labels
    const canvas = this.app.graphicsDevice.canvas;
    if (canvas instanceof HTMLCanvasElement) {
      this.labelContainer = document.createElement("div");
      this.labelContainer.style.position = "absolute";
      this.labelContainer.style.top = "0";
      this.labelContainer.style.left = "0";
      this.labelContainer.style.width = "100%";
      this.labelContainer.style.height = "100%";
      this.labelContainer.style.pointerEvents = "none";
      this.labelContainer.style.overflow = "hidden";
      canvas.parentElement?.appendChild(this.labelContainer);
    }

    this.updateHandler = () => this.render();
    this.app.on("update", this.updateHandler);
  }

  /**
   * Update the list of remote users to render.
   * Called each frame by the viewport component with fresh data
   * from the Awareness state.
   */
  update(remoteUsers: RemoteUserPresence[]): void {
    this.users = remoteUsers;
  }

  /**
   * Render frustum cones and update label positions.
   */
  private render(): void {
    if (!this.layer) return;

    const camera = this.cameraEntity.camera;
    if (!camera) return;

    // Track which labels are still in use
    const activeNames = new Set<string>();

    for (const user of this.users) {
      // Skip avatar mode users (rendered by 05-05)
      if (user.mode === "avatar") continue;

      activeNames.add(user.name);

      const color = this.parseColor(user.color);
      const pos = new pc.Vec3(user.position.x, user.position.y, user.position.z);
      const rot = new pc.Quat(user.rotation.x, user.rotation.y, user.rotation.z, user.rotation.w);

      this.drawFrustumCone(pos, rot, user.fov, color);
      this.updateLabel(user.name, user.color, pos, camera);
    }

    // Remove labels for users no longer present
    for (const [name, label] of this.labels) {
      if (!activeNames.has(name)) {
        label.remove();
        this.labels.delete(name);
      }
    }
  }

  /**
   * Draw a simplified frustum cone using immediate-mode lines.
   *
   * The cone has:
   * - 4 lines from the camera position to the 4 corners of a near plane
   * - 4 lines connecting the near plane corners to form a rectangle
   */
  private drawFrustumCone(
    position: pc.Vec3,
    rotation: pc.Quat,
    fov: number,
    color: pc.Color,
  ): void {
    const depth = PresenceRenderer.CONE_DEPTH;
    const halfH = Math.tan((fov * Math.PI) / 360) * depth;
    const halfW = halfH * PresenceRenderer.ASPECT;

    // Near plane corners in local space (camera looks down -Z)
    const localCorners = [
      new pc.Vec3(-halfW, halfH, -depth),  // top-left
      new pc.Vec3(halfW, halfH, -depth),   // top-right
      new pc.Vec3(halfW, -halfH, -depth),  // bottom-right
      new pc.Vec3(-halfW, -halfH, -depth), // bottom-left
    ];

    // Transform corners to world space
    const mat = new pc.Mat4();
    mat.setTRS(position, rotation, pc.Vec3.ONE);

    const worldCorners = localCorners.map((corner) => {
      const result = new pc.Vec3();
      mat.transformPoint(corner, result);
      return result;
    });

    // Draw lines from camera position to each corner
    for (const corner of worldCorners) {
      this.app.drawLine(position, corner, color, false, this.layer!);
    }

    // Draw lines connecting adjacent corners (near plane rectangle)
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      this.app.drawLine(worldCorners[i]!, worldCorners[next]!, color, false, this.layer!);
    }
  }

  /**
   * Create or update a floating name label for a remote user.
   * Projects the user's 3D position to 2D screen coordinates
   * and positions a DOM div accordingly.
   */
  private updateLabel(
    name: string,
    colorHex: string,
    worldPos: pc.Vec3,
    camera: pc.CameraComponent,
  ): void {
    if (!this.labelContainer) return;

    // Get or create the label element
    let label = this.labels.get(name);
    if (!label) {
      label = document.createElement("div");
      label.style.position = "absolute";
      label.style.fontSize = "11px";
      label.style.fontWeight = "600";
      label.style.padding = "1px 6px";
      label.style.borderRadius = "4px";
      label.style.whiteSpace = "nowrap";
      label.style.transform = "translate(-50%, -100%)";
      label.style.pointerEvents = "none";
      label.style.transition = "opacity 0.15s";
      label.textContent = name;
      this.labelContainer.appendChild(label);
      this.labels.set(name, label);
    }

    // Update colors
    label.style.backgroundColor = colorHex;
    label.style.color = "#ffffff";

    // Project 3D position to 2D screen space
    // Offset slightly above the camera position for the label
    const labelPos = new pc.Vec3(
      worldPos.x,
      worldPos.y + PresenceRenderer.LABEL_Y_OFFSET,
      worldPos.z,
    );

    const screenPos = new pc.Vec3();
    camera.worldToScreen(labelPos, screenPos);

    // Hide label if behind the camera (z < 0)
    if (screenPos.z < 0) {
      label.style.opacity = "0";
      return;
    }

    label.style.opacity = "1";
    label.style.left = `${screenPos.x}px`;
    label.style.top = `${screenPos.y}px`;
  }

  /**
   * Parse a hex color string to a PlayCanvas Color.
   */
  private parseColor(hex: string): pc.Color {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return new pc.Color(r, g, b, 1);
  }

  /**
   * Dispose of the renderer: remove DOM elements, unregister update handler.
   */
  dispose(): void {
    if (this.updateHandler) {
      this.app.off("update", this.updateHandler);
      this.updateHandler = null;
    }

    // Remove all labels
    for (const label of this.labels.values()) {
      label.remove();
    }
    this.labels.clear();

    // Remove container
    this.labelContainer?.remove();
    this.labelContainer = null;

    this.users = [];
    this.layer = null;
  }
}
