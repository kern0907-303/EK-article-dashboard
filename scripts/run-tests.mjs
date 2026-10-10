// 一次跑完 tests-ts 內所有測試：.test.ts 用 tsx（加上 react-server 條件，讓 server-only 不會報錯），.test.mjs 用 node --test。
// 用法：npm test
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const dir = "tests-ts";
const files = readdirSync(dir).filter((name) => /\.test\.(ts|mjs)$/.test(name)).sort();
const failed = [];
for (const name of files) {
  const file = path.join(dir, name);
  const result = name.endsWith(".ts")
    ? spawnSync("npx", ["tsx", "--conditions=react-server", file], { stdio: "pipe", encoding: "utf8" })
    : spawnSync(process.execPath, ["--test", file], { stdio: "pipe", encoding: "utf8" });
  const ok = result.status === 0;
  console.log(`${ok ? "PASS" : "FAIL"} ${file}`);
  if (!ok) { failed.push(file); console.log((result.stdout || "").split("\n").slice(-12).join("\n")); console.log((result.stderr || "").split("\n").slice(-12).join("\n")); }
}
console.log(`\n共 ${files.length} 個測試檔，失敗 ${failed.length} 個`);
process.exit(failed.length ? 1 : 0);
