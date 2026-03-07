import { readFile } from "node:fs/promises";
import path from "node:path";

import { rootDir } from "./paths.ts";

export async function loadProjectText(relativePath: string) {
  return (await readFile(path.join(rootDir, relativePath), "utf8")).trim();
}
