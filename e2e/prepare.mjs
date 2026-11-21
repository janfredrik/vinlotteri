// Fersk database for e2e: tømmer .e2e/data og seeder demorunden (runde 1, åpen for salg).
import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const dataDir = process.env.DATA_DIR || ".e2e/data";
rmSync(dataDir, { recursive: true, force: true });
execFileSync(process.execPath, ["scripts/seed.mjs"], { stdio: "inherit", env: { ...process.env, DATA_DIR: dataDir } });
