"use client";

import type { DragEvent } from "react";
import {
  Box,
  Circle,
  Triangle,
  Square,
  Lightbulb,
  Sun,
  Camera,
  Scan,
  Folder,
  Pill,
} from "lucide-react";
import type { StarterAsset } from "@/lib/asset-manager";
import { ASSET_DRAG_MIME } from "@/lib/asset-manager";

/**
 * Icon lookup table mapping asset icon names to Lucide components.
 * Falls back to Box for unknown icon names.
 */
const ICON_MAP: Record<string, typeof Box> = {
  Box,
  Circle,
  Triangle,
  Square,
  Lightbulb,
  Sun,
  Camera,
  Scan,
  Folder,
  Pill,
  CylinderIcon: Box, // No cylinder icon in lucide, use Box
  FlashlightIcon: Lightbulb, // No flashlight icon, use Lightbulb
};

interface AssetCardProps {
  asset: StarterAsset;
  /** Called when user clicks the card to spawn the asset at origin. */
  onSpawn: (assetId: string) => void;
  /** Compact mode for the asset strip (smaller, horizontal). */
  compact?: boolean;
}

/**
 * An individual asset card in the browser or strip.
 *
 * Supports:
 * - Click to spawn at origin
 * - Drag to viewport for drop-to-spawn
 * - Hover tooltip with description
 */
export function AssetCard({ asset, onSpawn, compact }: AssetCardProps) {
  const IconComponent = ICON_MAP[asset.icon] ?? Box;

  const handleDragStart = (e: DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(ASSET_DRAG_MIME, asset.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  if (compact) {
    return (
      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onClick={() => onSpawn(asset.id)}
        title={`${asset.name} - ${asset.description}`}
        className="flex h-7 w-7 flex-shrink-0 cursor-grab items-center justify-center rounded transition-colors hover:bg-[var(--muted)] active:cursor-grabbing"
      >
        <IconComponent size={14} className="text-[var(--muted-foreground)]" />
      </button>
    );
  }

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onClick={() => onSpawn(asset.id)}
      title={asset.description}
      className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-transparent p-2 transition-colors hover:border-[var(--border)] hover:bg-[var(--muted)] active:cursor-grabbing"
    >
      <IconComponent size={20} className="text-[var(--muted-foreground)]" />
      <span className="text-[10px] leading-tight text-[var(--foreground)]">
        {asset.name}
      </span>
    </button>
  );
}
