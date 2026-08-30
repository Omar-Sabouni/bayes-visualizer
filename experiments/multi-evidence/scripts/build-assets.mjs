import { mkdir, readFile, writeFile } from "node:fs/promises";

const SOURCE_HTML = "index.html";
const SOURCE_CSS = "styles.css";
const DIST_DIR = "dist";
const DIST_HTML = "dist/index.html";
const DIST_CSS = "dist/styles.css";
async function buildAssets() {
  await mkdir(DIST_DIR, { recursive: true });

  const sourceCss = await readFile(SOURCE_CSS, "utf8");
  await writeFile(DIST_CSS, sourceCss, "utf8");

  const sourceHtml = await readFile(SOURCE_HTML, "utf8");
  const distHtml = sourceHtml.replace('src="./dist/main.js"', 'src="./main.js"');

  await writeFile(DIST_HTML, distHtml, "utf8");
}

buildAssets().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
