"use client";

import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { editorStore } from "@/stores/editor-store";
import { createClient } from "@/lib/supabase/client";

/** Op types that represent structural changes and trigger immediate save. */
const STRUCTURAL_OPS = new Set([
  "CreateEntity",
  "DeleteEntity",
  "Reparent",
  "AddComponent",
  "RemoveComponent",
  "BatchOp",
]);

/** Debounce delay for property/transform changes (milliseconds). */
const SAVE_DEBOUNCE_MS = 5000;

/**
 * Auto-save hook: monitors docVersion changes and persists the ECSON document
 * to Supabase with a 5-second idle debounce. Structural changes and Ctrl+S
 * bypass the debounce and save immediately.
 *
 * Also saves on visibility change (tab blur) and listens for manual save events.
 *
 * **Collaboration integration (05-02):** When `isCollaborating` is true,
 * auto-save is SKIPPED because persistence is handled server-side by
 * the Hocuspocus Database extension. Only manual Ctrl+S is allowed as a
 * safety-net save during collaboration.
 */
export function useAutoSave(projectId: string): void {
  const lastSavedVersionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  const saveProject = useCallback(async () => {
    const { ecsonDoc, docVersion, setSaveStatus, markSaved } =
      editorStore.getState();

    // No document or already up-to-date
    if (!ecsonDoc || docVersion === lastSavedVersionRef.current) return;
    // Prevent concurrent saves
    if (isSavingRef.current) return;

    isSavingRef.current = true;
    setSaveStatus("saving");

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("projects")
        .update({
          ecson: ecsonDoc,
          entity_count: Object.keys(ecsonDoc.entities).length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      if (error) {
        setSaveStatus("error");
        toast.error("Failed to save", {
          description: error.message,
          action: {
            label: "Retry",
            onClick: () => void saveProject(),
          },
        });
        return;
      }

      lastSavedVersionRef.current = docVersion;
      markSaved();

      // Attempt thumbnail capture (non-critical, silently continue on failure)
      void captureThumbnail(projectId);
    } catch {
      setSaveStatus("error");
      toast.error("Failed to save");
    } finally {
      isSavingRef.current = false;
    }
  }, [projectId]);

  // Subscribe to docVersion changes
  useEffect(() => {
    const unsubscribe = editorStore.subscribe(
      (state) => state.docVersion,
      (docVersion) => {
        if (docVersion === 0) return; // Initial state, no changes
        if (docVersion === lastSavedVersionRef.current) return;

        // Skip auto-save when collaborating -- Hocuspocus server handles persistence.
        // Manual Ctrl+S still triggers via the riff3d:manual-save event below.
        const { isCollaborating } = editorStore.getState();
        if (isCollaborating) return;

        // Mark as unsaved immediately
        editorStore.getState().setSaveStatus("unsaved");

        // Clear existing timer
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }

        // Check if this is a structural change that should trigger immediate save
        const { lastOpType } = editorStore.getState();
        if (lastOpType !== null && STRUCTURAL_OPS.has(lastOpType)) {
          void saveProject();
          return;
        }

        // Debounce for non-structural changes (property edits, transforms)
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          void saveProject();
        }, SAVE_DEBOUNCE_MS);
      },
    );

    return () => {
      unsubscribe();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [saveProject]);

  // Save on visibility change (tab blur)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void saveProject();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [saveProject]);

  // Listen for manual save events (Ctrl+S dispatches this)
  useEffect(() => {
    function handleManualSave() {
      // Clear debounce timer since we're saving now
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void saveProject();
    }

    window.addEventListener("riff3d:manual-save", handleManualSave);
    return () => {
      window.removeEventListener("riff3d:manual-save", handleManualSave);
    };
  }, [saveProject]);
}

/**
 * Attempt to capture a viewport thumbnail and upload to Supabase Storage.
 * Non-critical -- silently continues on any failure.
 */
async function captureThumbnail(projectId: string): Promise<void> {
  try {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const supabase = createClient();
    const path = `project-thumbnails/${projectId}.png`;

    const { error: uploadError } = await supabase.storage
      .from("project-thumbnails")
      .upload(path, blob, { upsert: true, contentType: "image/png" });

    if (uploadError) return;

    const { data: urlData } = supabase.storage
      .from("project-thumbnails")
      .getPublicUrl(path);

    if (urlData?.publicUrl) {
      await supabase
        .from("projects")
        .update({ thumbnail_url: urlData.publicUrl })
        .eq("id", projectId);
    }
  } catch {
    // Thumbnail capture is non-critical -- silently continue
  }
}
