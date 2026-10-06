// Copies the shared citation streamer from the classic interface, so both
// interfaces gate quotations with the same code. Runs before dev and build.
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const from = fileURLToPath(new URL("../../frontend/citation_stream.js", import.meta.url));
const to = fileURLToPath(new URL("../src/lib/citation-stream.js", import.meta.url));
copyFileSync(from, to);
