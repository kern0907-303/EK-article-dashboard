// 一次跑完 tests-ts 內所有測試：.test.ts 用 tsx（加上 react-server 條件，讓 server-only 不會報錯），.test.mjs 用 node --test。
// 用法：npm test
import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

// 直接用 node_modules 裡的 tsx，不要走 npx。
// 2026-11-03：tsx 以前沒有被宣告成相依套件，每個測試檔都讓 npx 去 npm 抓一次，
// 只要同時有另一個 npm 行程在跑就會撞到快取鎖（ECOMPROMISED），
// 測試就會以「失敗」收場，但程式其實沒有問題。代推 AI 就是這樣被擋下來的。
// 現在 tsx 進了 devDependencies，npm ci 裝好就在本地，完全不需要網路。
const LOCAL_TSX = path.join("node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
const TSX = existsSync(LOCAL_TSX) ? LOCAL_TSX : "npx";
const TSX_ARGS = TSX === "npx" ? ["tsx"] : [];

const dir = "tests-ts";
const files = readdirSync(dir).filter((name) => /\.test\.(ts|mjs)$/.test(name)).sort();
const failed = [];
for (const name of files) {
  const file = path.join(dir, name);
  const result = name.endsWith(".ts")
    ? spawnSync(TSX, [...TSX_ARGS, "--conditions=react-server", file], { stdio: "pipe", encoding: "utf8" })
    : spawnSync(process.execPath, ["--test", file], { stdio: "pipe", encoding: "utf8" });
  const ok = result.status === 0;
  console.log(`${ok ? "PASS" : "FAIL"} ${file}`);
  if (!ok) { failed.push(file); console.log((result.stdout || "").split("\n").slice(-12).join("\n")); console.log((result.stderr || "").split("\n").slice(-12).join("\n")); }
}
console.log(`\n共 ${files.length} 個測試檔，失敗 ${failed.length} 個`);
process.exit(failed.length ? 1 : 0);
