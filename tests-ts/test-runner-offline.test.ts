import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 2026-11-03：代推 AI 回報 npm test 失敗，訊息是 npm error code ECOMPROMISED / Lock compromised。
// 那不是程式壞掉，是 tsx 沒有被宣告成相依套件，每個測試檔都讓 npx 去 npm 抓一次，
// 只要同一台機器上有另一個 npm 行程在跑就會撞到快取鎖，測試就被判失敗、推送被擋。
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const tsx = (pkg.devDependencies || {}).tsx || (pkg.dependencies || {}).tsx;
assert.ok(tsx, "tsx 必須宣告成相依套件，npm ci 才會裝到本地");
assert.ok(/^\d/.test(String(tsx)), "版本要釘死，不要用範圍，避免每次裝到不同版本");

const runner = readFileSync(new URL("../scripts/run-tests.mjs", import.meta.url), "utf8");
assert.ok(runner.includes('path.join("node_modules", ".bin"'), "要優先用本地的 tsx");
assert.ok(!/spawnSync\("npx"/.test(runner), "不可以無條件走 npx，那會需要網路");

console.log("test-runner-offline 測試通過");
