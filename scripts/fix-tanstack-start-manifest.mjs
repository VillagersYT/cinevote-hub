import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const functionDirectory = join(
  projectRoot,
  ".vercel",
  "output",
  "functions",
  "__server.func",
);

const fallbackManifestPath = join(
  functionDirectory,
  "_tanstack-start-manifest_v.mjs",
);

const files = await readdir(functionDirectory);

const productionManifestName = files.find((file) =>
  /^_tanstack-start-manifest_v-[\w-]+\.mjs$/.test(file),
);

if (!productionManifestName) {
  throw new Error(
    "Impossible de trouver le manifeste TanStack Start de production.",
  );
}

const productionManifestPath = join(
  functionDirectory,
  productionManifestName,
);

const productionManifest = await readFile(productionManifestPath, "utf8");

if (!productionManifest.includes('src: "/assets/')) {
  throw new Error(
    "Le manifeste détecté ne contient pas les assets de production.",
  );
}

await writeFile(fallbackManifestPath, productionManifest);

console.log(
  `[build:vercel] Manifeste de production appliqué (${productionManifestName}).`,
);
