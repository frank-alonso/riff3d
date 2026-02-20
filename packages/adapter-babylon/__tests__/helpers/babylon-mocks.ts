/**
 * Shared Babylon.js mock factory for adapter tests.
 *
 * Provides fake implementations of Babylon.js classes so tests can verify
 * correct API usage without WebGL/GPU dependency. Each mock captures
 * constructor args and property assignments for assertion.
 *
 * Usage: vi.mock("@babylonjs/core/...", () => ...) with these classes.
 */
import { vi } from "vitest";

// ─── Mock Vector3 ────────────────────────────────────────────────────────────

export class MockVector3 {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static Zero(): MockVector3 {
    return new MockVector3(0, 0, 0);
  }
}

// ─── Mock Quaternion ─────────────────────────────────────────────────────────

export class MockQuaternion {
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
}

// ─── Mock Color3 ─────────────────────────────────────────────────────────────

export class MockColor3 {
  r: number;
  g: number;
  b: number;

  constructor(r = 0, g = 0, b = 0) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  scale(factor: number): MockColor3 {
    return new MockColor3(this.r * factor, this.g * factor, this.b * factor);
  }

  static FromHexString(hex: string): MockColor3 {
    const h = hex.replace(/^#/, "");
    let r: number;
    let g: number;
    let b: number;

    if (h.length === 3) {
      r = parseInt(h[0]! + h[0]!, 16) / 255;
      g = parseInt(h[1]! + h[1]!, 16) / 255;
      b = parseInt(h[2]! + h[2]!, 16) / 255;
    } else {
      r = parseInt(h.substring(0, 2), 16) / 255;
      g = parseInt(h.substring(2, 4), 16) / 255;
      b = parseInt(h.substring(4, 6), 16) / 255;
    }

    return new MockColor3(r, g, b);
  }
}

// ─── Mock Color4 ─────────────────────────────────────────────────────────────

export class MockColor4 {
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
}

// ─── Mock TransformNode ──────────────────────────────────────────────────────

export class MockTransformNode {
  name: string;
  id = "";
  position = new MockVector3();
  rotationQuaternion: MockQuaternion | null = null;
  scaling = new MockVector3(1, 1, 1);
  parent: MockTransformNode | null = null;
  private _isEnabled = true;

  dispose = vi.fn();
  setEnabled = vi.fn((enabled: boolean) => {
    this._isEnabled = enabled;
  });
  isEnabled = vi.fn(() => this._isEnabled);

  constructor(name: string, _scene?: unknown) {
    this.name = name;
  }
}

// ─── Mock Mesh ───────────────────────────────────────────────────────────────

export class MockMesh extends MockTransformNode {
  material: unknown = null;

  constructor(name: string, _scene?: unknown) {
    super(name, _scene);
  }
}

// ─── Mock PBR Materials ──────────────────────────────────────────────────────

export class MockPBRMetallicRoughnessMaterial {
  name: string;
  baseColor = new MockColor3(1, 1, 1);
  metallic = 0;
  roughness = 1;
  emissiveColor = new MockColor3(0, 0, 0);
  alpha = 1;
  transparencyMode: number | null = null;
  backFaceCulling = true;

  constructor(name: string, _scene?: unknown) {
    this.name = name;
  }
}

export class MockPBRMaterial {
  static PBRMATERIAL_ALPHABLEND = 2;
  static PBRMATERIAL_OPAQUE = 0;
}

// ─── Mock Lights ─────────────────────────────────────────────────────────────

export class MockDirectionalLight {
  name: string;
  direction: MockVector3;
  diffuse = new MockColor3(1, 1, 1);
  intensity = 1;

  constructor(name: string, direction: MockVector3, _scene?: unknown) {
    this.name = name;
    this.direction = direction;
  }
}

export class MockPointLight {
  name: string;
  position: MockVector3;
  diffuse = new MockColor3(1, 1, 1);
  intensity = 1;
  range = 10;

  constructor(name: string, position: MockVector3, _scene?: unknown) {
    this.name = name;
    this.position = position;
  }
}

export class MockSpotLight {
  name: string;
  position: MockVector3;
  direction: MockVector3;
  angle: number;
  exponent: number;
  diffuse = new MockColor3(1, 1, 1);
  intensity = 1;
  range = 10;

  constructor(
    name: string,
    position: MockVector3,
    direction: MockVector3,
    angle: number,
    exponent: number,
    _scene?: unknown,
  ) {
    this.name = name;
    this.position = position;
    this.direction = direction;
    this.angle = angle;
    this.exponent = exponent;
  }
}

// ─── Mock Camera ─────────────────────────────────────────────────────────────

export class MockUniversalCamera {
  name: string;
  position: MockVector3;
  rotationQuaternion: MockQuaternion | null = null;
  fov = 0.8;
  minZ = 0.1;
  maxZ = 1000;
  mode = 0;
  orthoTop: number | null = null;
  orthoBottom: number | null = null;
  orthoLeft: number | null = null;
  orthoRight: number | null = null;

  detachControl = vi.fn();
  setTarget = vi.fn();

  constructor(name: string, position: MockVector3, _scene?: unknown) {
    this.name = name;
    this.position = position;
  }
}

export class MockCamera {
  static ORTHOGRAPHIC_CAMERA = 1;
  static PERSPECTIVE_CAMERA = 0;
}

// ─── Mock Engine ─────────────────────────────────────────────────────────────

export class MockEngine {
  runRenderLoop = vi.fn();
  resize = vi.fn();
  dispose = vi.fn();

  constructor(_canvas?: unknown, _antialias?: boolean, _opts?: unknown) {
    // No-op
  }
}

// ─── Mock Scene ──────────────────────────────────────────────────────────────

export class MockScene {
  clearColor = new MockColor4(0, 0, 0, 1);
  ambientColor = new MockColor3(0, 0, 0);
  fogMode = 0;
  fogColor = new MockColor3(1, 1, 1);
  fogStart = 0;
  fogEnd = 100;
  fogDensity = 0.01;

  render = vi.fn();
  dispose = vi.fn();

  static FOGMODE_NONE = 0;
  static FOGMODE_LINEAR = 2;
  static FOGMODE_EXP = 1;
  static FOGMODE_EXP2 = 3;

  constructor(_engine?: unknown) {
    // No-op
  }
}

// ─── Mesh Builder Mocks ──────────────────────────────────────────────────────

export const mockCreateBox = vi.fn(
  (name: string, _opts: unknown, _scene?: unknown) => new MockMesh(name),
);
export const mockCreateSphere = vi.fn(
  (name: string, _opts: unknown, _scene?: unknown) => new MockMesh(name),
);
export const mockCreateCylinder = vi.fn(
  (name: string, _opts: unknown, _scene?: unknown) => new MockMesh(name),
);
export const mockCreateCapsule = vi.fn(
  (name: string, _opts: unknown, _scene?: unknown) => new MockMesh(name),
);
export const mockCreateGround = vi.fn(
  (name: string, _opts: unknown, _scene?: unknown) => new MockMesh(name),
);
export const mockCreateTorus = vi.fn(
  (name: string, _opts: unknown, _scene?: unknown) => new MockMesh(name),
);

// ─── Setup Function ─────────────────────────────────────────────────────────

/**
 * Create a complete set of Babylon.js mock modules for vi.mock().
 *
 * Returns an object mapping module paths to their mock implementations.
 * Use with vi.mock() for each Babylon sub-module.
 */
export function getBabylonMockModules(): Record<string, () => Record<string, unknown>> {
  return {
    "@babylonjs/core/Engines/engine": () => ({
      Engine: MockEngine,
    }),
    "@babylonjs/core/scene": () => ({
      Scene: MockScene,
    }),
    "@babylonjs/core/Cameras/universalCamera": () => ({
      UniversalCamera: MockUniversalCamera,
    }),
    "@babylonjs/core/Cameras/camera": () => ({
      Camera: MockCamera,
    }),
    "@babylonjs/core/Meshes/transformNode": () => ({
      TransformNode: MockTransformNode,
    }),
    "@babylonjs/core/Meshes/mesh": () => ({
      Mesh: MockMesh,
    }),
    "@babylonjs/core/Maths/math.vector": () => ({
      Vector3: MockVector3,
      Quaternion: MockQuaternion,
    }),
    "@babylonjs/core/Maths/math.color": () => ({
      Color3: MockColor3,
      Color4: MockColor4,
    }),
    "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial": () => ({
      PBRMetallicRoughnessMaterial: MockPBRMetallicRoughnessMaterial,
    }),
    "@babylonjs/core/Materials/PBR/pbrMaterial": () => ({
      PBRMaterial: MockPBRMaterial,
    }),
    "@babylonjs/core/Lights/directionalLight": () => ({
      DirectionalLight: MockDirectionalLight,
    }),
    "@babylonjs/core/Lights/pointLight": () => ({
      PointLight: MockPointLight,
    }),
    "@babylonjs/core/Lights/spotLight": () => ({
      SpotLight: MockSpotLight,
    }),
    "@babylonjs/core/Meshes/Builders/boxBuilder": () => ({
      CreateBox: mockCreateBox,
    }),
    "@babylonjs/core/Meshes/Builders/sphereBuilder": () => ({
      CreateSphere: mockCreateSphere,
    }),
    "@babylonjs/core/Meshes/Builders/cylinderBuilder": () => ({
      CreateCylinder: mockCreateCylinder,
    }),
    "@babylonjs/core/Meshes/Builders/capsuleBuilder": () => ({
      CreateCapsule: mockCreateCapsule,
    }),
    "@babylonjs/core/Meshes/Builders/groundBuilder": () => ({
      CreateGround: mockCreateGround,
    }),
    "@babylonjs/core/Meshes/Builders/torusBuilder": () => ({
      CreateTorus: mockCreateTorus,
    }),
  };
}

/**
 * Apply all Babylon.js mocks. Call this function and pass results
 * to individual vi.mock() calls.
 */
export function setupBabylonMocks(): void {
  // This is a convenience function. The actual vi.mock() calls must
  // be at the top level of each test file (hoisted by vitest).
  // Use getBabylonMockModules() to get the map of modules to mock.
}
