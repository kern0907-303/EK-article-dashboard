import { checkText, inspectForPublish } from "../src/lib/brand-guardrail";
import { evaluateGuardrails } from "../src/lib/guardrail-core";
import { checkGenreText, blockingIssues } from "../src/lib/genre-check";

let pass = 0;
let fail = 0;
const test = (name: string, condition: boolean) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? "✓" : "✗"} ${name}`);
};

const ablNegated = evaluateGuardrails("信息場調和不會讓你人生立刻翻轉", "ABL");
test("ABL 的信息場不套用品牌語言規則，否定的立刻翻轉不警告", ablNegated.passed && ablNegated.warningHits.length === 0);
test("否定命中仍回傳 negated=true", ablNegated.hits.some((hit) => hit.word === "立刻翻轉" && hit.negated));

const medicalNegated = evaluateGuardrails("這個方法不是治療，也不保證療效", "first_tier");
test("治療與療效前的否定句放行", medicalNegated.passed && medicalNegated.blockingHits.length === 0);
test("不保證中的保證也按命中前視窗放行", medicalNegated.hits.some((hit) => hit.word === "保證" && hit.negated));

const commitment = evaluateGuardrails("保證立刻翻轉你的人生", "first_tier");
test("保證立刻翻轉屬警告，不是阻擋", commitment.passed && commitment.warningHits.some((hit) => hit.word === "立刻翻轉") && commitment.blockingHits.length === 0);

const rootCure = evaluateGuardrails("這能根治失眠", "ABL");
test("根治失眠被阻擋且不可強制", !rootCure.passed && rootCure.blockingHits.some((hit) => hit.word === "根治" && !hit.forceable) && !rootCure.canForce);
test("單獨的翻轉不會命中任何規則", evaluateGuardrails("這一年的翻轉", "first_tier").hits.length === 0);

const distantNegation = evaluateGuardrails("不會有人告訴你，但其實這個方法能根治失眠", "first_tier");
test("八字視窗以外的否定詞不會放行根治", !distantNegation.passed && distantNegation.blockingHits.some((hit) => hit.word === "根治" && !hit.negated));

const ablHard = inspectForPublish("能量磁場、高票價、無痛成交", "brand_c_abl");
test("ABL 的三項硬紅線仍阻擋且可走既有強制確認", !ablHard.passed && ablHard.canForce && ["能量磁場", "高票價", "無痛成交"].every((word) => ablHard.violatedWords.includes(word)));

const nasLanguage = checkText("信息場是品牌用語", "NAS");
test("NAS 信息場是警告而非阻擋", nasLanguage.passed && nasLanguage.warningHits.some((hit) => hit.word === "信息場" && hit.level === "warn"));

const i8Blocked = inspectForPublish("靈性課程", "brand_a_i8");
const i8Negated = inspectForPublish("這不是靈性課程", "brand_a_i8");
test("I8 靈性仍阻擋且不可強制", !i8Blocked.passed && !i8Blocked.canForce && i8Blocked.blockingHits.some((hit) => hit.word === "靈性"));
test("I8 靈性前有否定詞時放行並保留命中紀錄", i8Negated.passed && i8Negated.hits.some((hit) => hit.word === "靈性" && hit.negated));

const needFill = evaluateGuardrails("這不是【需補：引用來源】", "first_tier");
test("【需補】不適用否定放行，仍阻擋且不可強制", !needFill.passed && needFill.blockingHits.some((hit) => hit.category === "required-material" && !hit.negated && !hit.forceable));

const genreNegated = checkGenreText("這個方法不是治療", { genre: "case", funnel: "hot", prompt_version: "test" }, "threads", "ABL");
test("文體檢查回傳否定命中供記錄，但不顯示為提醒或阻擋", genreNegated.guardrailHits.some((hit) => hit.word === "治療" && hit.negated) && genreNegated.length === 0 && blockingIssues(genreNegated).length === 0);

const coldAbl = evaluateGuardrails("冷流量提到信息場", "ABL", "cold");
test("ABL 沒有品牌語言警告，但冷流量既有規則仍警告", coldAbl.warningHits.some((hit) => hit.word === "信息場" && hit.category === "funnel-warning"));
test("否定放行不改變品牌檢查通過狀態", checkText("不是治療", "ABL").passed);

console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
