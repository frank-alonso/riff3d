"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "@/stores/hooks";
import { editorStore } from "@/stores/editor-store";
import { glbToEcsonOps } from "@/lib/glb-to-ecson";
import { generateOpId } from "@riff3d/ecson";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import type { PatchOp } from "@riff3d/patchops";

/**
 * GLB/glTF import button for the asset browser.
 *
 * Opens a file picker for .glb/.gltf files. On selection:
 * 1. Creates a temporary object URL for the file
 * 2. Loads it into PlayCanvas via the adapter's GLB loader
 * 3. Converts the hierarchy to ECSON PatchOps via glbToEcsonOps
 * 4. Dispatches the ops as a BatchOp
 * 5. Shows a success toast with entity/material count
 *
 * Note: In Phase 2, files are loaded locally via object URL.
 * Supabase Storage upload is deferred until the collaboration
 * phase since local-only editing doesn't need remote storage.
 */
export function GlbImportButton() {
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ecsonDoc = useEditorStore((s) => s.ecsonDoc);

  const handleImport = useCallback(async () => {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) return;

    const file = files[0]!;
    const doc = editorStore.getState().ecsonDoc;
    if (!doc) {
      toast.error("No project loaded");
      return;
    }

    setImporting(true);

    try {
      // Create a temporary URL for the file
      const objectUrl = URL.createObjectURL(file);

      // Dynamically import the GLB loader to avoid pulling PlayCanvas into SSR
      const { importGlb } = await import(
        "@riff3d/adapter-playcanvas/editor-tools"
      );

      // We need the PlayCanvas app instance -- get it from the viewport adapter
      // The adapter is stored in the ViewportProvider context, but we can access
      // it via a custom event since the GLB loader needs the pc.Application.
      // For Phase 2, use a simpler approach: dispatch a custom event that the
      // viewport canvas can handle, or access the adapter directly.

      // Access the adapter's app via a global-ish mechanism:
      // The viewport-provider stores the adapter ref. We'll use a DOM event
      // to request the app instance from the viewport canvas.
      const appInstance = await getPlayCanvasApp();

      if (!appInstance) {
        toast.error("Viewport not ready. Please wait for the 3D engine to initialize.");
        setImporting(false);
        return;
      }

      // importGlb expects a PlayCanvas Application. The editor doesn't
      // import PlayCanvas types directly (architecture boundary), so we
      // use a typed wrapper that accepts the opaque app instance.
      const importResult = await importGlb(
        appInstance as Parameters<typeof importGlb>[0],
        objectUrl,
      );

      // Convert to ECSON PatchOps
      const parentId = doc.rootEntityId;
      const { ops, rootEntityId, entityCount, materialCount } =
        glbToEcsonOps(importResult, parentId);

      // Destroy the temporary PlayCanvas entity (we only needed it for data extraction)
      importResult.rootEntity.destroy();

      // Revoke the object URL
      URL.revokeObjectURL(objectUrl);

      if (ops.length === 0) {
        toast.error("GLB file contained no importable data");
        setImporting(false);
        return;
      }

      // Dispatch as BatchOp
      const batchOp: PatchOp = {
        id: generateOpId(),
        timestamp: Date.now(),
        origin: "user",
        version: CURRENT_PATCHOP_VERSION,
        type: "BatchOp",
        payload: { ops },
      };

      editorStore.getState().dispatchOp(batchOp);
      editorStore.getState().setSelection([rootEntityId]);

      toast.success(
        `Imported ${file.name} (${entityCount} entities, ${materialCount} materials)`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error during GLB import";
      toast.error(`Import failed: ${message}`);
    } finally {
      setImporting(false);
      // Reset file input so the same file can be re-imported
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, []);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        className="hidden"
        onChange={() => void handleImport()}
      />
      <button
        type="button"
        disabled={importing || !ecsonDoc}
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
      >
        {importing ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Upload size={12} />
        )}
        {importing ? "Importing..." : "Import GLB"}
      </button>
    </>
  );
}

/**
 * Get the PlayCanvas Application instance from the viewport adapter.
 *
 * Uses a custom DOM event to request the app from the viewport canvas,
 * which responds via a callback. This avoids tight coupling between
 * the import button and the viewport context.
 */
function getPlayCanvasApp(): Promise<unknown> {
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { app: unknown };
      resolve(detail.app);
      window.removeEventListener("riff3d:provide-app", handler);
    };

    window.addEventListener("riff3d:provide-app", handler);
    window.dispatchEvent(new CustomEvent("riff3d:request-app"));

    // Timeout after 2 seconds if no response
    setTimeout(() => {
      window.removeEventListener("riff3d:provide-app", handler);
      resolve(null);
    }, 2000);
  });
}
