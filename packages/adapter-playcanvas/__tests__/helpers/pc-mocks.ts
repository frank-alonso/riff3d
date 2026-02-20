/**
 * Shared PlayCanvas mock factory for adapter tests.
 *
 * Provides fake implementations of PlayCanvas classes so tests can verify
 * correct API usage without WebGL/GPU dependency. Each mock uses vi.fn()
 * for methods so tests can assert on call arguments.
 *
 * Usage: call `setupPlayCanvasMocks()` at the top of each test file
 * (before any imports that reference "playcanvas").
 */
import { vi } from "vitest";

// ─── Mock Color ─────────────────────────────────────────────────────────────

export class MockColor {
  r: number;
  g: number;
  b: number;
  a: number;

  constructor(r = 0, g = 0, b = 0, a = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  set(r: number, g: number, b: number, a?: number): this {
    this.r = r;
    this.g = g;
    this.b = b;
    if (a !== undefined) this.a = a;
    return this;
  }

  copy(other: MockColor): this {
    this.r = other.r;
    this.g = other.g;
    this.b = other.b;
    this.a = other.a;
    return this;
  }

  clone(): MockColor {
    return new MockColor(this.r, this.g, this.b, this.a);
  }
}

// ─── Mock Vec3 ──────────────────────────────────────────────────────────────

export class MockVec3 {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(other: MockVec3): this {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    return this;
  }

  clone(): MockVec3 {
    return new MockVec3(this.x, this.y, this.z);
  }

  add(other: MockVec3): this {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    return this;
  }

  sub(other: MockVec3): this {
    this.x -= other.x;
    this.y -= other.y;
    this.z -= other.z;
    return this;
  }

  sub2(a: MockVec3, b: MockVec3): this {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }

  mulScalar(s: number): this {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  normalize(): this {
    const len = this.length();
    if (len > 0) {
      this.x /= len;
      this.y /= len;
      this.z /= len;
    }
    return this;
  }

  cross(lhs: MockVec3, rhs: MockVec3): this {
    this.x = lhs.y * rhs.z - lhs.z * rhs.y;
    this.y = lhs.z * rhs.x - lhs.x * rhs.z;
    this.z = lhs.x * rhs.y - lhs.y * rhs.x;
    return this;
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  lerp(a: MockVec3, b: MockVec3, t: number): this {
    this.x = a.x + (b.x - a.x) * t;
    this.y = a.y + (b.y - a.y) * t;
    this.z = a.z + (b.z - a.z) * t;
    return this;
  }

  static RIGHT = new MockVec3(1, 0, 0);
  static UP = new MockVec3(0, 1, 0);
  static FORWARD = new MockVec3(0, 0, -1);
  static ZERO = new MockVec3(0, 0, 0);
}

// ─── Mock Quat ──────────────────────────────────────────────────────────────

export class MockQuat {
  x: number;
  y: number;
  z: number;
  w: number;

  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  setFromEulerAngles(pitch: number, yaw: number, roll: number): this {
    this.x = pitch;
    this.y = yaw;
    this.z = roll;
    this.w = 1;
    return this;
  }

  copy(other: MockQuat): this {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    this.w = other.w;
    return this;
  }

  clone(): MockQuat {
    return new MockQuat(this.x, this.y, this.z, this.w);
  }

  transformVector(input: MockVec3, output: MockVec3): MockVec3 {
    output.copy(input);
    return output;
  }
}

// ─── Mock Entity ────────────────────────────────────────────────────────────

export class MockEntity {
  name: string;
  enabled = true;
  parent: MockEntity | null = null;
  children: MockEntity[] = [];
  tags: { add: ReturnType<typeof vi.fn>; has: ReturnType<typeof vi.fn> };

  // Component data set by addComponent
  render: {
    meshInstances: Array<{ material: MockStandardMaterial }>;
  } | null = null;
  model: unknown = null;
  camera: {
    clearColor: MockColor;
    worldToScreen: ReturnType<typeof vi.fn>;
  } | null = null;
  light: unknown = null;

  // Transform state
  private localPosition = new MockVec3();
  private localRotation = new MockQuat();
  private localScale = new MockVec3(1, 1, 1);
  private worldPosition = new MockVec3();

  setLocalPosition = vi.fn((x: number, y: number, z: number) => {
    this.localPosition.set(x, y, z);
    this.worldPosition.set(x, y, z);
  });

  setLocalRotation = vi.fn((x: number, y: number, z: number, w: number) => {
    this.localRotation.x = x;
    this.localRotation.y = y;
    this.localRotation.z = z;
    this.localRotation.w = w;
  });

  setLocalScale = vi.fn((x: number, y: number, z: number) => {
    this.localScale.set(x, y, z);
  });

  setPosition = vi.fn((pos: MockVec3 | number, y?: number, z?: number) => {
    if (typeof pos === "number") {
      this.worldPosition.set(pos, y ?? 0, z ?? 0);
    } else {
      this.worldPosition.copy(pos);
    }
  });

  setEulerAngles = vi.fn();
  getWorldTransform = vi.fn(() => ({
    transformVector: vi.fn((_input: MockVec3, output: MockVec3) => output),
  }));

  getLocalPosition(): MockVec3 {
    return this.localPosition;
  }

  getLocalRotation(): MockQuat {
    return this.localRotation;
  }

  getLocalScale(): MockVec3 {
    return this.localScale;
  }

  getPosition(): MockVec3 {
    return this.worldPosition;
  }

  addChild = vi.fn((child: MockEntity) => {
    child.parent = this;
    this.children.push(child);
  });

  removeChild = vi.fn((child: MockEntity) => {
    child.parent = null;
    const idx = this.children.indexOf(child);
    if (idx >= 0) this.children.splice(idx, 1);
  });

  addComponent = vi.fn((type: string, data?: Record<string, unknown>) => {
    if (type === "render") {
      this.render = { meshInstances: [] };
    } else if (type === "camera") {
      this.camera = {
        clearColor: data?.["clearColor"] instanceof MockColor
          ? data["clearColor"] as MockColor
          : new MockColor(),
        worldToScreen: vi.fn(),
      };
    } else if (type === "light") {
      this.light = { ...data };
    }
    return data ?? {};
  });

  removeComponent = vi.fn();

  findByName = vi.fn((name: string): MockEntity | null => {
    if (this.name === name) return this;
    for (const child of this.children) {
      const found = child.findByName(name);
      if (found) return found;
    }
    return null;
  });

  destroy = vi.fn(() => {
    if (this.parent) {
      this.parent.removeChild(this);
    }
  });

  constructor(name = "Entity") {
    this.name = name;
    this.tags = {
      add: vi.fn(),
      has: vi.fn(() => false),
    };
  }
}

// ─── Mock StandardMaterial ──────────────────────────────────────────────────

export class MockStandardMaterial {
  name = "";
  diffuse = new MockColor(1, 1, 1);
  emissive = new MockColor(0, 0, 0);
  metalness = 0;
  useMetalness = false;
  useMetalnessSpecularColor = true;
  gloss = 1;
  opacity = 1;
  emissiveIntensity = 1;
  blendType = 0;
  alphaTest = 0;
  cull = 1;
  twoSidedLighting = false;

  update = vi.fn();
  destroy = vi.fn();
  clone = vi.fn(() => new MockStandardMaterial());
}

// ─── Mock Material (base class) ─────────────────────────────────────────────

export class MockMaterial {
  name = "";
}

// ─── Mock Application ───────────────────────────────────────────────────────

export class MockApplication {
  root: MockEntity;
  scene: {
    ambientLight: MockColor;
    skyboxIntensity: number;
    exposure: number;
    fog: {
      type: number;
      color: MockColor;
      start: number;
      end: number;
      density: number;
    };
    layers: {
      getLayerByName: ReturnType<typeof vi.fn>;
    };
  };
  graphicsDevice: {
    canvas: HTMLCanvasElement | null;
  };
  assets: {
    add: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
    loadFromUrlAndFilename: ReturnType<typeof vi.fn>;
  };
  timeScale: number;

  start = vi.fn();
  destroy = vi.fn();
  fire = vi.fn();
  on = vi.fn();
  off = vi.fn();
  once = vi.fn((_event: string, callback: () => void) => {
    // Immediately invoke callback to simulate frameend in tests
    callback();
  });
  drawLine = vi.fn();
  resizeCanvas = vi.fn();
  setCanvasFillMode = vi.fn();
  setCanvasResolution = vi.fn();

  constructor(_canvas?: HTMLCanvasElement | null, _opts?: unknown) {
    this.root = new MockEntity("Root");
    this.scene = {
      ambientLight: new MockColor(0, 0, 0),
      skyboxIntensity: 1,
      exposure: 1,
      fog: {
        type: 0,
        color: new MockColor(1, 1, 1),
        start: 0,
        end: 100,
        density: 0.01,
      },
      layers: {
        getLayerByName: vi.fn(() => ({ id: 1, name: "World" })),
      },
    };
    this.graphicsDevice = { canvas: null };
    this.assets = {
      add: vi.fn(),
      load: vi.fn(),
      loadFromUrlAndFilename: vi.fn(),
    };
    this.timeScale = 0;
  }
}

// ─── Mock Gizmo Classes ─────────────────────────────────────────────────────

export class MockGizmo {
  snap = false;
  snapIncrement = 1;

  on = vi.fn();
  off = vi.fn();
  attach = vi.fn();
  detach = vi.fn();
  destroy = vi.fn();

  static createLayer = vi.fn(() => ({ id: 99, name: "Gizmo" }));
}

export class MockTranslateGizmo extends MockGizmo {}
export class MockRotateGizmo extends MockGizmo {}
export class MockScaleGizmo extends MockGizmo {}

// ─── Mock Layer ─────────────────────────────────────────────────────────────

export class MockLayer {
  id = 1;
  name = "World";
}

// ─── Mock Asset ─────────────────────────────────────────────────────────────

export class MockAsset {
  name: string;
  type: string;
  data: unknown;
  resource: unknown = null;
  private eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();

  on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    const handlers = this.eventHandlers.get(event) ?? [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  });

  fire(event: string, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event) ?? [];
    for (const handler of handlers) {
      handler(...args);
    }
  }

  constructor(name: string, type: string, data?: unknown) {
    this.name = name;
    this.type = type;
    this.data = data;
  }
}

// ─── Mock Mouse / Keyboard ──────────────────────────────────────────────────

export class MockMouse {
  constructor(_element?: unknown) {
    // No-op
  }
}

export class MockKeyboard {
  constructor(_element?: unknown) {
    // No-op
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const PC_CONSTANTS = {
  BLEND_NORMAL: 2,
  BLEND_NONE: 3,
  SHADOW_PCF3: 2,
  FILLMODE_NONE: 0,
  FILLMODE_FILL_WINDOW: 1,
  RESOLUTION_AUTO: 0,
  PROJECTION_PERSPECTIVE: 0,
  PROJECTION_ORTHOGRAPHIC: 1,
  CULLFACE_NONE: 0,
  CULLFACE_BACK: 1,
  FOG_NONE: "none",
  FOG_LINEAR: "linear",
  FOG_EXP: "exp",
  FOG_EXP2: "exp2",
};

// ─── Setup Function ─────────────────────────────────────────────────────────

/**
 * Call this before any imports of modules that use "playcanvas".
 * Must be called inside vi.mock() hoisted block or at module top level.
 *
 * Returns the mock module for direct assertions.
 */
export function createPlayCanvasMockModule() {
  return {
    Entity: MockEntity,
    Application: MockApplication,
    StandardMaterial: MockStandardMaterial,
    Material: MockMaterial,
    Color: MockColor,
    Vec3: MockVec3,
    Quat: MockQuat,
    Layer: MockLayer,
    Asset: MockAsset,
    Mouse: MockMouse,
    Keyboard: MockKeyboard,
    Gizmo: MockGizmo,
    TranslateGizmo: MockTranslateGizmo,
    RotateGizmo: MockRotateGizmo,
    ScaleGizmo: MockScaleGizmo,
    GraphNode: MockEntity,
    // Constants
    BLEND_NORMAL: PC_CONSTANTS.BLEND_NORMAL,
    BLEND_NONE: PC_CONSTANTS.BLEND_NONE,
    SHADOW_PCF3: PC_CONSTANTS.SHADOW_PCF3,
    FILLMODE_NONE: PC_CONSTANTS.FILLMODE_NONE,
    FILLMODE_FILL_WINDOW: PC_CONSTANTS.FILLMODE_FILL_WINDOW,
    RESOLUTION_AUTO: PC_CONSTANTS.RESOLUTION_AUTO,
    PROJECTION_PERSPECTIVE: PC_CONSTANTS.PROJECTION_PERSPECTIVE,
    PROJECTION_ORTHOGRAPHIC: PC_CONSTANTS.PROJECTION_ORTHOGRAPHIC,
    CULLFACE_NONE: PC_CONSTANTS.CULLFACE_NONE,
    CULLFACE_BACK: PC_CONSTANTS.CULLFACE_BACK,
    FOG_NONE: PC_CONSTANTS.FOG_NONE,
    FOG_LINEAR: PC_CONSTANTS.FOG_LINEAR,
    FOG_EXP: PC_CONSTANTS.FOG_EXP,
    FOG_EXP2: PC_CONSTANTS.FOG_EXP2,
  };
}
