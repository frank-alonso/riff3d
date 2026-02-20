"use client";

import { useState, useMemo, useCallback } from "react";
import { Search } from "lucide-react";
import { getAssetsByCategory, getStarterAsset, STARTER_ASSETS } from "@/lib/asset-manager";
import type { AssetCategory } from "@/lib/asset-manager";
import { AssetCard } from "./asset-card";
import { GlbImportButton } from "./glb-import";
import { useEditorStore } from "@/stores/hooks";
import { generateOpId } from "@riff3d/ecson";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import type { PatchOp } from "@riff3d/patchops";

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  primitives: "Primitives",
  lights: "Lights",
  cameras: "Cameras",
  other: "Other",
};

const CATEGORY_ORDER: AssetCategory[] = ["primitives", "lights", "cameras", "other"];

/**
 * Full asset browser panel displayed in the left sidebar.
 *
 * Shows starter assets organized by category with a search filter.
 * Assets can be clicked to spawn at origin or dragged to the viewport.
 *
 * Key link: Spawning an asset calls `asset.createOps(parentId)` and
 * dispatches the result as a BatchOp via `editorStore.dispatchOp`.
 */
export function AssetBrowser() {
  const [searchQuery, setSearchQuery] = useState("");
  const dispatchOp = useEditorStore((s) => s.dispatchOp);
  const ecsonDoc = useEditorStore((s) => s.ecsonDoc);
  const setSelection = useEditorStore((s) => s.setSelection);

  const assetsByCategory = useMemo(() => getAssetsByCategory(), []);

  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return null; // null means show by category
    const query = searchQuery.toLowerCase();
    return STARTER_ASSETS.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  const handleSpawn = useCallback(
    (assetId: string) => {
      const asset = getStarterAsset(assetId);
      if (!asset || !ecsonDoc) return;

      const parentId = ecsonDoc.rootEntityId;
      const ops = asset.createOps(parentId);

      if (ops.length === 0) return;

      // Extract the new entity ID from the first CreateEntity op
      const createOp = ops.find((op) => op.type === "CreateEntity");
      const newEntityId = createOp
        ? (createOp.payload as { entityId: string }).entityId
        : null;

      // Wrap in BatchOp for atomic dispatch
      const batchOp: PatchOp = {
        id: generateOpId(),
        timestamp: Date.now(),
        origin: "user",
        version: CURRENT_PATCHOP_VERSION,
        type: "BatchOp",
        payload: { ops },
      };

      dispatchOp(batchOp);

      // Select the newly created entity
      if (newEntityId) {
        setSelection([newEntityId]);
      }
    },
    [dispatchOp, ecsonDoc, setSelection],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Search input + Import button */}
      <div className="border-b border-[var(--border)] px-3 py-2">
        <div className="mb-2 flex items-center gap-2 rounded-md bg-[var(--muted)] px-2 py-1.5">
          <Search size={12} className="text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
          />
        </div>
        <GlbImportButton />
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-auto px-2 py-2">
        {filteredAssets ? (
          // Search results
          filteredAssets.length > 0 ? (
            <div className="grid grid-cols-3 gap-1">
              {filteredAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onSpawn={handleSpawn}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-xs text-[var(--muted-foreground)]">
              No assets match &ldquo;{searchQuery}&rdquo;
            </div>
          )
        ) : (
          // Categorized view
          CATEGORY_ORDER.map((category) => {
            const assets = assetsByCategory[category];
            if (assets.length === 0) return null;

            return (
              <div key={category} className="mb-3">
                <h4 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {CATEGORY_LABELS[category]}
                </h4>
                <div className="grid grid-cols-3 gap-1">
                  {assets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onSpawn={handleSpawn}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
