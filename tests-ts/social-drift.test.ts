// 社群改寫走樣：把長文改寫成 Threads 與 IG 版本時，不得加入原文沒有的行動呼籲與禁用字，不得刪掉關鍵段落。
// 2026-11-27 艾伯林牙齒那篇的兩個改寫就是這樣走樣的，這裡用當天的原文與系統改寫實際比對。
import assert from "node:assert/strict";
import { checkSocialDrift, driftFeedback, keyParagraphs, retention } from "../src/lib/social-drift";

const ORIGINAL = `牙齒痛了很久，我才發現它早就說過了

前陣子，我的牙齒開始痛。

一開始是隱隱的。
小到你根本不會把它當一回事的那種。

我照常吃飯，照常工作。
它偶爾提醒我一下，我偶爾想一下，然後就忘了。

後來它提醒得越來越大聲。
直到有一天，我發現我沒辦法好好吃東西了。

我去看了牙醫。
醫生看完，給我的建議是拔掉。
除此之外，沒有別的。

我當場愣住。
這從來不在我的選項裡。

回家的路上我一直在想。
這顆牙不是今天才出問題的。
它很早就說了，只是說得很小聲。

➤ ❝ 很多時候不是沒有提醒，是我們沒把它當一回事。 ❞

就像車子儀表板上亮了一個小燈。
車還能開，所以我們繼續開。
等到車停在路邊，才想起那個燈亮了多久。

那天之後，我做的第一件事，是跟它說對不起。
對不起，讓你承擔了這麼久，我現在才聽見。

然後我把坊間針對敏感牙齒的護理用品一口氣買齊。
每次吃完東西就刷牙，再用沖牙機清一次。
很認真，像在補一門欠了很久的課。

一個禮拜過去了。
變化很小，小到要很仔細才感覺得到。

我這才明白，它是慢慢變成這樣的，所以也急不來。

我們這樣對待身體，其實已經很久了。

這幾天留意一下。
你身上有沒有哪個地方，一直小小聲地在提醒你，而你還沒理它。

等我真的聽懂這顆牙的時候，它已經等我很久了。`;

// 2026-11-27 系統的 Threads 改寫（已排程那一版）
const THREADS_DRIFTED = `你身上有沒有一個地方，一直小小聲地在提醒你，但你還沒理它？

前陣子我牙齒開始痛。
一開始是隱隱的，小到不會當一回事的那種。

我照常吃飯，照常工作。
它偶爾提醒我，我偶爾想一下，然後就忘了。

後來它提醒得越來越大聲。
直到我發現自己沒辦法好好吃東西了，才終於去看醫生。

醫生說，拔掉。

回家路上我一直在想，這顆牙不是今天才出問題的。
它很早就說了，只是說得很小聲，而我一直沒把它當一回事。

就像儀表板上亮了一個小燈。
車還能開，所以繼續開。
等到車停在路邊，才想起那個燈亮了多久。

我對它說了對不起。
對不起，讓你撐了這麼久，我現在才聽見。

其實我們對自己的身體、情緒、內在狀態，常常也是這樣。
不是沒有訊號，是我們習慣先忽略。
等到撐不住了，才發現它等我們很久了。

很多時候，卡住不是突然發生的。
它是一點一點累積的，是長期沒有被好好照顧的狀態，慢慢堆到你扛不動為止。

你現在身上，有沒有哪個訊號，你其實早就感覺到了，只是還沒停下來好好聽它說話？

不需要等到撐不住才開始。
你可以先從看見自己的狀態開始。
艾伯林量子調頻`;

// 2026-11-27 系統的 IG 改寫（被品管擋下、沒有排程那一版）的後段
const IG_DRIFTED = `${ORIGINAL.split("\n\n").slice(1, 12).join("\n\n")}

💛 我們這樣對待身體，其實已經很久了。

明明很累，卻停不下來。

你不需要再一個人硬撐。

如果你最近也感覺自己哪裡一直亮著小燈，卻不確定從哪裡開始，歡迎私訊我們，或點擊首頁連結 Link in Bio 了解 艾伯林量子調頻 個人狀態分析。

艾伯林量子調頻 #艾伯林量子調頻 #個人狀態調和 #信息場支持 #情緒訊號 #身心狀態`;

// 1. 關鍵段落：關鍵句、這幾天留意、最後一段
{
  const keys = keyParagraphs(ORIGINAL);
  assert.ok(keys.some((p) => p.includes("很多時候不是沒有提醒")));
  assert.ok(keys.some((p) => p.includes("這幾天留意一下")));
  assert.ok(keys.some((p) => p.includes("等我真的聽懂這顆牙的時候")));
}

// 2. 昨天的 Threads 改寫：加了卡住、撐、扛，刪掉了關鍵句與收尾
{
  const issues = checkSocialDrift(ORIGINAL, THREADS_DRIFTED, "threads");
  const text = issues.map((i) => i.message).join("\n");
  assert.ok(issues.some((i) => i.kind === "word") && /卡住/.test(text) && /撐/.test(text) && /扛/.test(text), text);
  assert.ok(issues.some((i) => i.kind === "dropped"), "關鍵句與收尾被改掉要抓到");
}

// 3. 昨天的 IG 改寫：加了私訊、Link in Bio、主題標籤、硬撐
{
  const issues = checkSocialDrift(ORIGINAL, IG_DRIFTED, "instagram");
  const text = issues.map((i) => i.message).join("\n");
  assert.ok(/私訊/.test(text) && /Link in Bio/.test(text), text);
  assert.ok(/主題標籤/.test(text), text);
  assert.ok(/「撐」/.test(text) && /「調和」/.test(text), text);
  assert.ok(issues.some((i) => i.kind === "dropped"), "IG 刪了原文後半段要抓到");
}

// 4. 原文照用不算走樣
assert.deepEqual(checkSocialDrift(ORIGINAL, ORIGINAL, "instagram"), []);
assert.deepEqual(checkSocialDrift(ORIGINAL, ORIGINAL, "threads"), []);

// 5. 好的 Threads 濃縮：段落變少但關鍵句與收尾還在，沒有加料，不算走樣
{
  const condensed = `牙齒痛了很久，我才發現它早就說過了

前陣子我的牙齒開始痛，一開始是隱隱的，我照常吃飯、照常工作，偶爾想一下就忘了。

直到有一天沒辦法好好吃東西，去看牙醫，醫生的建議是拔掉。我當場愣住。

回家路上我一直在想，它很早就說了，只是說得很小聲。

➤ ❝ 很多時候不是沒有提醒，是我們沒把它當一回事。 ❞

那天我跟它說對不起，讓你承擔了這麼久，我現在才聽見。
護理用品買齊，認真刷了一個禮拜，變化很小。它是慢慢變成這樣的，所以也急不來。

這幾天留意一下。
你身上有沒有哪個地方，一直小小聲地在提醒你，而你還沒理它。

等我真的聽懂這顆牙的時候，它已經等我很久了。`;
  assert.deepEqual(checkSocialDrift(ORIGINAL, condensed, "threads"), [], JSON.stringify(checkSocialDrift(ORIGINAL, condensed, "threads")));
}

// 6. 原文本來就有行動呼籲時，改寫保留同類不算走樣；原文沒有就一個都不能加
{
  const withCta = `${ORIGINAL}\n\n詳細連結我放在留言區第一則。`;
  assert.ok(!checkSocialDrift(withCta, `${ORIGINAL}\n\n在下面留言「連結」兩個字，我私訊給你。`, "instagram").some((i) => i.kind === "cta"));
  assert.ok(checkSocialDrift(ORIGINAL, `${ORIGINAL}\n\n想了解可以預約。`, "instagram").some((i) => i.kind === "cta"));
  // 原文已有連結指路，改寫另外加「預約」仍算走樣
  assert.ok(checkSocialDrift(withCta, `${withCta}\n\n想了解可以預約。`, "instagram").some((i) => i.kind === "cta"));
}

// 8. 2026-11-28 實例：流水線在 FB 母稿最後加了「連結在留言區第一則」與主題標籤，那一行不算收尾段落
{
  const master = `${ORIGINAL}\n\n詳細資訊與連結放在留言區第一則。\n生命數字 #自我探索 #關係說明書`;
  const keys = keyParagraphs(master);
  assert.ok(!keys.some((p) => p.includes("留言區第一則")), "連結指路不是關鍵段落");
  assert.ok(keys.some((p) => p.includes("等我真的聽懂這顆牙的時候")), "收尾改看前一段");
  assert.ok(!checkSocialDrift(master, ORIGINAL, "threads").some((i) => i.kind === "dropped"), "Threads 不帶連結指路不算刪段落");
}

// 7. 給模型的修改要求有寫出問題
assert.ok(driftFeedback(checkSocialDrift(ORIGINAL, THREADS_DRIFTED, "threads")).includes("修改要求"));
assert.ok(retention("很多時候不是沒有提醒", "很多時候不是沒有提醒，是我們") === 1);

console.log("social drift tests passed");
