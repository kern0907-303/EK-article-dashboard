import { pickAlign } from "../src/lib/popover-align";
let pass = 0, fail = 0;
const t = (name: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗"} ${name}`); };
// 容器 100 到 700；面板寬 320
t("右邊空間夠 → 靠右（往左長）", pickAlign(400, 600, 100, 700, 320) === "right");
t("按鈕太靠左、往左長會被切 → 靠左（往右長）", pickAlign(130, 390, 100, 700, 320) === "left");
t("截圖情況：按鈕右緣 392、容器左緣 116 → 靠左", pickAlign(236, 392, 116, 716, 320) === "left");
t("兩邊都放不下 → 選被切掉較少的一邊", pickAlign(150, 250, 100, 400, 320) === "left");
t("剛好放得下（含邊距）→ 靠右", pickAlign(0, 428, 100, 700, 320) === "right");
console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
