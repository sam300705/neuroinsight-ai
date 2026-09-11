import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const assetDirectory = new URL("../dist/public/assets/", import.meta.url);
const initialBundleBudgetBytes = 750 * 1024;
const assets = await readdir(assetDirectory);
const initialBundles = assets.filter(name => /^index-[A-Za-z0-9_-]+\.js$/.test(name));

if (initialBundles.length !== 1) {
  throw new Error(`Expected one initial index bundle, found ${initialBundles.length}.`);
}

const fileName = initialBundles[0];
const size = (await stat(join(assetDirectory.pathname, fileName))).size;
if (size > initialBundleBudgetBytes) {
  throw new Error(`Initial bundle ${fileName} is ${size} bytes, above the ${initialBundleBudgetBytes}-byte regression budget.`);
}

console.log(`Initial bundle ${fileName}: ${size} bytes (budget ${initialBundleBudgetBytes}).`);
