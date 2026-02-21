import { createCollabServer } from "./server";

const port = Number(process.env.COLLAB_PORT) || 1234;

const server = createCollabServer();

server.listen().then(() => {
  console.log(`[collab] Hocuspocus server listening on port ${String(port)}`);
}).catch((err: unknown) => {
  console.error("[collab] Failed to start server:", err);
  process.exit(1);
});
