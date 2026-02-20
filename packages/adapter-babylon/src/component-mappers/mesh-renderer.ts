import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { CanonicalComponent, CanonicalNode } from "@riff3d/canonical-ir";
import { applyMaterial } from "./material";

/**
 * Primitive type -> Babylon.js mesh builder mapping.
 *
 * Each function creates a Babylon Mesh primitive with reasonable defaults.
 * Cone is created using CreateCylinder with diameterTop: 0.
 */
const PRIMITIVE_BUILDERS: Record<
  string,
  (name: string, scene: Scene) => Mesh
> = {
  box: (name, scene) => CreateBox(name, { size: 1 }, scene),
  sphere: (name, scene) => CreateSphere(name, { segments: 32, diameter: 1 }, scene),
  cylinder: (name, scene) => CreateCylinder(name, { height: 1, diameter: 1 }, scene),
  capsule: (name, scene) => CreateCapsule(name, { height: 1, radius: 0.25 }, scene),
  cone: (name, scene) =>
    CreateCylinder(name, { height: 1, diameterTop: 0, diameterBottom: 1 }, scene),
  plane: (name, scene) => CreateGround(name, { width: 1, height: 1 }, scene),
  torus: (name, scene) => CreateTorus(name, { diameter: 1, thickness: 0.25 }, scene),
};

/**
 * Apply a MeshRenderer IR component to a Babylon.js scene.
 *
 * Creates the appropriate primitive mesh and applies material if present.
 * Returns the mesh node (caller must position/parent it).
 *
 * IR convention: 1:N entity-to-node mapping means one ECSON entity maps to
 * one IR node. The MeshRenderer component specifies either a primitive shape
 * or an external mesh asset ID.
 */
export function applyMeshRenderer(
  scene: Scene,
  irNode: CanonicalNode,
  component: CanonicalComponent,
): Mesh | null {
  const props = component.properties;
  const primitive = props["primitive"];

  if (typeof primitive === "string" && primitive in PRIMITIVE_BUILDERS) {
    const builder = PRIMITIVE_BUILDERS[primitive]!;
    const mesh = builder(irNode.name, scene);

    // Apply material if found on the same IR node
    const materialComp = irNode.components.find((c) => c.type === "Material");
    if (materialComp) {
      mesh.material = applyMaterial(scene, materialComp);
    }

    return mesh;
  }

  if (typeof props["meshAssetId"] === "string") {
    // Asset-based mesh -- placeholder box for now (asset pipeline deferred)
    const mesh = CreateBox(irNode.name, { size: 1 }, scene);
    return mesh;
  }

  return null;
}
