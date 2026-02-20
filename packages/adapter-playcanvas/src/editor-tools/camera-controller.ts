import * as pc from "playcanvas";

/**
 * Camera controller for the editor viewport.
 *
 * Implements both orbit and fly camera modes using PlayCanvas's raw input
 * (Mouse + Keyboard) for direct control without requiring the Script system.
 *
 * Default mode is fly (game-style) per user decision in 02-CONTEXT.md.
 *
 * Controls:
 * - **Fly mode (default):** Right-click+drag to look, WASD to move, QE for up/down
 * - **Orbit mode:** Alt+left-click to orbit, Alt+middle-click to pan, scroll to zoom
 *
 * Both modes use smooth damping for camera motion.
 *
 * The editor camera is separate from any scene cameras. Scene cameras
 * (from Camera components in ECSON entities) are disabled in editor mode
 * and only activated during play-test (02-07).
 */

/** Damping factor for smooth camera motion. */
const DAMPING = 0.92;

/** Movement speed in meters per second. */
const MOVE_SPEED = 10;

/** Rotation speed in degrees per pixel. */
const ROTATE_SPEED = 0.2;

/** Orbit zoom speed per scroll tick. */
const ZOOM_SPEED = 1;

/** Minimum orbit distance. */
const MIN_ORBIT_DISTANCE = 0.5;

/** Maximum orbit distance. */
const MAX_ORBIT_DISTANCE = 500;

export class CameraController {
  private app: pc.Application;
  private cameraEntity: pc.Entity;
  private currentMode: "fly" | "orbit";
  private updateHandler: ((dt: number) => void) | null = null;

  // Fly mode state
  private flyYaw = 0;
  private flyPitch = -20;
  private flyVelocity = new pc.Vec3();

  // Orbit mode state
  private orbitYaw = 0;
  private orbitPitch = -20;
  private orbitDistance = 10;
  private orbitTarget = new pc.Vec3(0, 1, 0);
  private orbitPanVelocity = new pc.Vec3();

  // Input state
  private mouseDown: boolean[] = [false, false, false];
  private keys: Set<string> = new Set();
  private altKey = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Bound event handlers for cleanup
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: ((e: MouseEvent) => void) | null = null;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundWheel: ((e: WheelEvent) => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundContextMenu: ((e: Event) => void) | null = null;

  constructor(app: pc.Application, cameraEntity: pc.Entity) {
    this.app = app;
    this.cameraEntity = cameraEntity;
    this.currentMode = "fly";
  }

  /**
   * Initialize the camera controller. Must be called after the camera
   * entity has been added to the scene and the app has started.
   */
  initialize(): void {
    const canvas = this.app.graphicsDevice.canvas;
    if (!(canvas instanceof HTMLCanvasElement)) return;

    // Set initial position from camera entity
    const pos = this.cameraEntity.getPosition();
    this.flyYaw = 0;
    this.flyPitch = -20;

    // Compute initial orbit state from camera position
    this.orbitYaw = this.flyYaw;
    this.orbitPitch = this.flyPitch;
    this.orbitDistance = pos.length() || 10;

    // Bind DOM events for input
    this.boundMouseDown = (e: MouseEvent) => this.onMouseDown(e);
    this.boundMouseUp = (e: MouseEvent) => this.onMouseUp(e);
    this.boundMouseMove = (e: MouseEvent) => this.onMouseMove(e);
    this.boundWheel = (e: WheelEvent) => this.onWheel(e);
    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    this.boundKeyUp = (e: KeyboardEvent) => this.onKeyUp(e);
    this.boundContextMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener("mousedown", this.boundMouseDown);
    canvas.addEventListener("mouseup", this.boundMouseUp);
    canvas.addEventListener("mousemove", this.boundMouseMove);
    canvas.addEventListener("wheel", this.boundWheel, { passive: false });
    canvas.addEventListener("contextmenu", this.boundContextMenu);
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);

    // Register update loop
    this.updateHandler = (dt: number) => this.onUpdate(dt);
    this.app.on("update", this.updateHandler);
  }

  private onMouseDown(e: MouseEvent): void {
    this.mouseDown[e.button] = true;
    this.altKey = e.altKey;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  private onMouseUp(e: MouseEvent): void {
    this.mouseDown[e.button] = false;
  }

  private onMouseMove(e: MouseEvent): void {
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.altKey = e.altKey;

    if (this.currentMode === "fly") {
      // Right-click drag to look around
      if (this.mouseDown[2]) {
        this.flyYaw -= dx * ROTATE_SPEED;
        this.flyPitch -= dy * ROTATE_SPEED;
        this.flyPitch = Math.max(-89, Math.min(89, this.flyPitch));
      }
    } else {
      // Orbit mode
      if (this.mouseDown[0] && this.altKey) {
        // Alt+left-click: orbit
        this.orbitYaw -= dx * ROTATE_SPEED;
        this.orbitPitch -= dy * ROTATE_SPEED;
        this.orbitPitch = Math.max(-89, Math.min(89, this.orbitPitch));
      } else if (this.mouseDown[1] && this.altKey) {
        // Alt+middle-click: pan
        const panSpeed = this.orbitDistance * 0.002;
        const right = new pc.Vec3();
        const up = new pc.Vec3();
        const rotation = new pc.Quat();
        rotation.setFromEulerAngles(this.orbitPitch, this.orbitYaw, 0);
        rotation.transformVector(pc.Vec3.RIGHT, right);
        rotation.transformVector(pc.Vec3.UP, up);
        this.orbitTarget.add(right.mulScalar(-dx * panSpeed));
        this.orbitTarget.add(up.mulScalar(dy * panSpeed));
      }
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (this.currentMode === "orbit") {
      const delta = e.deltaY > 0 ? 1 : -1;
      this.orbitDistance *= 1 + delta * ZOOM_SPEED * 0.1;
      this.orbitDistance = Math.max(MIN_ORBIT_DISTANCE, Math.min(MAX_ORBIT_DISTANCE, this.orbitDistance));
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.key.toLowerCase());
    this.altKey = e.altKey;
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.key.toLowerCase());
    this.altKey = e.altKey;
  }

  private onUpdate(dt: number): void {
    if (this.currentMode === "fly") {
      this.updateFlyMode(dt);
    } else {
      this.updateOrbitMode(dt);
    }
  }

  private updateFlyMode(dt: number): void {
    // Build movement direction from WASD/QE
    const moveDir = new pc.Vec3(0, 0, 0);
    if (this.keys.has("w")) moveDir.z -= 1;
    if (this.keys.has("s")) moveDir.z += 1;
    if (this.keys.has("a")) moveDir.x -= 1;
    if (this.keys.has("d")) moveDir.x += 1;
    if (this.keys.has("e") || this.keys.has(" ")) moveDir.y += 1;
    if (this.keys.has("q")) moveDir.y -= 1;

    // Only move when right mouse button is held (prevents accidental movement)
    const speed = this.mouseDown[2] && moveDir.length() > 0 ? MOVE_SPEED : 0;
    if (speed > 0) {
      moveDir.normalize();
    }

    // Transform move direction by camera rotation
    const rotation = new pc.Quat();
    rotation.setFromEulerAngles(this.flyPitch, this.flyYaw, 0);

    const worldMove = new pc.Vec3();
    if (speed > 0) {
      const forward = new pc.Vec3();
      const right = new pc.Vec3();
      const up = new pc.Vec3();
      rotation.transformVector(pc.Vec3.FORWARD, forward);
      rotation.transformVector(pc.Vec3.RIGHT, right);
      rotation.transformVector(pc.Vec3.UP, up);

      worldMove.add(forward.mulScalar(moveDir.z));
      worldMove.add(right.mulScalar(moveDir.x));
      worldMove.add(up.mulScalar(moveDir.y));
      worldMove.normalize().mulScalar(speed);
    }

    // Apply damping to velocity
    this.flyVelocity.lerp(this.flyVelocity, worldMove, 1 - Math.pow(DAMPING, dt * 60));

    // Update position
    const pos = this.cameraEntity.getPosition().clone();
    pos.add(this.flyVelocity.clone().mulScalar(dt));
    this.cameraEntity.setPosition(pos);
    this.cameraEntity.setEulerAngles(this.flyPitch, this.flyYaw, 0);
  }

  private updateOrbitMode(_dt: number): void {
    // Compute camera position from orbit parameters
    const rotation = new pc.Quat();
    rotation.setFromEulerAngles(this.orbitPitch, this.orbitYaw, 0);

    const offset = new pc.Vec3(0, 0, this.orbitDistance);
    rotation.transformVector(offset, offset);

    const pos = this.orbitTarget.clone().add(offset);
    this.cameraEntity.setPosition(pos);
    this.cameraEntity.setEulerAngles(this.orbitPitch, this.orbitYaw, 0);
  }

  /**
   * Switch between fly and orbit camera modes.
   *
   * Transfers the current camera pose to the new controller so the
   * camera doesn't jump when switching modes.
   */
  switchMode(mode: "fly" | "orbit"): void {
    if (mode === this.currentMode) return;

    if (mode === "orbit") {
      // Transfer fly state to orbit state
      this.orbitYaw = this.flyYaw;
      this.orbitPitch = this.flyPitch;
      // Point at where the camera is looking
      const pos = this.cameraEntity.getPosition();
      const forward = new pc.Vec3();
      this.cameraEntity.getWorldTransform().transformVector(new pc.Vec3(0, 0, -1), forward);
      this.orbitTarget.copy(pos).add(forward.mulScalar(this.orbitDistance));
    } else {
      // Transfer orbit state to fly state
      this.flyYaw = this.orbitYaw;
      this.flyPitch = this.orbitPitch;
      this.flyVelocity.set(0, 0, 0);
    }

    this.currentMode = mode;
  }

  /**
   * Get the current camera mode.
   */
  getMode(): "fly" | "orbit" {
    return this.currentMode;
  }

  /**
   * Clean up event listeners and controllers.
   */
  dispose(): void {
    if (this.updateHandler) {
      this.app.off("update", this.updateHandler);
      this.updateHandler = null;
    }

    const canvas = this.app.graphicsDevice.canvas;
    if (canvas instanceof HTMLCanvasElement) {
      if (this.boundMouseDown) canvas.removeEventListener("mousedown", this.boundMouseDown);
      if (this.boundMouseUp) canvas.removeEventListener("mouseup", this.boundMouseUp);
      if (this.boundMouseMove) canvas.removeEventListener("mousemove", this.boundMouseMove);
      if (this.boundWheel) canvas.removeEventListener("wheel", this.boundWheel);
      if (this.boundContextMenu) canvas.removeEventListener("contextmenu", this.boundContextMenu);
    }
    if (this.boundKeyDown) window.removeEventListener("keydown", this.boundKeyDown);
    if (this.boundKeyUp) window.removeEventListener("keyup", this.boundKeyUp);
  }
}

/**
 * Create the editor camera entity.
 *
 * This camera is NOT part of the scene (not in ECSON). It's the editor's
 * navigation camera, managed entirely by the CameraController.
 *
 * @param app - The PlayCanvas Application instance
 * @param clearColor - The camera clear color (used for sky/background)
 * @returns The editor camera entity
 */
export function createEditorCamera(
  app: pc.Application,
  clearColor?: pc.Color,
): pc.Entity {
  const camera = new pc.Entity("EditorCamera");
  camera.addComponent("camera", {
    clearColor: clearColor ?? new pc.Color(0.05, 0.05, 0.12, 1),
    nearClip: 0.1,
    farClip: 5000,
    fov: 60,
  });

  // Position the camera for a good default view of the scene
  camera.setPosition(0, 5, 10);
  camera.setEulerAngles(-20, 0, 0);

  app.root.addChild(camera);
  return camera;
}
