import { Server } from "@hocuspocus/server";
import { createClient } from "@supabase/supabase-js";
import { createAuthHandler, type AuthenticatedUser } from "./auth";
import { createPersistenceExtension } from "./persistence";

/**
 * Hocuspocus collaboration server.
 *
 * Provides real-time Yjs document sync via WebSocket, with:
 * - Supabase JWT authentication (verifies user, checks project access)
 * - Supabase Postgres persistence (stores Y.Doc state, syncs back to ECSON)
 * - Configurable port and CORS origin
 *
 * Environment variables:
 * - COLLAB_PORT: WebSocket server port (default 1234)
 * - EDITOR_ORIGIN: Allowed CORS origin (default http://localhost:3000)
 * - SUPABASE_URL: Supabase project URL (required)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (required)
 */
export function createCollabServer(): Server {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const authHandler = createAuthHandler(supabase);

  const server = new Server({
    port: Number(process.env.COLLAB_PORT) || 1234,

    async onAuthenticate(data) {
      const user = await authHandler({
        token: data.token,
        documentName: data.documentName,
      });

      // Set read-only for non-owners via connectionConfig
      data.connectionConfig.readOnly = !user.isOwner;

      // Return the context data (available in other hooks via `context`)
      return user satisfies AuthenticatedUser;
    },

    async onDisconnect({ documentName, context }) {
      const user = context as AuthenticatedUser | undefined;
      console.log(
        `[collab] User "${user?.name ?? "unknown"}" disconnected from ${documentName}`,
      );
    },

    extensions: [createPersistenceExtension(supabase)],
  });

  return server;
}
