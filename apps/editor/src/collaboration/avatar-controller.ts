/**
 * AvatarController -- FPS-style WASD ground-plane movement controller
 * for embodied avatar mode.
 *
 * When active, the normal CameraController is disabled and this controller
 * takes over. The avatar moves along the ground plane (XZ) with the camera
 * at head height (~1.7m above ground). Mouse movement rotates the camera
 * yaw for looking around.
 *
 * Position and rotation are broadcast via Awareness at the same throttled
 * rate as the normal editor camera (100ms).
 *
 * Lifecycle:
 * 1. Create with canvas and camera entity references
 * 2. enable() -- start listening to input, register update loop
 * 3. update is called each frame via app "update" event
 * 4. disable() -- stop input, unregister update loop
 */

/** Movement speed in meters per second. */
const WALK_SPEED = 5;

/** Height of camera above ground plane (head height of ~1.8m capsule). */
const HEAD_HEIGHT = 1.7;

/** Default ground-plane Y position. */
const GROUND_Y = 0;

/** Capsule half-height for position offset. */
const CAPSULE_HALF_HEIGHT = 0.9;

/** Mouse look sensitivity in degrees per pixel. */
const LOOK_SPEED = 0.15;

/** Throttle interval for awareness broadcasts (ms). */
const BROADCAST_INTERVAL = 100;

/**
 * Callback for broadcasting avatar position/rotation via Awareness.
 */
export interface AvatarBroadcastCallback {
  (camera: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    fov: number;
  }): void;
}

/**
 * Minimal interface for the PlayCanvas camera entity needed by AvatarController.
 * Avoids direct dependency on PlayCanvas types in the editor layer.
 */
export interface AvatarCameraHandle {
  setPosition(x: number, y: number, z: number): void;
  setEulerAngles(pitch: number, yaw: number, roll: number): void;
  getPosition(): { x: number; y: number; z: number };
  getRotation(): { x: number; y: number; z: number; w: number };
  camera?: { fov: number };
}

/**
 * Minimal interface for the PlayCanvas Application needed by AvatarController.
 */
export interface AvatarAppHandle {
  on(event: string, callback: (dt: number) => void): void;
  off(event: string, callback: (dt: number) => void): void;
}

export class AvatarController {
  private canvas: HTMLCanvasElement;
  private cameraHandle: AvatarCameraHandle;
  private appHandle: AvatarAppHandle;
  private broadcastCallback: AvatarBroadcastCallback | null = null;

  /** Avatar position on the ground plane. */
  private posX = 0;
  private posZ = 0;

  /** Camera yaw and pitch in degrees. */
  private yaw = 0;
  private pitch = 0;

  /** Input state. */
  private keys = new Set<string>();
  private isPointerLocked = false;

  /** Event handler references for cleanup. */
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundPointerLockChange: (() => void) | null = null;
  private updateHandler: ((dt: number) => void) | null = null;

  /** Throttle state for awareness broadcasts. */
  private lastBroadcast = 0;

  /** Whether the controller is currently active. */
  private _enabled = false;

  constructor(
    canvas: HTMLCanvasElement,
    cameraHandle: AvatarCameraHandle,
    appHandle: AvatarAppHandle,
  ) {
    this.canvas = canvas;
    this.cameraHandle = cameraHandle;
    this.appHandle = appHandle;
  }

  /**
   * Set the callback for broadcasting avatar position via Awareness.
   */
  setBroadcastCallback(cb: AvatarBroadcastCallback): void {
    this.broadcastCallback = cb;
  }

  /**
   * Enable the avatar controller.
   * Takes over camera input and starts the update loop.
   * Initializes position from the current camera position.
   */
  enable(): void {
    if (this._enabled) return;
    this._enabled = true;

    // Initialize position from current camera
    const pos = this.cameraHandle.getPosition();
    this.posX = pos.x;
    this.posZ = pos.z;

    // Extract yaw from current camera rotation
    // We keep the same yaw the user was looking at
    // Simple extraction: use atan2 from the position relative to origin
    // Actually, read from euler angles via the setEulerAngles convention
    // The camera's euler angles are (pitch, yaw, 0), so we need to
    // reverse-engineer from the camera's current rotation.
    // For simplicity, keep yaw at 0 initially -- the user can mouse-look.
    this.yaw = 0;
    this.pitch = 0;

    // Bind input handlers
    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    this.boundKeyUp = (e: KeyboardEvent) => this.onKeyUp(e);
    this.boundMouseMove = (e: MouseEvent) => this.onMouseMove(e);
    this.boundMouseDown = (e: MouseEvent) => this.onMouseDown(e);
    this.boundPointerLockChange = () => this.onPointerLockChange();

    this.canvas.addEventListener("mousedown", this.boundMouseDown);
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
    window.addEventListener("mousemove", this.boundMouseMove);
    document.addEventListener("pointerlockchange", this.boundPointerLockChange);

    // Register update loop
    this.updateHandler = (dt: number) => this.onUpdate(dt);
    this.appHandle.on("update", this.updateHandler);

    // Set camera to initial avatar position
    this.applyCameraPosition();

    // Request pointer lock for smooth mouse look
    void this.canvas.requestPointerLock();
  }

  /**
   * Disable the avatar controller.
   * Stops input handling and update loop.
   */
  disable(): void {
    if (!this._enabled) return;
    this._enabled = false;

    // Remove input handlers
    if (this.boundMouseDown) {
      this.canvas.removeEventListener("mousedown", this.boundMouseDown);
    }
    if (this.boundKeyDown) {
      window.removeEventListener("keydown", this.boundKeyDown);
    }
    if (this.boundKeyUp) {
      window.removeEventListener("keyup", this.boundKeyUp);
    }
    if (this.boundMouseMove) {
      window.removeEventListener("mousemove", this.boundMouseMove);
    }
    if (this.boundPointerLockChange) {
      document.removeEventListener("pointerlockchange", this.boundPointerLockChange);
    }

    // Unregister update loop
    if (this.updateHandler) {
      this.appHandle.off("update", this.updateHandler);
      this.updateHandler = null;
    }

    // Exit pointer lock
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }

    // Clear input state
    this.keys.clear();
    this.isPointerLocked = false;
  }

  /**
   * Check if the controller is enabled.
   */
  isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    this.disable();
    this.broadcastCallback = null;
  }

  // --- Input handlers ---

  private onKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    // Capture WASD and prevent propagation to editor shortcuts
    if (key === "w" || key === "a" || key === "s" || key === "d") {
      e.preventDefault();
      e.stopPropagation();
    }
    this.keys.add(key);

    // ESC exits pointer lock (browser handles this, but also toggle avatar mode)
    if (key === "escape" && this.isPointerLocked) {
      document.exitPointerLock();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.key.toLowerCase());
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isPointerLocked) return;

    this.yaw -= e.movementX * LOOK_SPEED;
    this.pitch -= e.movementY * LOOK_SPEED;
    // Clamp pitch to avoid flipping
    this.pitch = Math.max(-89, Math.min(89, this.pitch));
  }

  private onMouseDown(_e: MouseEvent): void {
    // Re-request pointer lock if lost
    if (!this.isPointerLocked && this._enabled) {
      void this.canvas.requestPointerLock();
    }
  }

  private onPointerLockChange(): void {
    this.isPointerLocked = document.pointerLockElement === this.canvas;
  }

  // --- Update loop ---

  private onUpdate(dt: number): void {
    if (!this._enabled) return;

    // Build movement direction from WASD
    let moveX = 0;
    let moveZ = 0;
    if (this.keys.has("w")) moveZ -= 1;
    if (this.keys.has("s")) moveZ += 1;
    if (this.keys.has("a")) moveX -= 1;
    if (this.keys.has("d")) moveX += 1;

    // Normalize and apply movement relative to yaw (XZ plane only)
    const hasMovement = moveX !== 0 || moveZ !== 0;
    if (hasMovement) {
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= len;
      moveZ /= len;

      // Rotate movement direction by yaw
      const yawRad = (this.yaw * Math.PI) / 180;
      const sinYaw = Math.sin(yawRad);
      const cosYaw = Math.cos(yawRad);

      // Forward is -Z in PlayCanvas (right-handed Y-up)
      const worldX = moveX * cosYaw - moveZ * sinYaw;
      const worldZ = moveX * sinYaw + moveZ * cosYaw;

      this.posX += worldX * WALK_SPEED * dt;
      this.posZ += worldZ * WALK_SPEED * dt;
    }

    // Apply camera position and rotation
    this.applyCameraPosition();

    // Broadcast position via awareness (throttled)
    const now = Date.now();
    if (this.broadcastCallback && now - this.lastBroadcast >= BROADCAST_INTERVAL) {
      this.lastBroadcast = now;
      const rot = this.cameraHandle.getRotation();
      const fov = this.cameraHandle.camera?.fov ?? 60;
      this.broadcastCallback({
        position: {
          x: this.posX,
          y: GROUND_Y + CAPSULE_HALF_HEIGHT,
          z: this.posZ,
        },
        rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
        fov,
      });
    }
  }

  /**
   * Set the camera to the avatar's current position and rotation.
   * Camera is at head height above the ground plane.
   */
  private applyCameraPosition(): void {
    this.cameraHandle.setPosition(
      this.posX,
      GROUND_Y + HEAD_HEIGHT,
      this.posZ,
    );
    this.cameraHandle.setEulerAngles(this.pitch, this.yaw, 0);
  }
}
