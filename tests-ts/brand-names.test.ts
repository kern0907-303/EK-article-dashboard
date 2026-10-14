import { normalizeBrandNames, stripDashes } from "../src/lib/plain-text";
import { BRANDS } from "../src/components/BrandSelector";

let failed = 0;
function t(name: string, ok: boolean) { if (!ok) { failed++; console.error("FAIL", name); } else console.log("ok  ", name); }

t("NAS 生命數字 換成平衡空間", normalizeBrandNames("歡迎來到 NAS 生命數字") === "歡迎來到 平衡空間");
t("NAS 平衡空間 不重複", normalizeBrandNames("NAS 平衡空間生命數字") === "平衡空間");
t("單獨 NAS", normalizeBrandNames("#NAS 的課") === "#平衡空間 的課");
t("ABL 信息場調和", normalizeBrandNames("ABL 信息場調和") === "艾伯林量子調頻");
t("ABLIENE 艾伯林量子調頻", normalizeBrandNames("ABLIENE 艾伯林量子調頻") === "艾伯林量子調頻");
t("ABL 量子調頻 不重複", normalizeBrandNames("ABL (量子調頻)") === "艾伯林量子調頻");
t("I8 企業顧問", normalizeBrandNames("I8 企業顧問") === "初八企業顧問");
t("初八信息顧問 I8", normalizeBrandNames("初八信息顧問 I8") === "初八企業顧問");
t("I8 (Initial 8 CO.)", normalizeBrandNames("I8 (Initial 8 CO.)") === "初八企業顧問");
t("已是全名不變", normalizeBrandNames("平衡空間與艾伯林量子調頻與初八企業顧問") === "平衡空間與艾伯林量子調頻與初八企業顧問");
t("不誤傷其他英數", normalizeBrandNames("TimeWaver 2026 NASA") === "TimeWaver 2026 NASA");
t("stripDashes 一併處理", stripDashes("ABL 信息場調和，歡迎你。") === "艾伯林量子調頻，歡迎你。");
t("品牌顯示名稱", BRANDS.map((b) => b.name).join("|").startsWith("初八企業顧問|平衡空間|艾伯林量子調頻"));

if (failed) process.exit(1);
