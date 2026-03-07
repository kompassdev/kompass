import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.resolve(moduleDir, "..");
export const skillsDir = path.join(rootDir, "skills");
