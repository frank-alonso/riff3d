"use client";

import { useCallback, useMemo } from "react";
import { STRIP_ASSET_IDS, getStarterAsset, ASSET_DRAG_MIME } from "@/lib/asset-manager";
import { AssetCard } from "./asset-card";
import { useEditorStore } from "@/stores/hooks";
import { generateOpId } from "@riff3d/ecson";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import type { PatchOp } from "@riff3d/patchops";

/**
 * Compact asset strip below the viewport for quick drag-and-drop.
 *
 * Shows the most commonly used assets as small icon buttons in a
 * horizontal scrollable row. Same drag-and-drop behavior as the
 * full asset browser.
 */
export function AssetStrip() {
  const dispatchOp = useEditorStore((s) => s.dispatchOp);
  const ecsonDoc = useEditorStore((s) => s.ecsonDoc);
  const setSelection = useEditorStore((s) => s.setSelection);

  const stripAssets = useMemo(
    () =>
      STRIP_ASSET_IDS.map((id) => getStarterAsset(id)).filter(
        (a): a is NonNullable<typeof a> => a != null,
      ),
    [],
  );

  const handleSpawn = useCallback(
    (assetId: string) => {
      const asset = getStarterAsset(assetId);
      if (!asset || !ecsonDoc) return;

      const parentId = ecsonDoc.rootEntityId;
      const ops = asset.createOps(parentId);
      if (ops.length === 0) return;

      const createOp = ops.find((op) => op.type === "CreateEntity");
      const newEntityId = createOp
        ? (createOp.payload as { entityId: string }).entityId
        : null;

      const batchOp: PatchOp = {
        id: generateOpId(),
        timestamp: Date.now(),
        origin: "user",
        version: CURRENT_PATCHOP_VERSION,
        type: "BatchOp",
        payload: { ops },
      };

      dispatchOp(batchOp);

      if (newEntityId) {
        setSelection([newEntityId]);
      }
    },
    [dispatchOp, ecsonDoc, setSelection],
  );

  return (
    <div className="flex h-8 items-center gap-1 overflow-x-auto border-t border-[var(--border)] bg-[var(--panel)] px-2">
      <span className="mr-1 flex-shrink-0 text-[9px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Quick
      </span>
      {stripAssets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          onSpawn={handleSpawn}
          compact
        />
      ))}
    </div>
  );
}

// Re-export ASSET_DRAG_MIME for use by the viewport drop handler
export { ASSET_DRAG_MIME };
