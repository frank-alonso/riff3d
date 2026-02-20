import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3, Quaternion, Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

/**
 * Camera controller for the Babylon.js editor viewport.
 *
 * Implements orbit camera mode using Babylon's ArcRotateCamera for intuitive
 * 3D navigation. The editor starts in orbit mode by default (matching the
 * PlayCanvas adapter's orbit behavior).
 *
 * Controls (orbit mode):
 * - **Left-click + drag:** Orbit around target
 * - **Right-click + drag:** Pan
 * - **Scroll wheel:** Zoom in/out
 * - **WASD:** Pan (when canvas has focus)
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

export class BabylonCameraController {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private orbitCamera: ArcRotateCamera | null = null;
  private currentMode: "fly" | "orbit" = "orbit";

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;
  }

  /**
   * Initialize the camera controller.
   * Creates an ArcRotateCamera and attaches controls to the canvas.
   *
   * @returns The newly created orbit camera
   */
  initialize(): ArcRotateCamera {
    // Create ArcRotateCamera for orbit controls
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
    this.orbitCamera.lowerBetaLimit = 0.01; // Don't flip upside down
    this.orbitCamera.upperBetaLimit = Math.PI - 0.01;

    // Configure input sensitivity
    this.orbitCamera.panningSensibility = 1000 / PAN_SPEED;
    this.orbitCamera.wheelPrecision = 1 / ZOOM_SPEED;
    this.orbitCamera.pinchPrecision = 100;

    // Enable keyboard controls (WASD pan)
    this.orbitCamera.keysUp = [87]; // W
    this.orbitCamera.keysDown = [83]; // S
    this.orbitCamera.keysLeft = [65]; // A
    this.orbitCamera.keysRight = [68]; // D

    // Attach camera controls to canvas
    this.orbitCamera.attachControl(this.canvas, true);

    // Set as active camera
    this.scene.activeCamera = this.orbitCamera;

    return this.orbitCamera;
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
   *
   * The rotation quaternion represents the camera's orientation such that
   * the camera's local -Z axis points toward the target (PlayCanvas convention).
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

    // Extract rotation from the camera's view matrix.
    // The view matrix is world-to-camera; we need camera-to-world rotation.
    const viewMatrix = this.orbitCamera.getViewMatrix();
    // Invert to get camera-to-world transform
    const worldMatrix = viewMatrix.clone();
    worldMatrix.invert();

    // Extract rotation quaternion from the world matrix
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
   * The target is computed from position + forward direction derived
   * from the rotation quaternion.
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

    // Extract forward direction from the rotation quaternion.
    // PlayCanvas uses right-handed Y-up where camera local forward is -Z.
    // Create a rotation matrix from the quaternion and extract the forward.
    const rotMatrix = new Matrix();
    Matrix.FromQuaternionToRef(rot, rotMatrix);

    // The -Z column of the rotation matrix gives the forward direction
    // in the right-handed convention. For Babylon (left-handed), we negate.
    // Column 2 of the rotation matrix = local Z axis in world space.
    const localForward = new Vector3(0, 0, -1);
    const worldForward = Vector3.TransformNormal(localForward, rotMatrix);

    // Compute orbit target: position + forward * distance
    // Use the current orbit radius as the base distance, or compute from height
    const distance = Math.max(5, pos.length());
    const target = pos.add(worldForward.scale(distance));

    // Set target first, then position -- ArcRotateCamera computes alpha/beta/radius
    this.orbitCamera.setTarget(target);
    this.orbitCamera.setPosition(pos);
  }

  /**
   * Clean up camera controls.
   */
  dispose(): void {
    if (this.orbitCamera) {
      this.orbitCamera.detachControl();
      this.orbitCamera.dispose();
      this.orbitCamera = null;
    }
  }
}
