import { readFileSync } from "node:fs";
import { articleUpdateUrl, existingArticleQuery, pickExistingId } from "../src/lib/publish-dedupe";

let pass = 0;
let fail = 0;
const t = (name: string, condition: boolean) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? "✓" : "✗"} ${name}`);
};

const base = "https://example.supabase.co";
const q = existingArticleQuery(base, "nas", "為什麼同一個數字 & 樣子?");
t("查詢帶品牌與標題並編碼", q.includes("brand_id=eq.nas") && q.includes("title=eq." + encodeURIComponent("為什麼同一個數字 & 樣子?")));
t("查詢取最舊的一筆", q.includes("order=created_at.asc") && q.includes("limit=1"));
t("更新網址以 id 篩選", articleUpdateUrl(base, "a b") === `${base}/rest/v1/insights_articles?id=eq.a%20b`);
t("取出既有 id", pickExistingId([{ id: "abc" }]) === "abc");
t("數字 id 轉成字串", pickExistingId([{ id: 12 }]) === "12");
t("空陣列視為不存在", pickExistingId([]) === null);
t("非陣列視為不存在", pickExistingId({ id: "x" }) === null);
t("沒有 id 視為不存在", pickExistingId([{}]) === null);

const route = readFileSync("src/app/api/publish-website/route.ts", "utf8");
t("發佈路由使用去重查詢", route.includes("existingArticleQuery") && route.includes("pickExistingId"));
t("已存在時用 PATCH 更新", route.includes('method: existingId ? "PATCH" : "POST"'));
t("回應帶 updated 旗標", route.includes("updated: Boolean(existingId)"));
t("查詢失敗時退回新增而非中斷", route.includes("existingId = null"));

console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
