import { rm } from "node:fs/promises";

async function clean() {
  await rm("dist", { recursive: true, force: true });
}

clean().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
