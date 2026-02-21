import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * User metadata returned from authentication.
 * The color is assigned by the server from the presence palette.
 */
export interface AuthenticatedUser {
  id: string;
  name: string;
  color: string;
  isOwner: boolean;
}

/**
 * 12-color presence palette for user assignment.
 * Visually distinct against dark editor background (#0d0d1e).
 */
const PRESENCE_PALETTE = [
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

/** Track a global connection counter for color assignment. */
let connectionCounter = 0;

/**
 * Create the Hocuspocus onAuthenticate handler.
 *
 * Verifies the Supabase JWT token, checks project access,
 * and returns user metadata including assigned color.
 */
export function createAuthHandler(supabase: SupabaseClient) {
  return async ({
    token,
    documentName,
  }: {
    token: string;
    documentName: string;
  }): Promise<AuthenticatedUser> => {
    // Verify the Supabase JWT
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Invalid authentication token");
    }

    // Check project access
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, owner_id, is_public")
      .eq("id", documentName)
      .single();

    if (projectError || !project) {
      throw new Error("Project not found");
    }

    const isOwner = user.id === project.owner_id;
    const hasAccess = isOwner || project.is_public;

    if (!hasAccess) {
      throw new Error("Access denied");
    }

    // Assign a color from the palette
    const colorIndex = connectionCounter;
    connectionCounter += 1;
    const color = PRESENCE_PALETTE[colorIndex % PRESENCE_PALETTE.length]!;

    const displayName =
      (user.user_metadata?.name as string | undefined) ||
      user.email ||
      "Anonymous";

    return {
      id: user.id,
      name: displayName,
      color,
      isOwner,
    };
  };
}
