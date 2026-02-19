import { customAlphabet, nanoid } from "nanoid";

const ALPHANUMERIC =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Generate a 16-character URL-safe alphanumeric entity ID.
 */
const entityIdGenerator = customAlphabet(ALPHANUMERIC, 16);
export function generateEntityId(): string {
  return entityIdGenerator();
}

/**
 * Generate a 21-character operation ID using default nanoid.
 * Maximum collision resistance for operation logs.
 */
export function generateOpId(): string {
  return nanoid();
}

/**
 * Generate a prefixed asset ID: `ast_` + 12-char alphanumeric.
 */
const assetIdGenerator = customAlphabet(ALPHANUMERIC, 12);
export function generateAssetId(): string {
  return `ast_${assetIdGenerator()}`;
}

/**
 * Generate a prefixed wire ID: `wir_` + 12-char alphanumeric.
 */
const wireIdGenerator = customAlphabet(ALPHANUMERIC, 12);
export function generateWireId(): string {
  return `wir_${wireIdGenerator()}`;
}
