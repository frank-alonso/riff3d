import { Database } from "@hocuspocus/extension-database";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as Y from "yjs";

/**
 * Create the Hocuspocus Database extension for Supabase Postgres persistence.
 *
 * - `fetch`: Loads Y.Doc binary state from the `collab_documents` table.
 * - `store`: Upserts Y.Doc binary state to `collab_documents` and also
 *   updates the `projects.ecson` column from the Y.Doc so non-collab
 *   project loads still work.
 */
export function createPersistenceExtension(
  supabase: SupabaseClient,
): Database {
  return new Database({
    async fetch({ documentName }) {
      const { data, error } = await supabase
        .from("collab_documents")
        .select("ydoc_state")
        .eq("project_id", documentName)
        .single();

      if (error) {
        // PGRST116 = "not found" (no rows matched) -- expected for first collab session
        if (error.code === "PGRST116") {
          return null;
        }
        // Any other DB error is unexpected -- log and throw to prevent
        // Hocuspocus from initializing a blank Y.Doc that could overwrite
        // persisted state on the next store() call.
        console.error(
          `[collab] DB error fetching Y.Doc for ${documentName}:`,
          error.code,
          error.message,
        );
        throw new Error(
          `Failed to fetch collab document: ${error.code} ${error.message}`,
        );
      }

      if (!data?.ydoc_state) {
        // Row exists but no Y.Doc state -- treat as first session
        return null;
      }

      // Decode the base64-encoded Y.Doc state to a Uint8Array
      return Buffer.from(data.ydoc_state as string, "base64");
    },

    async store({ documentName, state }) {
      const base64State = Buffer.from(state).toString("base64");

      // Upsert the Y.Doc binary state
      const { error: upsertError } = await supabase
        .from("collab_documents")
        .upsert(
          {
            project_id: documentName,
            ydoc_state: base64State,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "project_id" },
        );

      if (upsertError) {
        console.error(
          `[collab] Failed to persist Y.Doc for ${documentName}:`,
          upsertError.message,
        );
      }

      // Also attempt to decode Y.Doc back to ECSON and update the projects
      // table so solo (non-collab) project loads still have fresh data.
      // This is best-effort -- a decode failure should not block Y.Doc persistence.
      try {
        syncEcsonToProject(supabase, documentName, state);
      } catch (err) {
        console.error(
          `[collab] Failed to sync ECSON for ${documentName}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    },
  });
}

/**
 * Decode a Y.Doc binary state to ECSON JSON and update the projects table.
 *
 * The Y.Doc structure mirrors the ECSON SceneDocument (see sync-bridge.ts):
 * - 'meta' Y.Map: id, name, schemaVersion, rootEntityId
 * - 'entities' Y.Map<entityId, Y.Map<prop, value>>: nested per-entity maps
 * - 'assets' Y.Map<assetId, assetJSON>
 * - 'environment' Y.Map
 */
export function syncEcsonToProject(
  supabase: SupabaseClient,
  projectId: string,
  state: Uint8Array,
): void {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);

  const yMeta = doc.getMap("meta");
  const yEntities = doc.getMap("entities");
  const yAssets = doc.getMap("assets");
  const yEnvironment = doc.getMap("environment");
  const yWiring = doc.getArray("wiring");
  const yMetadata = doc.getMap("metadata");

  // Reconstruct entities from nested Y.Maps
  const entities: Record<string, unknown> = {};
  for (const [entityId, yEntity] of yEntities.entries()) {
    if (yEntity instanceof Y.Map) {
      entities[entityId] = yEntity.toJSON();
    } else {
      entities[entityId] = yEntity;
    }
  }

  // Reconstruct the ECSON document from Y.Doc maps
  const ecson = {
    id: yMeta.get("id") as string,
    name: yMeta.get("name") as string,
    schemaVersion: yMeta.get("schemaVersion") as number,
    rootEntityId: yMeta.get("rootEntityId") as string,
    entities,
    assets: yAssets.toJSON(),
    wiring: yWiring.toJSON(),
    environment: yEnvironment.toJSON(),
    metadata: yMetadata.toJSON(),
  };

  // Only update if we have valid data
  if (ecson.id && ecson.rootEntityId) {
    void supabase
      .from("projects")
      .update({
        ecson,
        entity_count: Object.keys(ecson.entities).length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .then(({ error }) => {
        if (error) {
          console.error(
            `[collab] Failed to update projects.ecson for ${projectId}:`,
            error.message,
          );
        }
      });
  }

  doc.destroy();
}
