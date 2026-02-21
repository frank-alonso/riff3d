/**
 * 12-color palette for user presence indicators.
 *
 * Colors are chosen to be:
 * - Visually distinct from each other
 * - Readable against dark editor background (#0d0d1e)
 * - WCAG 3:1 contrast ratio for UI components
 * - Non-conflicting with selection highlight (emissive tint) or error red
 */
export const PRESENCE_PALETTE = [
  "#FF6B6B", // Coral red
  "#4ECDC4", // Teal
  "#FFE66D", // Warm yellow
  "#A78BFA", // Soft purple
  "#F97316", // Orange
  "#34D399", // Emerald green
  "#60A5FA", // Sky blue
  "#F472B6", // Pink
  "#FBBF24", // Amber
  "#818CF8", // Indigo
  "#2DD4BF", // Cyan
  "#FB923C", // Tangerine
] as const;

/**
 * Assign a color from the presence palette based on user index.
 * Wraps around if there are more users than colors.
 */
export function assignUserColor(userIndex: number): string {
  return PRESENCE_PALETTE[userIndex % PRESENCE_PALETTE.length]!;
}
