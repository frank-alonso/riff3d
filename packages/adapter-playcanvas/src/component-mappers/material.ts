import * as pc from "playcanvas";
import type { CanonicalComponent } from "@riff3d/canonical-ir";

/**
 * Parse a hex color string (#rrggbb or #rgb) into a PlayCanvas Color.
 *
 * IR convention: All colors are stored as hex strings (e.g., "#ff0000").
 * PlayCanvas uses pc.Color with 0-1 float channels.
 */
export function hexToColor(hex: string): pc.Color {
  const color = new pc.Color();
  // Remove # prefix
  const h = hex.replace(/^#/, "");
  let r: number;
  let g: number;
  let b: number;

  if (h.length === 3) {
    // #rgb shorthand
    r = parseInt(h[0]! + h[0]!, 16) / 255;
    g = parseInt(h[1]! + h[1]!, 16) / 255;
    b = parseInt(h[2]! + h[2]!, 16) / 255;
  } else {
    r = parseInt(h.substring(0, 2), 16) / 255;
    g = parseInt(h.substring(2, 4), 16) / 255;
    b = parseInt(h.substring(4, 6), 16) / 255;
  }

  color.set(r, g, b, 1);
  return color;
}

/**
 * Create a PlayCanvas StandardMaterial from an IR Material component.
 *
 * IR convention:
 * - roughness: 0 = smooth, 1 = rough (PBR standard)
 * - PlayCanvas uses `gloss` which is the inverse: gloss = 1 - roughness
 * - metallic maps directly to metalness
 * - baseColor is the diffuse color
 * - emissive color + emissiveIntensity control emission
 * - doubleSided controls face culling and two-sided lighting
 */
export function createMaterial(component: CanonicalComponent): pc.StandardMaterial {
  const props = component.properties;
  const mat = new pc.StandardMaterial();

  // Base color (diffuse)
  if (typeof props["baseColor"] === "string") {
    mat.diffuse = hexToColor(props["baseColor"]);
  }

  // Metalness
  if (typeof props["metallic"] === "number") {
    mat.metalness = props["metallic"];
    // Enable metalness workflow
    mat.useMetalness = true;
  }

  // Roughness -> Gloss (inverted)
  // IR convention: roughness 0 = smooth, 1 = rough
  // PlayCanvas convention: gloss 1 = smooth, 0 = rough
  if (typeof props["roughness"] === "number") {
    mat.gloss = 1 - props["roughness"];
    mat.useMetalnessSpecularColor = false;
  }

  // Emissive
  if (typeof props["emissive"] === "string") {
    mat.emissive = hexToColor(props["emissive"]);
  }
  if (typeof props["emissiveIntensity"] === "number") {
    mat.emissiveIntensity = props["emissiveIntensity"];
  }

  // Opacity
  if (typeof props["opacity"] === "number") {
    mat.opacity = props["opacity"];
    if (props["opacity"] < 1) {
      mat.blendType = pc.BLEND_NORMAL;
    }
  }

  // Alpha mode
  if (typeof props["alphaMode"] === "string") {
    switch (props["alphaMode"]) {
      case "blend":
        mat.blendType = pc.BLEND_NORMAL;
        break;
      case "mask":
        mat.blendType = pc.BLEND_NONE;
        mat.alphaTest = typeof props["alphaCutoff"] === "number" ? props["alphaCutoff"] : 0.5;
        break;
      case "opaque":
      default:
        mat.blendType = pc.BLEND_NONE;
        break;
    }
  }

  // Double-sided
  if (props["doubleSided"] === true) {
    mat.cull = pc.CULLFACE_NONE;
    mat.twoSidedLighting = true;
  }

  mat.update();
  return mat;
}
