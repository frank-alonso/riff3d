import * as pc from "playcanvas";
import type { RemoteUserPresence } from "./presence-renderer";

/**
 * AvatarRenderer -- renders colored capsule avatars with floating name labels
 * for remote users who are in 'avatar' mode.
 *
 * When a remote user switches to avatar mode, their frustum cone (rendered
 * by PresenceRenderer) disappears and this renderer shows a capsule
 * at their reported ground-plane position instead.
 *
 * Capsule dimensions:
 * - Radius: 0.3m
 * - Height: 1.8m total (reasonable human-scale)
 * - Semi-transparent (alpha ~0.7)
 * - Colored with the user's assigned presence color
 *
 * Name labels follow the same DOM overlay approach as PresenceRenderer:
 * positioned via 3D-to-2D screen projection each frame, floating
 * ~2.0m above ground.
 */

/** Capsule geometry radius. */
const CAPSULE_RADIUS = 0.3;

/** Capsule geometry total height. */
const CAPSULE_HEIGHT = 1.8;

/** Y offset for the floating name label above the capsule top. */
const LABEL_Y_OFFSET = 2.1;

/** Material alpha for semi-transparent capsule. */
const CAPSULE_ALPHA = 0.7;

/**
 * Per-avatar state managed by the renderer.
 */
interface AvatarEntry {
  /** The capsule entity in the PlayCanvas scene. */
  entity: pc.Entity;
  /** The material applied to the capsule (for color updates). */
  material: pc.StandardMaterial;
  /** The user name for lookup. */
  name: string;
}

export class AvatarRenderer {
  private app: pc.Application;
  private cameraEntity: pc.Entity;
  private avatars: Map<string, AvatarEntry> = new Map();
  private updateHandler: (() => void) | null = null;
  private users: RemoteUserPresence[] = [];

  /** DOM container for name labels, positioned absolutely over the canvas. */
  private labelContainer: HTMLDivElement | null = null;
  /** Map from user name to their label element. */
  private labels: Map<string, HTMLDivElement> = new Map();

  constructor(app: pc.Application, cameraEntity: pc.Entity) {
    this.app = app;
    this.cameraEntity = cameraEntity;
  }

  /**
   * Start rendering avatar capsules each frame.
   * Creates the DOM overlay container for name labels.
   */
  start(): void {
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
   * Update the list of remote users.
   * Called each frame by the viewport component with fresh data
   * from the Awareness state.
   */
  update(remoteUsers: RemoteUserPresence[]): void {
    this.users = remoteUsers;
  }

  /**
   * Render avatar capsules and update label positions each frame.
   */
  private render(): void {
    const camera = this.cameraEntity.camera;
    if (!camera) return;

    // Track which avatars are still in use this frame
    const activeNames = new Set<string>();

    for (const user of this.users) {
      // Only render users in avatar mode
      if (user.mode !== "avatar") continue;

      activeNames.add(user.name);

      // Get or create avatar entry
      let entry = this.avatars.get(user.name);
      if (!entry) {
        entry = this.createAvatar(user.name, user.color);
        this.avatars.set(user.name, entry);
      }

      // Update capsule position: center capsule at ground level
      // The capsule entity center is at the middle of the capsule height
      entry.entity.setPosition(
        user.position.x,
        CAPSULE_HEIGHT / 2,
        user.position.z,
      );

      // Rotate capsule to face the user's look direction (yaw only, stays upright)
      // Extract yaw from the quaternion rotation
      const yaw = this.quaternionToYaw(user.rotation);
      entry.entity.setEulerAngles(0, yaw, 0);

      // Update color if it changed
      const color = this.parseColor(user.color);
      if (
        entry.material.diffuse.r !== color.r ||
        entry.material.diffuse.g !== color.g ||
        entry.material.diffuse.b !== color.b
      ) {
        entry.material.diffuse = color;
        entry.material.opacity = CAPSULE_ALPHA;
        entry.material.update();
      }

      // Update name label position
      this.updateLabel(user.name, user.color, user.position, camera);
    }

    // Remove avatars for users no longer in avatar mode
    for (const [name, entry] of this.avatars) {
      if (!activeNames.has(name)) {
        entry.entity.destroy();
        this.avatars.delete(name);
      }
    }

    // Remove labels for users no longer in avatar mode
    for (const [name, label] of this.labels) {
      if (!activeNames.has(name)) {
        label.remove();
        this.labels.delete(name);
      }
    }
  }

  /**
   * Create a capsule entity for a remote avatar user.
   */
  private createAvatar(name: string, colorHex: string): AvatarEntry {
    const entity = new pc.Entity(`Avatar_${name}`);

    // Create capsule mesh using CapsuleGeometry
    const mesh = pc.Mesh.fromGeometry(
      this.app.graphicsDevice,
      new pc.CapsuleGeometry({
        radius: CAPSULE_RADIUS,
        height: CAPSULE_HEIGHT,
      }),
    );

    // Create semi-transparent material with user's color
    const material = new pc.StandardMaterial();
    const color = this.parseColor(colorHex);
    material.diffuse = color;
    material.opacity = CAPSULE_ALPHA;
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = false;
    material.update();

    // Add render component with the capsule mesh
    entity.addComponent("render", {
      type: "asset",
      meshInstances: [],
    });

    const meshInstance = new pc.MeshInstance(mesh, material);
    entity.render!.meshInstances = [meshInstance];

    this.app.root.addChild(entity);

    return { entity, material, name };
  }

  /**
   * Create or update a floating name label for a remote avatar user.
   * Projects the avatar's 3D position to 2D screen coordinates.
   */
  private updateLabel(
    name: string,
    colorHex: string,
    position: { x: number; y: number; z: number },
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

    // Project label position (above capsule top)
    const labelPos = new pc.Vec3(
      position.x,
      LABEL_Y_OFFSET,
      position.z,
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
   * Extract yaw angle (degrees) from a quaternion.
   * Returns the Y-axis rotation for upright capsule facing direction.
   */
  private quaternionToYaw(q: { x: number; y: number; z: number; w: number }): number {
    // Yaw = atan2(2(qw*qy + qx*qz), 1 - 2(qy^2 + qz^2))
    // Simplified for Y-up coordinate system
    const sinYaw = 2 * (q.w * q.y + q.x * q.z);
    const cosYaw = 1 - 2 * (q.y * q.y + q.z * q.z);
    return Math.atan2(sinYaw, cosYaw) * (180 / Math.PI);
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
   * Dispose of the renderer: remove all capsule entities, DOM labels,
   * and unregister the update handler.
   */
  dispose(): void {
    if (this.updateHandler) {
      this.app.off("update", this.updateHandler);
      this.updateHandler = null;
    }

    // Destroy all capsule entities
    for (const entry of this.avatars.values()) {
      entry.entity.destroy();
    }
    this.avatars.clear();

    // Remove all labels
    for (const label of this.labels.values()) {
      label.remove();
    }
    this.labels.clear();

    // Remove container
    this.labelContainer?.remove();
    this.labelContainer = null;

    this.users = [];
  }
}
