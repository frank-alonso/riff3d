import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

/**
 * Camera controller for the Babylon.js editor viewport.
 *
 * Uses DOM-based input matching the PlayCanvas adapter's fly-mode behavior:
 * - **Left-click:** Free for selection (not consumed by camera)
 * - **Right-click + drag:** Look around (rotate camera direction)
 * - **WASD + right-click:** Move in the look direction
 * - **QE / Space:** Move up/down (while right-clicking)
 * - **Scroll wheel:** Zoom (move forward/backward)
 *
 * The camera is a Babylon UniversalCamera with all built-in inputs DETACHED.
 * All input is handled via raw DOM events for precise control over which
 * mouse buttons trigger which behavior.
 *
 * Architecture note: This module is an editor interaction tool, tracked
 * separately from the core adapter LoC budget per the approved exception.
 */

/** Damping factor for smooth camera motion. */
const DAMPING = 0.92;

/** Movement speed in meters per second. */
const MOVE_SPEED = 10;

/** Rotation speed in degrees per pixel. */
const ROTATE_SPEED = 0.2;

/** Zoom speed per scroll tick. */
const ZOOM_SPEED = 2;

export class BabylonCameraController {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private camera: UniversalCamera | null = null;
  private currentMode: "fly" | "orbit" = "fly";

  // Fly mode state
  private yaw = 0;
  private pitch = -20;
  private velocity = { x: 0, y: 0, z: 0 };

  // Input state
  private mouseDown: boolean[] = [false, false, false];
  private keys = new Set<string>();
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Bound event handlers for cleanup
  // NOTE: Uses pointer events, not mouse events. Babylon's Scene calls
  // preventDefault() on pointerdown (preventDefaultOnPointerDown=true),
  // which suppresses subsequent mousedown/mousemove/mouseup per spec.
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundPointerUp: ((e: PointerEvent) => void) | null = null;
  private boundPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundWheel: ((e: WheelEvent) => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundContextMenu: ((e: Event) => void) | null = null;
  private renderCallback: (() => void) | null = null;
  private lastTime = 0;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;
  }

  /**
   * Initialize the camera controller.
   * Creates a UniversalCamera with NO built-in inputs — all input handled via DOM.
   */
  initialize(): UniversalCamera {
    this.camera = new UniversalCamera(
      "__editorCamera",
      new Vector3(0, 5, -10),
      this.scene,
    );
    this.camera.minZ = 0.1;
    this.camera.maxZ = 5000;
    this.camera.fov = 60 * (Math.PI / 180); // Babylon uses radians

    // Set initial rotation from yaw/pitch
    this.updateCameraRotation();

    // Detach ALL built-in inputs — we handle everything ourselves
    this.camera.inputs.clear();

    // Set as active camera
    this.scene.activeCamera = this.camera;

    // Bind DOM events — pointer events, not mouse events (see note above)
    this.boundPointerDown = (e: PointerEvent) => this.onPointerDown(e);
    this.boundPointerUp = (e: PointerEvent) => this.onPointerUp(e);
    this.boundPointerMove = (e: PointerEvent) => this.onPointerMove(e);
    this.boundWheel = (e: WheelEvent) => this.onWheel(e);
    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    this.boundKeyUp = (e: KeyboardEvent) => this.onKeyUp(e);
    this.boundContextMenu = (e: Event) => e.preventDefault();

    this.canvas.addEventListener("pointerdown", this.boundPointerDown);
    this.canvas.addEventListener("pointerup", this.boundPointerUp);
    this.canvas.addEventListener("pointermove", this.boundPointerMove);
    this.canvas.addEventListener("wheel", this.boundWheel, { passive: false });
    this.canvas.addEventListener("contextmenu", this.boundContextMenu);
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);

    // Register update loop with Babylon's render cycle
    this.lastTime = typeof performance !== "undefined" ? performance.now() : 0;
    this.renderCallback = () => {
      const now = typeof performance !== "undefined" ? performance.now() : this.lastTime + 16;
      const dt = Math.min((now - this.lastTime) / 1000, 0.1); // Cap at 100ms
      this.lastTime = now;
      this.onUpdate(dt);
    };
    this.scene.registerBeforeRender(this.renderCallback);

    return this.camera;
  }

  private onPointerDown(e: PointerEvent): void {
    this.mouseDown[e.button] = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  private onPointerUp(e: PointerEvent): void {
    this.mouseDown[e.button] = false;
  }

  private onPointerMove(e: PointerEvent): void {
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    // Right-click drag: look around (matching PlayCanvas fly mode)
    if (this.mouseDown[2]) {
      this.yaw -= dx * ROTATE_SPEED;
      this.pitch -= dy * ROTATE_SPEED;
      this.pitch = Math.max(-89, Math.min(89, this.pitch));
      this.updateCameraRotation();
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (!this.camera) return;

    // Scroll: zoom (move forward/backward along look direction)
    const delta = e.deltaY > 0 ? -1 : 1;
    const forward = this.getForwardVector();
    const pos = this.camera.position;
    pos.x += forward.x * delta * ZOOM_SPEED;
    pos.y += forward.y * delta * ZOOM_SPEED;
    pos.z += forward.z * delta * ZOOM_SPEED;
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.key.toLowerCase());
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.key.toLowerCase());
  }

  private onUpdate(dt: number): void {
    if (!this.camera) return;

    // Build movement direction from WASD/QE (only when right mouse held)
    let moveX = 0;
    let moveY = 0;
    let moveZ = 0;

    if (this.mouseDown[2]) {
      if (this.keys.has("w")) moveZ += 1;
      if (this.keys.has("s")) moveZ -= 1;
      if (this.keys.has("a")) moveX -= 1;
      if (this.keys.has("d")) moveX += 1;
      if (this.keys.has("e") || this.keys.has(" ")) moveY += 1;
      if (this.keys.has("q")) moveY -= 1;
    }

    const speed = (moveX !== 0 || moveY !== 0 || moveZ !== 0) ? MOVE_SPEED : 0;

    // Compute world-space movement from camera rotation
    let targetVelX = 0;
    let targetVelY = 0;
    let targetVelZ = 0;

    if (speed > 0) {
      const forward = this.getForwardVector();
      const right = this.getRightVector();

      // Normalize input direction
      const len = Math.sqrt(moveX * moveX + moveY * moveY + moveZ * moveZ) || 1;
      moveX /= len;
      moveY /= len;
      moveZ /= len;

      targetVelX = (forward.x * moveZ + right.x * moveX) * speed;
      targetVelY = (forward.y * moveZ + right.y * moveX + moveY) * speed;
      targetVelZ = (forward.z * moveZ + right.z * moveX) * speed;
    }

    // Apply damping
    const factor = 1 - Math.pow(DAMPING, dt * 60);
    this.velocity.x += (targetVelX - this.velocity.x) * factor;
    this.velocity.y += (targetVelY - this.velocity.y) * factor;
    this.velocity.z += (targetVelZ - this.velocity.z) * factor;

    // Update position
    const pos = this.camera.position;
    pos.x += this.velocity.x * dt;
    pos.y += this.velocity.y * dt;
    pos.z += this.velocity.z * dt;
  }

  /**
   * Update the camera rotation quaternion from yaw/pitch euler angles.
   */
  private updateCameraRotation(): void {
    if (!this.camera) return;
    // Babylon's Quaternion.FromEulerAngles takes (pitch, yaw, roll) in radians
    const pitchRad = this.pitch * (Math.PI / 180);
    const yawRad = this.yaw * (Math.PI / 180);
    this.camera.rotationQuaternion = Quaternion.FromEulerAngles(pitchRad, yawRad, 0);
  }

  /**
   * Get forward direction vector from current yaw/pitch.
   *
   * Babylon uses left-handed Y-up coordinates. Its FromEulerAngles(pitch, yaw, 0)
   * rotates the camera such that positive pitch looks DOWN. The standard
   * spherical-coordinate formula gives y = sin(pitch), which is positive when
   * pitch > 0 — the opposite of where the camera actually faces. Negating
   * the Y component aligns movement with the visual look direction.
   */
  private getForwardVector(): { x: number; y: number; z: number } {
    const pitchRad = this.pitch * (Math.PI / 180);
    const yawRad = this.yaw * (Math.PI / 180);
    return {
      x: Math.sin(yawRad) * Math.cos(pitchRad),
      y: -Math.sin(pitchRad),
      z: Math.cos(yawRad) * Math.cos(pitchRad),
    };
  }

  /**
   * Get right direction vector from current yaw.
   */
  private getRightVector(): { x: number; y: number; z: number } {
    const yawRad = this.yaw * (Math.PI / 180);
    return {
      x: Math.cos(yawRad),
      y: 0,
      z: -Math.sin(yawRad),
    };
  }

  getCamera(): UniversalCamera | null {
    return this.camera;
  }

  getMode(): "fly" | "orbit" {
    return this.currentMode;
  }

  /**
   * Serialize camera state for engine switching.
   *
   * Converts from Babylon's left-handed coordinate system to the common
   * right-handed format used by SerializedCameraState:
   * - Position Z is negated (LH +Z forward → RH -Z forward)
   * - Yaw and pitch are negated (rotation direction reverses with handedness)
   */
  serializeCameraState(): {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    mode: "fly" | "orbit";
    yaw: number;
    pitch: number;
  } {
    if (!this.camera) {
      return {
        position: { x: 0, y: 5, z: 10 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        mode: "fly",
        yaw: 0,
        pitch: -20,
      };
    }

    const pos = this.camera.position;

    // Convert to common RH convention: negate yaw, pitch, and position Z
    const rhYaw = -this.yaw;
    const rhPitch = -this.pitch;

    return {
      position: { x: pos.x, y: pos.y, z: -pos.z },
      rotation: { x: 0, y: 0, z: 0, w: 1 }, // Kept for interface compat; yaw/pitch take precedence
      mode: this.currentMode,
      yaw: rhYaw,
      pitch: rhPitch,
    };
  }

  /**
   * Restore camera state from another engine.
   *
   * The incoming state is in common right-handed coordinates.
   * Converts to Babylon's left-handed system:
   * - Position Z is negated
   * - Yaw and pitch are negated (if provided)
   */
  restoreCameraState(state: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    yaw?: number;
    pitch?: number;
  }): void {
    if (!this.camera) return;

    // Convert RH position to Babylon LH: negate Z
    this.camera.position = new Vector3(
      state.position.x,
      state.position.y,
      -state.position.z,
    );

    if (state.yaw !== undefined && state.pitch !== undefined) {
      // Euler angles provided — negate for LH convention
      this.yaw = -state.yaw;
      this.pitch = -state.pitch;
    } else {
      // Fallback: extract yaw/pitch from quaternion (legacy / no euler data)
      const q = state.rotation;
      const sinp = 2 * (q.w * q.x - q.z * q.y);
      this.pitch = (Math.abs(sinp) >= 1
        ? Math.sign(sinp) * 90
        : Math.asin(sinp) * (180 / Math.PI));
      const siny = 2 * (q.w * q.y + q.x * q.z);
      const cosy = 1 - 2 * (q.y * q.y + q.x * q.x);
      this.yaw = Math.atan2(siny, cosy) * (180 / Math.PI);
    }

    this.updateCameraRotation();
  }

  dispose(): void {
    if (this.renderCallback) {
      this.scene.unregisterBeforeRender(this.renderCallback);
      this.renderCallback = null;
    }

    const canvas = this.canvas;
    if (this.boundPointerDown) canvas.removeEventListener("pointerdown", this.boundPointerDown);
    if (this.boundPointerUp) canvas.removeEventListener("pointerup", this.boundPointerUp);
    if (this.boundPointerMove) canvas.removeEventListener("pointermove", this.boundPointerMove);
    if (this.boundWheel) canvas.removeEventListener("wheel", this.boundWheel);
    if (this.boundContextMenu) canvas.removeEventListener("contextmenu", this.boundContextMenu);
    if (this.boundKeyDown) window.removeEventListener("keydown", this.boundKeyDown);
    if (this.boundKeyUp) window.removeEventListener("keyup", this.boundKeyUp);
    this.keys.clear();

    if (this.camera) {
      this.camera.dispose();
      this.camera = null;
    }
  }
}
