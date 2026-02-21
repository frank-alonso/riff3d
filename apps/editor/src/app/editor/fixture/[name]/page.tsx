/**
 * Fixture editor page — reuses the same client-side editor page
 * that /editor/[projectId] uses. Both routes inject project data
 * via the __RIFF3D_PROJECT_DATA__ script tag, so the client logic
 * is identical.
 */
export { default } from "../../[projectId]/page";
