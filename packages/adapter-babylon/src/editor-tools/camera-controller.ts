import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3, Quaternion, Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

/**
 * Camera controller for the Babylon.js editor viewport.
 *
 * Controls are configured to match the PlayCanvas adapter's behavior:
 * - **Left-click:** Select objects (camera does NOT consume left-click)
 * - **Right-click + drag:** Orbit around target
 * - **Middle-click + drag:** Pan
 * - **Scroll wheel:** Zoom in/out
 * - **WASD:** Pan camera (custom handler, not ArcRotateCamera's built-in orbit keys)
 *
 * This is a validation adapter, so we provide basic but functional controls.
 * Full parity with PlayCanvas (fly mode, smooth damping) is deferred.
 *
 * Architecture note: This module is an editor interaction tool, tracked
 * separately from the core adapter LoC budget per the approved exception.
 */

/** Default orbit distance from target. */
const DEFAULT_RADIUS = 12;

/** Default orbit alpha (horizontal angle in radians). */
const DEFAULT_ALPHA = Math.PI / 4;

/** Default orbit beta (vertical angle in radians). */
const DEFAULT_BETA = Math.PI / 3;

/** Minimum zoom distance. */
const MIN_RADIUS = 0.5;

/** Maximum zoom distance. */
const MAX_RADIUS = 500;

/** Pan speed multiplier. */
const PAN_SPEED = 0.5;

/** Zoom speed (wheel sensitivity). */
const ZOOM_SPEED = 0.5;

/** WASD pan speed in units per second. */
const KEY_PAN_SPEED = 8;

export class BabylonCameraController {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private orbitCamera: ArcRotateCamera | null = null;
  private currentMode: "fly" | "orbit" = "orbit";

  // WASD key tracking
  private keys = new Set<string>();
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
   * Creates an ArcRotateCamera with right-click orbit (left-click free for selection).
   *
   * @returns The newly created orbit camera
   */
  initialize(): ArcRotateCamera {
    this.orbitCamera = new ArcRotateCamera(
      "__editorCamera",
      DEFAULT_ALPHA,
      DEFAULT_BETA,
      DEFAULT_RADIUS,
      Vector3.Zero(),
      this.scene,
    );

    // Configure orbit limits
    this.orbitCamera.lowerRadiusLimit = MIN_RADIUS;
    this.orbitCamera.upperRadiusLimit = MAX_RADIUS;
    this.orbitCamera.lowerBetaLimit = 0.01;
    this.orbitCamera.upperBetaLimit = Math.PI - 0.01;

    // Configure input sensitivity
    this.orbitCamera.panningSensibility = 1000 / PAN_SPEED;
    this.orbitCamera.wheelPrecision = 1 / ZOOM_SPEED;
    this.orbitCamera.pinchPrecision = 100;

    // Reconfigure pointer input: orbit on RIGHT-click only (button 2),
    // leaving left-click (button 0) free for selection manager.
    // Middle-click (button 1) for pan (Babylon default).
    const pointerInput = this.orbitCamera.inputs.attached[
      "pointers"
    ] as { buttons?: number[] } | undefined;
    if (pointerInput) {
      pointerInput.buttons = [2]; // Only right-click orbits
    }

    // Remove built-in keyboard input — it maps keys to orbit rotation,
    // not panning. We handle WASD ourselves below.
    this.orbitCamera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");

    // Attach camera controls to canvas
    this.orbitCamera.attachControl(this.canvas, true);

    // Set as active camera
    this.scene.activeCamera = this.orbitCamera;

    // Prevent context menu on right-click so right-drag works for orbit
    this.boundContextMenu = (e: Event) => e.preventDefault();
    this.canvas.addEventListener("contextmenu", this.boundContextMenu);

    // Set up WASD panning via DOM key events + animation frame
    this.boundKeyDown = (e: KeyboardEvent) => {
      // Only track WASD/QE when canvas or its parent has focus
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d", "q", "e"].includes(key)) {
        this.keys.add(key);
      }
    };
    this.boundKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);

    // Register WASD update with Babylon's render loop (works in tests too)
    this.lastTime = typeof performance !== "undefined" ? performance.now() : 0;
    this.renderCallback = () => {
      const now = typeof performance !== "undefined" ? performance.now() : this.lastTime + 16;
      const dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      this.updateKeyPan(dt);
    };
    this.scene.registerBeforeRender(this.renderCallback);

    return this.orbitCamera;
  }

  /**
   * Apply WASD/QE panning to the orbit target each frame.
   */
  private updateKeyPan(dt: number): void {
    if (!this.orbitCamera || this.keys.size === 0) return;

    // Build pan direction in camera-local space
    let dx = 0;
    let dy = 0;
    let dz = 0;
    if (this.keys.has("a")) dx -= 1;
    if (this.keys.has("d")) dx += 1;
    if (this.keys.has("w")) dz += 1;
    if (this.keys.has("s")) dz -= 1;
    if (this.keys.has("e")) dy += 1;
    if (this.keys.has("q")) dy -= 1;

    if (dx === 0 && dy === 0 && dz === 0) return;

    const speed = KEY_PAN_SPEED * dt;

    // Get camera's right and forward vectors for world-space panning
    const camera = this.orbitCamera;
    const viewMatrix = camera.getViewMatrix();
    // Right vector = row 0 of view matrix
    const right = new Vector3(
      viewMatrix.m[0]!,
      viewMatrix.m[4]!,
      viewMatrix.m[8]!,
    );
    // Up vector = row 1 of view matrix
    const up = new Vector3(
      viewMatrix.m[1]!,
      viewMatrix.m[5]!,
      viewMatrix.m[9]!,
    );
    // Forward vector = row 2 of view matrix (negated for camera direction)
    const forward = new Vector3(
      -viewMatrix.m[2]!,
      -viewMatrix.m[6]!,
      -viewMatrix.m[10]!,
    );

    // Compute world-space pan offset
    const offset = right.scale(dx * speed)
      .add(up.scale(dy * speed))
      .add(forward.scale(dz * speed));

    // Move the orbit target (camera follows automatically)
    camera.target.addInPlace(offset);
  }

  /**
   * Get the active camera.
   */
  getCamera(): ArcRotateCamera | null {
    return this.orbitCamera;
  }

  /**
   * Get the current camera mode.
   */
  getMode(): "fly" | "orbit" {
    return this.currentMode;
  }

  /**
   * Serialize the camera state for engine switching.
   *
   * Converts ArcRotateCamera's spherical coordinates to a position/quaternion
   * that can be transferred to the PlayCanvas adapter.
   */
  serializeCameraState(): {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    mode: "fly" | "orbit";
  } {
    if (!this.orbitCamera) {
      return {
        position: { x: 0, y: 3, z: -8 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        mode: "orbit",
      };
    }

    const pos = this.orbitCamera.position;

    // Extract rotation from the camera's view matrix
    const viewMatrix = this.orbitCamera.getViewMatrix();
    const worldMatrix = viewMatrix.clone();
    worldMatrix.invert();

    const scale = Vector3.Zero();
    const rotQuat = new Quaternion();
    const translation = Vector3.Zero();
    worldMatrix.decompose(scale, rotQuat, translation);

    return {
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation: { x: rotQuat.x, y: rotQuat.y, z: rotQuat.z, w: rotQuat.w },
      mode: this.currentMode,
    };
  }

  /**
   * Restore camera state from a serialized state (from another engine).
   *
   * Converts position/quaternion to ArcRotateCamera parameters.
   */
  restoreCameraState(state: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
  }): void {
    if (!this.orbitCamera) return;

    const pos = new Vector3(state.position.x, state.position.y, state.position.z);
    const rot = new Quaternion(
      state.rotation.x,
      state.rotation.y,
      state.rotation.z,
      state.rotation.w,
    );

    // Extract forward direction from the rotation quaternion
    const rotMatrix = new Matrix();
    Matrix.FromQuaternionToRef(rot, rotMatrix);

    const localForward = new Vector3(0, 0, -1);
    const worldForward = Vector3.TransformNormal(localForward, rotMatrix);

    // Compute orbit target from position + forward * distance
    const distance = Math.max(5, pos.length());
    const target = pos.add(worldForward.scale(distance));

    this.orbitCamera.setTarget(target);
    this.orbitCamera.setPosition(pos);
  }

  /**
   * Clean up camera controls and event listeners.
   */
  dispose(): void {
    if (this.renderCallback) {
      this.scene.unregisterBeforeRender(this.renderCallback);
      this.renderCallback = null;
    }
    if (this.boundKeyDown) window.removeEventListener("keydown", this.boundKeyDown);
    if (this.boundKeyUp) window.removeEventListener("keyup", this.boundKeyUp);
    if (this.boundContextMenu) {
      this.canvas.removeEventListener("contextmenu", this.boundContextMenu);
    }
    this.keys.clear();

    if (this.orbitCamera) {
      this.orbitCamera.detachControl();
      this.orbitCamera.dispose();
      this.orbitCamera = null;
    }
  }
}
