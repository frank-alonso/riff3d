import { PBRMetallicRoughnessMaterial } from "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import type { CanonicalComponent } from "@riff3d/canonical-ir";

/**
 * Parse a hex color string (#rrggbb or #rgb) into a Babylon.js Color3.
 *
 * IR convention: All colors are stored as hex strings (e.g., "#ff0000").
 * Babylon.js uses Color3 with 0-1 float channels.
 */
export function hexToColor3(hex: string): Color3 {
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

  return new Color3(r, g, b);
}

/**
 * Create a Babylon.js PBR material from an IR Material component.
 *
 * IR convention:
 * - roughness: 0 = smooth, 1 = rough (PBR standard)
 * - Babylon.js PBRMetallicRoughnessMaterial uses roughness directly (NO inversion)
 * - metallic maps directly
 * - baseColor is the base color
 * - emissive color for emission
 * - doubleSided controls back-face culling and two-sided lighting
 */
export function applyMaterial(
  scene: Scene,
  component: CanonicalComponent,
): PBRMetallicRoughnessMaterial {
  const props = component.properties;
  const mat = new PBRMetallicRoughnessMaterial("material", scene);

  // Base color
  if (typeof props["baseColor"] === "string") {
    mat.baseColor = hexToColor3(props["baseColor"]);
  }

  // Metallic (direct pass-through)
  if (typeof props["metallic"] === "number") {
    mat.metallic = props["metallic"];
  }

  // Roughness (direct pass-through -- NO inversion unlike PlayCanvas gloss)
  if (typeof props["roughness"] === "number") {
    mat.roughness = props["roughness"];
  }

  // Emissive
  if (typeof props["emissive"] === "string") {
    mat.emissiveColor = hexToColor3(props["emissive"]);
  }

  // Opacity
  if (typeof props["opacity"] === "number") {
    mat.alpha = props["opacity"];
    if (props["opacity"] < 1) {
      mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    }
  }

  // Double-sided
  // Babylon's PBR materials handle two-sided lighting internally when
  // backFaceCulling is disabled.
  if (props["doubleSided"] === true) {
    mat.backFaceCulling = false;
  }

  return mat;
}
