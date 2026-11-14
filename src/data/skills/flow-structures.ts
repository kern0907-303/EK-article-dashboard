// 流量結構庫：艾瑞克 2026-11-13 定案的寫作架構。
//
// 來源：拆解三位台灣創作者的粉專（Jemmy Ko 約 410 篇、多米 Domyweb 222 篇、周加恩 220 篇），
// 歸納出 22 種文章結構，再改寫成平衡空間、艾伯林量子調頻、初八企業顧問與艾瑞克個人可用的版本。
// 原則是「類似但不模仿」：只借結構、節奏與推論方式，不抄任何人的原句、案例或標題。
//
// 這份檔案是唯一來源：手動生成（ChatBox → Maya）、自動流水線（planStyles）、
// 對照檢視頁（/structure-check）與海巡規則接口（/api/rules/styles）都讀這裡。
// 改了結構或規則要調高 FLOW_STRUCTURE_VERSION。
// 純資料與純函式，前後端都可以用。

export const FLOW_STRUCTURE_VERSION = "flow-v1";

export type FlowFamily = "jemmy" | "domy" | "chiukaun";
export type FlowBrand = "nas" | "abl" | "i8" | "erick";
/** 與 genres.ts 的 GenreId 相同，這裡不 import 以免循環相依 */
export type FlowGenre = "case" | "breakdown" | "response" | "invite" | "fan";

export const FAMILY_LABEL: Record<FlowFamily, string> = {
  jemmy: "Jemmy 系（快、爆、人物故事）",
  domy: "多米系（把觀念講透）",
  chiukaun: "加恩系（共感、自我揭露、信念與身心）",
};
export const FAMILY_SHORT: Record<FlowFamily, string> = { jemmy: "Jemmy 系", domy: "多米系", chiukaun: "加恩系" };
export const FAMILY_SOURCE: Record<FlowFamily, string> = {
  jemmy: "Jemmy Ko 粉專，約 410 篇長文",
  domy: "多米 Domyweb 粉專，222 篇（2020 到 2026）",
  chiukaun: "周加恩粉專，220 篇",
};

export interface FlowCheckpoint {
  id: string;
  /** 這一步要做到什麼 */
  label: string;
  /** 怎麼從文章裡認出來（給對照檢視的判定依據） */
  look: string;
}

export interface FlowStructure {
  id: string;
  family: FlowFamily;
  name: string;
  /** 什麼時候用 */
  use: string;
  brands: FlowBrand[];
  /** 適合搭配的文體；空陣列代表都可以 */
  genres: FlowGenre[];
  /** 建議字數（不含空白），平台限制優先 */
  length: [number, number];
  /** 源頭這一型的寫法重點（用描述，不放原句） */
  sourceMove: string;
  /** 做成艾瑞克的版本，怎麼「像但不模仿」 */
  erickTwist: string;
  checkpoints: FlowCheckpoint[];
  /** 寫的是艾瑞克本人的真實經歷，提示詞沒有附素材時自動流水線不挑 */
  firstPersonReal?: boolean;
  /** 一定要有查證過的書，自動流水線不挑 */
  needsCitation?: boolean;
  limits?: string;
}

const cp = (id: string, label: string, look: string): FlowCheckpoint => ({ id, label, look });

export const FLOW_STRUCTURES: Record<string, FlowStructure> = {
  // ───────── Jemmy 系 ─────────
  J1: {
    id: "J1", family: "jemmy", name: "人物一句開場",
    use: "用一個人的轉變，證明一個觀念。",
    brands: ["nas", "i8", "erick"], genres: ["case", "breakdown"], length: [900, 1800],
    sourceMove: "第一行只交代一個人和他的處境；中段把改變他的一句話獨立成行，用 ➤ ❝ ❞ 標出來；結尾一句話把開場的困境反過來。",
    erickTwist: "人物用艾瑞克遇過的情境或虛構人物（不說成真實客戶），關鍵句換成生命數字、調頻或經營上的洞察。開場用自己的說法，不要用「這人叫」。",
    checkpoints: [
      cp("J1-1", "第一行就是人物", "標題之後第一句是一個人的名字或身分，加一個具體處境，沒有前言"),
      cp("J1-2", "具體的低谷", "用事實寫困境（做了什麼、結果怎樣），不是形容詞"),
      cp("J1-3", "一句改變他的話", "有一句獨立成行的關鍵句，通常用 ➤ ❝ ❞ 標出"),
      cp("J1-4", "原理接回論點", "有一段說明這句話為什麼有用，接回全篇唯一論點"),
      cp("J1-5", "結尾翻轉", "最後一兩句跟開場的處境相反，形成對照"),
    ],
  },
  J2: {
    id: "J2", family: "jemmy", name: "親身經歷",
    use: "用艾瑞克自己的經歷，帶出後來才懂的觀念。",
    brands: ["erick", "nas", "abl"], genres: ["case", "invite"], length: [1000, 2000], firstPersonReal: true,
    sourceMove: "時間點開場，細節一段一個畫面地推進，順的地方寫順，壞的地方寫痛，出事之後才講觀念，最後用一句時間回收句收尾。",
    erickTwist: "只用艾瑞克說過的真實經歷（故事庫或他的口述），觀念用生活比喻講白。",
    checkpoints: [
      cp("J2-1", "時間點開場", "第一句有明確的時間點（幾年前、某一年），主角是「我」"),
      cp("J2-2", "一段一個畫面", "中段的細節是具體畫面，不是總結"),
      cp("J2-3", "出事或愣住的一刻", "有一個轉折事件"),
      cp("J2-4", "事後才懂的觀念", "觀念放在事件之後，用生活比喻講白"),
      cp("J2-5", "時間回收句", "結尾回到時間，例如「等我懂這件事，已經是很多年以後」"),
    ],
  },
  J3: {
    id: "J3", family: "jemmy", name: "反常識宣言",
    use: "推翻讀者習以為常的說法。",
    brands: ["nas", "abl", "i8", "erick"], genres: ["breakdown"], length: [900, 1800],
    sourceMove: "標題直接下宣言；第一句把宣言說得更狠；拆掉原本的定義；一個小故事；一個極端例子；最後一句幾乎重複第一句。",
    erickTwist: "平衡空間與艾伯林量子調頻不說「你沒資格」，改成「你不是 A，你只是還沒 B」；初八企業顧問可以直接一點。",
    checkpoints: [
      cp("J3-1", "標題就是宣言", "標題是一個與常識相反的主張"),
      cp("J3-2", "第一句更狠", "第一句把宣言再推進一步"),
      cp("J3-3", "拆原本的說法", "有段落說明大家以為是什麼、其實是什麼"),
      cp("J3-4", "一個小故事", "有一個艾瑞克的或擬真人物的小故事"),
      cp("J3-5", "一個極端例子", "有一個極端例子或一本書的觀點撐住"),
      cp("J3-6", "首尾呼應", "最後一句與第一句幾乎相同"),
    ],
  },
  J4: {
    id: "J4", family: "jemmy", name: "讀者提問直接回答",
    use: "回應一個常被問的問題，給明確答案。",
    brands: ["nas", "abl", "i8"], genres: ["invite", "breakdown"], length: [800, 1600],
    sourceMove: "先引用提問，下一行用極短的一句直接回答，再講原則、給比喻，最後把核心句連寫三行。",
    erickTwist: "提問用常見的問題型態（不寫成真實某人的原話），平衡空間最好用；艾伯林量子調頻回答時照頻率的對外定調。",
    checkpoints: [
      cp("J4-1", "引用提問", "開頭是一個問題，用引號包起來"),
      cp("J4-2", "極短的答案", "下一行是很短的直接回答（例如「答案：不是。」）"),
      cp("J4-3", "說明原則", "有段落說明真正的原則"),
      cp("J4-4", "日常比喻", "有一個日常物件或場景的比喻"),
      cp("J4-5", "三行重複收尾", "核心句連寫三行，或用重複收尾"),
    ],
  },
  J5: {
    id: "J5", family: "jemmy", name: "等級階梯",
    use: "把一件事分成幾個等級，讓讀者對號入座。",
    brands: ["nas", "i8", "abl"], genres: ["breakdown"], length: [1200, 2200],
    sourceMove: "標題寫「X 的 N 種等級」，開頭先列出全部等級（含一個最底的等級 0），每一級用小標配一個小故事，最後回頭點破等級 0。",
    erickTwist: "等級用艾瑞克領域的事：看懂自己數字的等級、面對卡點的等級、老闆看報表的等級。",
    checkpoints: [
      cp("J5-1", "標題是等級", "標題含「N 種等級」或「N 個階段」"),
      cp("J5-2", "先列出全部等級", "開頭附近有完整的等級清單"),
      cp("J5-3", "每級一個例子", "每一級都有特徵加一個小故事或例子"),
      cp("J5-4", "回頭點破最低級", "最後回到最常見、最該避開的那一級"),
    ],
  },
  J6: {
    id: "J6", family: "jemmy", name: "迷思清單",
    use: "一次破好幾個錯誤觀念。",
    brands: ["i8", "nas"], genres: ["breakdown"], length: [1200, 2400],
    sourceMove: "一兩句交代看過多少案例，接著每點寫「迷思原句」，下一行一個字否定，再兩三行反駁加一個例子，最後一句收斂。",
    erickTwist: "資歷只寫艾瑞克真實的（例如教生命數字十多年），不編案例數字。",
    checkpoints: [
      cp("J6-1", "資歷開場", "開頭一兩句說明從哪裡看到這些錯誤"),
      cp("J6-2", "迷思加否定", "每點先寫迷思，下一行直接否定（錯、不一定）"),
      cp("J6-3", "反駁加例子", "每點有兩三行反駁與一個例子"),
      cp("J6-4", "點數適中", "有 5 到 11 點"),
      cp("J6-5", "收斂到一個論點", "結尾一句回到單一論點"),
    ],
  },
  J7: {
    id: "J7", family: "jemmy", name: "研究或現象解讀",
    use: "拿一個研究、新聞或大家正在討論的現象，翻出沒想到的那一層。",
    brands: ["i8", "erick", "nas"], genres: ["breakdown"], length: [900, 1800],
    sourceMove: "第一句先講結論，交代來源，然後一輪一輪加碼「你可能會覺得 A。不是。」，最後用一個比喻把抽象結論變成畫面。",
    erickTwist: "研究一定要真的查得到並寫明出處，不可自己編數據；艾伯林量子調頻不可把研究說成頻率有效的證據。",
    limits: "沒有真實來源就不要用這一型。",
    checkpoints: [
      cp("J7-1", "第一句是結論", "開頭直接講結論，不鋪陳"),
      cp("J7-2", "交代來源", "有具體出處"),
      cp("J7-3", "層層加碼", "至少兩輪「你可能以為 A，其實不是」"),
      cp("J7-4", "比喻收尾", "結尾用一個比喻把結論變成畫面"),
    ],
  },
  J8: {
    id: "J8", family: "jemmy", name: "金句短文",
    use: "日更補位、IG 圖卡、Threads。300 到 600 字。",
    brands: ["nas", "abl", "i8", "erick"], genres: ["fan", "breakdown"], length: [300, 600],
    sourceMove: "第一句是金句，一個生活比喻，一組三到五條的短清單，最後一行重複第一句。",
    erickTwist: "金句用艾瑞克自己的話，清單句首可以統一（例如「刻意……」），但不要照搬別人的清單。",
    checkpoints: [
      cp("J8-1", "第一句是金句", "開頭一句就是可截圖的話"),
      cp("J8-2", "一個生活比喻", "有一個日常比喻"),
      cp("J8-3", "短清單", "有 3 到 5 條的短清單"),
      cp("J8-4", "最後一行重複第一句", "結尾回到第一句"),
    ],
  },

  // ───────── 多米系 ─────────
  D1: {
    id: "D1", family: "domy", name: "概念拆分",
    use: "兩個大家混在一起講的概念，把它們分開。",
    brands: ["nas", "i8"], genres: ["breakdown"], length: [1400, 2500],
    sourceMove: "用一個想通的洞察開場，接自己的困惑（一組短問句）；先講 A 並用日常類比，戳破「整理得很漂亮但一問就答不出來」；再講 B 是另一回事；給四步骨架；寫做到後會變怎樣；一句對照句收尾。",
    erickTwist: "開場用「我最近想通一件事」這類自己的說法；例子用艾瑞克的領域，例如「知道自己的數字」不等於「看懂自己的數字」。",
    checkpoints: [
      cp("D1-1", "洞察開場加困惑", "開頭是一個想通的洞察，接一組短問句列出困惑"),
      cp("D1-2", "A 不等於 B", "有明確把兩個概念分開的句子或小標"),
      cp("D1-3", "A 的日常類比", "講 A 時有一個具體有畫面的類比"),
      cp("D1-4", "B 是另一回事", "講 B 時沿用同一個類比換一個問法"),
      cp("D1-5", "步驟骨架", "給出 3 到 5 個步驟"),
      cp("D1-6", "對照句收尾", "結尾一句「沒有 A 頂多…；沒有 B 根本…」這類對照"),
    ],
  },
  D2: {
    id: "D2", family: "domy", name: "反主流命題",
    use: "反駁一個被大量推崇的做法。",
    brands: ["i8", "erick", "nas"], genres: ["breakdown"], length: [1400, 2500],
    sourceMove: "標題用反問加強烈答案；先寫自己試過又失敗；列出這個做法的兩個後果；把名人說法逐句推敲「聽起來很美好，但合理嗎」；用一個模型收束；算一筆帳；給替代做法。",
    erickTwist: "命題換成艾瑞克領域的主流說法，例如「每天看運勢」「老闆要事必躬親」；算帳的數字只用他提供的或常識可推的。",
    checkpoints: [
      cp("D2-1", "反問標題", "標題是反問句加一個強烈答案"),
      cp("D2-2", "我試過", "有自己試過、失敗過的經驗"),
      cp("D2-3", "列出後果", "條列這個做法帶來的後果"),
      cp("D2-4", "逐句推敲權威說法", "有「聽起來很好，但仔細想想合理嗎」的推敲"),
      cp("D2-5", "模型收束", "用一個模型或框架收束（例如三選二）"),
      cp("D2-6", "算一筆帳", "有時間、力氣或代價的估算"),
      cp("D2-7", "替代做法", "最後給一個真正該做的事"),
    ],
  },
  D3: {
    id: "D3", family: "domy", name: "借一個原理",
    use: "用別的領域的一個原理，解釋一個生活現象。",
    brands: ["nas", "abl", "erick"], genres: ["breakdown"], length: [1200, 2400],
    sourceMove: "反直覺標題；先寫常聽到的說法再說「我認為不是」；把原理從頭講一遍並用小例子演示；拉回日常；延伸解釋兩三個現象；回到讀者身上；p.s. 補一個常見誤解。",
    erickTwist: "原理必須是真的，從艾瑞克的知識庫找；艾伯林量子調頻不可用科學原理替頻率的效果背書。",
    checkpoints: [
      cp("D3-1", "反直覺標題", "標題與常識相反"),
      cp("D3-2", "先立常見說法再否定", "開頭寫常聽到的說法，接著否定"),
      cp("D3-3", "原理演示", "把一個原理講清楚，配一個小例子"),
      cp("D3-4", "拉回日常", "有「我們日常不也是這樣」這類連結"),
      cp("D3-5", "延伸兩三個現象", "用同一原理解釋兩到三個現象"),
      cp("D3-6", "回到讀者", "最後告訴讀者下次可以怎麼做"),
    ],
  },
  D4: {
    id: "D4", family: "domy", name: "歷史對照",
    use: "用一個真實歷史事件裡兩方的對比，帶出一個原則。",
    brands: ["i8", "erick"], genres: ["breakdown"], length: [1500, 2600],
    sourceMove: "年份開場交代一場大事，兩方人馬對照列出，丟問題給讀者猜，揭曉結果再加一層更殘酷的後續，三個小標拆出造成差距的原則，用人物說過的一句話收尾。",
    erickTwist: "事件細節先查證；原則接回經營決策或人生選擇。",
    checkpoints: [
      cp("D4-1", "年份開場", "第一句有年份與一個事件"),
      cp("D4-2", "兩方對照", "兩方條件並列"),
      cp("D4-3", "丟問題給讀者", "有「如果是你會怎麼做」或「你猜是誰」"),
      cp("D4-4", "結果加一層", "揭曉結果，再加一個後續"),
      cp("D4-5", "拆出原則", "有兩到三個原則小標"),
    ],
  },
  D5: {
    id: "D5", family: "domy", name: "比喻分層",
    use: "用一個大家熟的比喻，把一件事分成兩層。",
    brands: ["nas", "abl"], genres: ["breakdown"], length: [1200, 2200],
    sourceMove: "生活、武俠或遊戲比喻開場，接「那這件事是否也這樣？有。答案是…」；兩個世界（第二層是多數人沒踏進去的）；自己以前很笨的小故事；一個心理或學習原理；最後列高手會問的幾個問題。",
    erickTwist: "比喻用艾瑞克自己會用的（見診斷方法與慣用比喻），不用源頭的武俠越級例子。",
    checkpoints: [
      cp("D5-1", "比喻開場", "開頭是一個熟悉的比喻"),
      cp("D5-2", "自問自答接主題", "有「這件事是不是也這樣？是。答案…」"),
      cp("D5-3", "兩層世界", "明確分成兩層"),
      cp("D5-4", "我以前很笨", "有自己做錯的小故事"),
      cp("D5-5", "高手會問的問題", "結尾列出幾個問題"),
    ],
  },
  D6: {
    id: "D6", family: "domy", name: "情境推演揭秘",
    use: "描繪讀者的日常，指出哪一步一開始就錯了。",
    brands: ["i8", "abl"], genres: ["breakdown"], length: [1200, 2200],
    sourceMove: "「你先想一下，你每天…」開場，寫一段很像讀者本人的日常，接一句乾脆的否定，說明為什麼錯，揭示正確流程（第一步、第二步…），回扣標題。",
    erickTwist: "否定不用連寫「錯錯錯」，改成「但問題就出在這裡」；流程用艾瑞克真的在用的做法。",
    checkpoints: [
      cp("D6-1", "讀者日常開場", "開頭要讀者想像自己的日常"),
      cp("D6-2", "像本人的情境", "有一段具體、像讀者本人的日常描寫"),
      cp("D6-3", "乾脆的否定", "有一句直接點出錯在哪"),
      cp("D6-4", "正確流程", "用第一步、第二步列出流程"),
      cp("D6-5", "回扣標題", "最後一句回到標題"),
    ],
  },
  D7: {
    id: "D7", family: "domy", name: "好書導讀",
    use: "用一本書講一個論點。",
    brands: ["erick", "nas", "i8"], genres: ["breakdown"], length: [1400, 2600], needsCitation: true,
    sourceMove: "開頭說今天分享一本書與它為什麼值得讀，接自己走過的彎路，三個觀點各配一個現實例子與做法，結語用作者一句話。",
    erickTwist: "只從艾瑞克的知識庫選書，引用照「《主書名》作者某某提出，……」，有台灣中文版用中文書名與作者，沒有中文版直接用英文原名；故事不寫成書中內容。",
    limits: "沒有查證過的書就不要用這一型。",
    checkpoints: [
      cp("D7-1", "交代書與價值", "開頭說明是哪本書、為什麼值得讀"),
      cp("D7-2", "我走過的彎路", "有自己早知道就好的經驗"),
      cp("D7-3", "三個觀點加例子", "每個觀點有現實例子與做法"),
      cp("D7-4", "引用格式正確", "寫成「《書名》作者某某提出」，有中文版用中文，沒有中文版用英文原名，不可自己翻譯書名"),
    ],
  },

  // ───────── 加恩系 ─────────
  C1: {
    id: "C1", family: "chiukaun", name: "卡關告白",
    use: "用自己最近卡住的一件事，講一個心理機制與解法。",
    brands: ["abl", "nas", "erick"], genres: ["fan", "breakdown"], length: [1200, 2400],
    sourceMove: "開場就承認卡很久的一個關；寫「明明懂了還是做不到」；自問為什麼並答出背後的心理；講一個自我強化的迴圈；跨到另一個生活領域證明它通用；解法分信念與行動兩條路；好處清單句首統一；輕鬆收尾。",
    erickTwist: "卡關用艾瑞克真的有過的或讀者最常見的；收尾不用「那是另一篇文章的主題」這類預告。",
    checkpoints: [
      cp("C1-1", "承認卡關", "開頭直接承認一個卡住的狀態"),
      cp("C1-2", "懂了還是做不到", "有「明明知道…還是會…」"),
      cp("C1-3", "背後的心理", "自問為什麼並給出心理答案"),
      cp("C1-4", "自我強化迴圈", "說明行動與信念如何互相強化"),
      cp("C1-5", "跨到另一個領域", "用另一個生活領域（感情、工作）印證"),
      cp("C1-6", "兩條路的解法", "解法分成信念與行動"),
      cp("C1-7", "輕鬆收尾", "結尾一句自嘲或一個互動問題，不預告下一篇"),
    ],
  },
  C2: {
    id: "C2", family: "chiukaun", name: "狠問共鳴",
    use: "直接問中讀者最痛的那個問題。適合廣告前導文、體驗會暖場。",
    brands: ["nas", "abl"], genres: ["invite", "breakdown"], length: [1000, 2000],
    sourceMove: "標題是讀者心裡那句話；用「你有沒有過這種經驗」接一段逐步升高的第二人稱情境；點出每次卡住都更懷疑自己；用一本書戳破「不是你不夠努力」；再挖一層；說明為什麼改不掉；給方向；最後兩行「你需要的不是 A，而是 B」。",
    erickTwist: "不用髒話，改用艾瑞克的口語強調（對吧、你懂我意思嗎）；情境寫 28 到 55 歲、努力很久卻卡住的女性會遇到的事。",
    checkpoints: [
      cp("C2-1", "標題是讀者的心聲", "標題是讀者會對自己說的話"),
      cp("C2-2", "第二人稱情境升高", "有一段逐步升高的「你」情境"),
      cp("C2-3", "越卡越懷疑自己", "點出卡住讓人更懷疑自己"),
      cp("C2-4", "不是你不夠努力", "有段落戳破努力不夠的說法"),
      cp("C2-5", "為什麼改不掉", "說明改變困難的原因"),
      cp("C2-6", "A 不是，B 才是", "最後兩行是「你需要的不是 A，而是 B」"),
    ],
  },
  C3: {
    id: "C3", family: "chiukaun", name: "親身長期實驗記",
    use: "寫自己卡了很多年的一件事，換一個全新的角度面對它。",
    brands: ["erick", "nas", "abl"], genres: ["case", "fan"], length: [1500, 2800], firstPersonReal: true,
    sourceMove: "從小時候的一個畫面開場，列出一串試過又失敗的方法，接「所以我開始相信我就是這樣的人」；直到有一天一個工具或一句話讓人愣住；用一個貫穿全文的隱喻；自己整理出幾個小原則；最後誠實說「我還沒做到，但這次不一樣」。",
    erickTwist: "轉折工具用艾瑞克自己的生命數字或 TimeWaver 經驗；只寫他說過的真實經歷；不寫成工具治好了什麼。",
    limits: "不寫診斷、療效或保證。",
    checkpoints: [
      cp("C3-1", "從小的畫面開場", "開頭是一個具體的過去畫面"),
      cp("C3-2", "一串失敗", "列出試過又失敗的方法"),
      cp("C3-3", "以為自己就是這樣", "有一句自我否定的結論"),
      cp("C3-4", "愣住的轉折", "一個工具或一句話帶來轉折"),
      cp("C3-5", "貫穿的隱喻", "有一個從頭用到尾的隱喻"),
      cp("C3-6", "誠實的結尾", "結尾承認還沒完全做到"),
    ],
  },
  C4: {
    id: "C4", family: "chiukaun", name: "公式開場加離題故事",
    use: "一個簡單公式或一句名言，配一個生活故事，講一個人生觀。",
    brands: ["nas", "abl", "erick"], genres: ["fan"], length: [1400, 2600], firstPersonReal: true,
    sourceMove: "標題就是公式；三個「我這麼…就應該…」列出奇怪的期望；自嘲以前也是這樣，用括號吐槽放鬆；一段寫得很慢的離題故事；拉回「我知道這是老調重彈，但…」；一本書的理論；用莊子或佛家收尾，最後一句是「也許…」。",
    erickTwist: "公式可以用生命數字發揮；離題故事只用艾瑞克真的經歷過的場景。",
    checkpoints: [
      cp("C4-1", "標題是公式", "標題是一個公式或一句名言"),
      cp("C4-2", "三個奇怪的期望", "有一組「我這麼…就應該…」"),
      cp("C4-3", "括號吐槽", "有一兩處括號裡的自嘲"),
      cp("C4-4", "慢慢寫的離題故事", "中段有一段有畫面的生活故事"),
      cp("C4-5", "東方哲學收尾", "結尾用莊子、佛家或類似的東方觀點，最後一句是「也許…」"),
    ],
  },
  C5: {
    id: "C5", family: "chiukaun", name: "循環剖析",
    use: "發現一個重複發生的模式，把它拆成一個循環。",
    brands: ["i8", "abl", "nas"], genres: ["breakdown"], length: [900, 1800],
    sourceMove: "「我發現 A 跟之前的 B 有一個共同模式」開場，用 ⇨ 寫出五步循環，問「怎麼解」並給一個反直覺的解法，用三個不同領域各一行說明，借一個外來概念加強，延伸一層新理解。",
    erickTwist: "循環用艾瑞克領域的：老闆的停滯循環、數字的功課循環、越努力越累的循環。",
    checkpoints: [
      cp("C5-1", "發現模式", "開頭點出兩件事有共同模式"),
      cp("C5-2", "循環鏈", "用 ⇨ 或步驟寫出循環"),
      cp("C5-3", "反直覺解法", "給一個違反直覺的解法"),
      cp("C5-4", "三個領域", "用三個不同領域說明解法"),
      cp("C5-5", "外來概念", "借一個外來概念強化"),
    ],
  },
  C6: {
    id: "C6", family: "chiukaun", name: "低潮自救手冊",
    use: "陪讀者度過狀態很差的一天，給幾個小練習。",
    brands: ["abl"], genres: ["fan"], length: [900, 1800],
    sourceMove: "一句自嘲的狀態宣告重複兩次，夾住一段內心話；「適用場景」加一個幽默的檢查清單；五到七個練習各配小標與做法；誠實回報哪些試過有用；結尾問「你呢？」。",
    erickTwist: "練習只用寫、呼吸、想像、改寫詮釋這類安全做法，可以搭協振呼吸的使用情境。",
    limits: "只寫一般情緒低落；不提藥物、不做診斷、不碰自傷題材。",
    checkpoints: [
      cp("C6-1", "自嘲的狀態宣告", "開頭一句狀態宣告，重複出現"),
      cp("C6-2", "幽默檢查清單", "有一個輕鬆的檢查清單"),
      cp("C6-3", "五到七個練習", "每個練習有小標與做法"),
      cp("C6-4", "誠實回報", "說明哪些試過有用、哪些還沒做"),
      cp("C6-5", "問你呢", "結尾問讀者的方法"),
    ],
  },
  C7: {
    id: "C7", family: "chiukaun", name: "哲理短章",
    use: "一句話加一個動作比喻，寫一段快速轉念。300 到 600 字。",
    brands: ["abl", "nas"], genres: ["fan"], length: [300, 600],
    sourceMove: "第一行是一句用引號包起來的話，接一個動作比喻並說明為什麼會輸，停下來會發生什麼，一個用詞的轉換（從「我想要」到「我願意」），最後一行只有幾個字。",
    erickTwist: "比喻換成艾瑞克的；用詞轉換可以用平衡空間或艾伯林量子調頻的核心語言。",
    checkpoints: [
      cp("C7-1", "引號包起來的一句話", "第一行是一句引言"),
      cp("C7-2", "動作比喻", "有一個動作比喻並說明為什麼會輸"),
      cp("C7-3", "用詞轉換", "有一個從 A 說法到 B 說法的轉換"),
      cp("C7-4", "極短的最後一行", "最後一行只有幾個字"),
    ],
  },
};

export const FLOW_STRUCTURE_IDS = Object.keys(FLOW_STRUCTURES);
export const FLOW_STRUCTURE_LIST = FLOW_STRUCTURE_IDS.map((id) => FLOW_STRUCTURES[id]);

/** 三家共通、抓住流量的筆法 */
export const FLOW_SHARED_CRAFT = [
  "一篇只講一個論點，寫完要能用一句話複述。小標再多，也都在抱同一個論點。",
  "第一行就是鉤子：人物、宣言、提問、數字或一個畫面，五選一，不寫前言。",
  "段落短：一段一到兩句，段與段之間空一行，一行盡量不超過 25 字。",
  "只稱呼讀者「你」，不用「您」「大家」。",
  "白話到小學生看得懂，術語第一次出現就用生活比喻翻譯。",
  "每篇至少一句可以截圖的關鍵句，獨立成行，可以用 ➤ ❝ ❞ 標出。",
  "自問自答推進：「那，你呢？」「答案：」「但問題就出在這裡。」",
  "收尾回到開頭，或用一句對照句收。",
  "保留艾瑞克的口語人格：引導式提問（對吧、你懂我意思嗎）、自我揭露與猶豫、離題後拉回、長鋪墊短句收尾。不要寫成教條或說教。",
  "誠實、不完美的結尾比漂亮的結尾更有信任感。",
];

/** 像但不模仿 */
export const FLOW_ANTI_IMITATION = [
  "只借結構、節奏與推論方式，不照搬 Jemmy Ko、多米、周加恩任何一篇的原句、案例、人物或標題。",
  "源頭的招牌句不要原句照用（見下方清單），換成艾瑞克自己的說法。",
  "例子、比喻與故事一律換成艾瑞克的領域：生命數字、調頻、企業經營、他自己的經歷。",
  "源頭習慣的破折號、Markdown、髒話、系列預告，這裡一律不用。",
];

/** 源頭招牌句：出現就提醒「太像源頭」 */
export const SOURCE_SIGNATURE_PHRASES: Array<{ phrase: string; family: FlowFamily }> = [
  { phrase: "這人叫", family: "jemmy" },
  { phrase: "允許自己，發 100", family: "jemmy" },
  { phrase: "給你爽就好", family: "jemmy" },
  { phrase: "文字變現", family: "jemmy" },
  { phrase: "我有一個洞察", family: "domy" },
  { phrase: "屁用沒用", family: "domy" },
  { phrase: "錯錯錯", family: "domy" },
  { phrase: "差了 18 條街", family: "domy" },
  { phrase: "觀點生產線", family: "domy" },
  { phrase: "囉嗦才是精準", family: "domy" },
  { phrase: "越階", family: "domy" },
  { phrase: "敲碗", family: "chiukaun" },
  { phrase: "另一篇文章的主題", family: "chiukaun" },
  { phrase: "草履蟲", family: "chiukaun" },
  { phrase: "馴獸", family: "chiukaun" },
  { phrase: "白帶心態", family: "chiukaun" },
  { phrase: "電馭", family: "chiukaun" },
  { phrase: "他媽", family: "chiukaun" },
];

const BRAND_TONE: Record<FlowBrand, string> = {
  nas: "平衡空間：溫暖但直接，數字是看懂自己的工具，不是宿命。",
  abl: "艾伯林量子調頻：重點是共感與陪伴，可以只共感不給解方。頻率照對外定調：它是工具，作用機制科學上尚未證實，不保證效果。",
  i8: "初八企業顧問：可以最犀利，多用商業比喻，讀者是老闆與主管。",
  erick: "艾瑞克個人：以親身經歷為主，口語、自我揭露。",
};

export function flowBrandFrom(value: string): FlowBrand {
  const v = String(value || "");
  if (/i8|初八/i.test(v)) return "i8";
  if (/nas|平衡空間/i.test(v)) return "nas";
  if (/abl|艾伯林/i.test(v)) return "abl";
  return "erick";
}

/** 結構代號或名稱轉成代號（「J3」「j3」「反常識宣言」都可以） */
export function flowStructureFromText(value: string): string | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const code = text.match(/\b([JDCjdc])\s*([1-8])\b/);
  if (code) {
    const id = `${code[1].toUpperCase()}${code[2]}`;
    if (FLOW_STRUCTURES[id]) return id;
  }
  const byName = FLOW_STRUCTURE_LIST.find((s) => text.includes(s.name));
  return byName ? byName.id : null;
}

/** 提示詞裡用「【流量結構】J3」或「【本篇流量結構】反常識宣言」指定 */
export function readFlowStructureFromPrompt(prompt: string): string | null {
  const match = String(prompt || "").match(/【(?:本篇)?流量結構[^】]*】\s*([^\n]{1,24})/);
  return match ? flowStructureFromText(match[1]) : null;
}

/** 生成提示詞裡用來辨認「已經帶了結構指令」的記號 */
export const FLOW_DIRECTIVE_MARK = "【本篇流量結構：";

/** 送給 Maya 的結構指令 */
export function buildFlowStructureDirective(id: string, brandValue = "", opts: { keepOpening?: boolean } = {}): string {
  const s = FLOW_STRUCTURES[id];
  if (!s) return "";
  const brand = flowBrandFrom(brandValue);
  const signatures = SOURCE_SIGNATURE_PHRASES.map((item) => `「${item.phrase}」`).join("、");
  return [
    `${FLOW_DIRECTIVE_MARK}${s.name}（${FAMILY_SHORT[s.family]} ${s.id}）】`,
    `這一篇的段落順序與筆法照下面的結構寫，優先於提示詞裡其他關於段落結構${opts.keepOpening ? "" : "與開場寫法"}的建議。文體的目的與漏斗、標題型、小標規則、品牌規範、紅線、禁用詞與事實邊界一律照原本規則。${opts.keepOpening ? "開場照本篇指定的開場型寫，再接下面的骨架。" : ""}`,
    `用途：${s.use}`,
    "骨架：",
    ...s.checkpoints.map((c, i) => `${i + 1}. ${c.label}：${c.look}`),
    `這個結構的關鍵：${s.sourceMove}`,
    `做成艾瑞克的版本：${s.erickTwist}`,
    s.limits ? `限制：${s.limits}` : "",
    `建議字數 ${s.length[0]} 到 ${s.length[1]} 字；平台字數限制優先。平台較短時（例如 Threads），只保留第一步、關鍵句與收尾。`,
    "小標寫成單獨一行的純文字，行首不加符號（源頭用 ▋▌ 的地方都改成這樣）。關鍵句可以用 ➤ ❝ ❞，條列可以用 • 或 1. 2. 3.，循環可以用 ⇨。",
    "【共通筆法】",
    ...FLOW_SHARED_CRAFT.map((line) => `- ${line}`),
    "【像但不模仿】",
    ...FLOW_ANTI_IMITATION.map((line) => `- ${line}`),
    `- 源頭招牌句：${signatures}。`,
    `【品牌語氣】${BRAND_TONE[brand]}`,
    "【紅線】不編數字、成效、見證；虛構人物可以用，但不說成真實客戶；文章裡不寫「故事情境為示意」這類聲明；不預告下一篇；不用破折號與 Markdown。",
  ].filter(Boolean).join("\n");
}

export interface PickFlowInput {
  brand: string;
  genre?: FlowGenre | null;
  /** 同品牌最近幾篇用過的結構，由近到遠 */
  recent?: Array<string | null>;
  seed: string;
  /** 提示詞帶了艾瑞克的真實素材（逐字稿、口述） */
  hasMaterial?: boolean;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** 自動挑結構：符合品牌與文體，避開最近 3 篇，盡量不跟上一篇同一系，同 seed 結果固定 */
export function pickFlowStructure(input: PickFlowInput): string {
  const brand = flowBrandFrom(input.brand);
  const recent = (input.recent || []).filter((id): id is string => Boolean(id && FLOW_STRUCTURES[id]));
  const allowed = FLOW_STRUCTURE_LIST.filter((s) =>
    s.brands.includes(brand) && !s.needsCitation && (input.hasMaterial || !s.firstPersonReal));
  const byGenre = input.genre ? allowed.filter((s) => s.genres.includes(input.genre as FlowGenre)) : allowed;
  let pool = byGenre.length ? byGenre : allowed;
  // 2026-11-14：只避開前三篇時，同一型（J1）在一批裡出現七次。
  // 改成看前後鄰近的篇數，先挑「最近用得最少」的那幾型，再換家族，最後才用種子決定。
  const window = recent.slice(0, 8);
  const usage = (id: string): number => window.filter((used) => used === id).length;
  const minUsage = Math.min(...pool.map((s) => usage(s.id)));
  pool = pool.filter((s) => usage(s.id) === minUsage);
  const lastFamily = recent[0] ? FLOW_STRUCTURES[recent[0]].family : null;
  const otherFamily = pool.filter((s) => s.family !== lastFamily);
  if (otherFamily.length) pool = otherFamily;
  return pool[hashSeed(input.seed) % pool.length].id;
}

/** 寫進自動流水線任務 warnings 的記號，用來輪替與對照檢視 */
export const FLOW_NOTE_PREFIX = "流量結構：";
export const flowStructureNote = (id: string): string =>
  FLOW_STRUCTURES[id] ? `${FLOW_NOTE_PREFIX}${id} ${FLOW_STRUCTURES[id].name}` : "";
export function readFlowStructureNote(warnings: unknown): string | null {
  const list = Array.isArray(warnings) ? warnings : [];
  const hit = list.find((item) => typeof item === "string" && item.startsWith(FLOW_NOTE_PREFIX));
  return typeof hit === "string" ? flowStructureFromText(hit.slice(FLOW_NOTE_PREFIX.length)) : null;
}

// ───────── 對照檢視：程式規則（不需要 AI） ─────────

export interface FlowRuleIssue {
  level: "block" | "warn" | "ok";
  area: "流量筆法" | "像但不模仿" | "紅線";
  message: string;
}

const bodyLines = (text: string): string[] =>
  String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);

/** 段落（以空行分隔）平均字數 */
export function averageParagraphLength(text: string): number {
  const paragraphs = String(text || "").split(/\n\s*\n/).map((p) => p.replace(/\s+/g, "")).filter(Boolean).slice(1);
  if (!paragraphs.length) return 0;
  return Math.round(paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length);
}

export function findSignaturePhrases(text: string): Array<{ phrase: string; family: FlowFamily }> {
  const body = String(text || "");
  return SOURCE_SIGNATURE_PHRASES.filter((item) => body.includes(item.phrase));
}

/** 不用 AI 就能判定的項目：流量筆法、像但不模仿、紅線 */
export function checkFlowRules(text: string, id?: string | null): FlowRuleIssue[] {
  const issues: FlowRuleIssue[] = [];
  const lines = bodyLines(text);
  const body = String(text || "");
  const structure = id ? FLOW_STRUCTURES[id] : null;

  // 紅線
  if (/[—―─━–]/.test(body)) issues.push({ level: "block", area: "紅線", message: "出現破折號，四個品牌一律不用。" });
  if (/\*\*|^#{1,6}\s/m.test(body)) issues.push({ level: "block", area: "紅線", message: "出現 Markdown 符號（** 或 ##），Facebook 不支援。" });
  if (/(為示意|僅為示意|僅供示意|純屬虛構|為虛構)/.test(body)) issues.push({ level: "block", area: "紅線", message: "文章裡有「示意」「虛構」這類聲明，請拿到文章外面。" });
  if (/(下一篇|下篇|下次再來聊|下回分解|另一篇文章的主題)/.test(body)) issues.push({ level: "warn", area: "紅線", message: "結尾像在預告下一篇，除非你指定要做系列，否則拿掉。" });
  if (/【需補|待補|待確認】/.test(body)) issues.push({ level: "block", area: "紅線", message: "文章裡留著【需補】這類標記。" });

  // 像但不模仿
  const signatures = findSignaturePhrases(body);
  if (signatures.length) {
    issues.push({ level: "warn", area: "像但不模仿", message: `出現源頭招牌句：${signatures.map((s) => `「${s.phrase}」（${FAMILY_SHORT[s.family]}）`).join("、")}，換成你自己的說法。` });
  } else {
    issues.push({ level: "ok", area: "像但不模仿", message: "沒有出現源頭的招牌句。" });
  }

  // 流量筆法
  const title = lines[0] || "";
  const opener = lines[1] || "";
  if (!/^【.+】$/.test(title)) issues.push({ level: "warn", area: "流量筆法", message: "第一行建議是用【】包起來的標題。" });
  if (/^(很多人|許多人|不少人|有些人|在這個|人生就是|生活總是|每個人都|我們總是)/.test(opener)) {
    issues.push({ level: "warn", area: "流量筆法", message: `開場第一句「${opener.slice(0, 18)}…」像前言，第一行就要是鉤子（人物、宣言、提問、數字或畫面）。` });
  }
  const avg = averageParagraphLength(body);
  if (avg > 70) issues.push({ level: "warn", area: "流量筆法", message: `段落平均 ${avg} 字，偏長。一段一到兩句、段與段空一行。` });
  else if (avg > 0) issues.push({ level: "ok", area: "流量筆法", message: `段落平均 ${avg} 字，手機好讀。` });
  if (/您|大家好/.test(body)) issues.push({ level: "warn", area: "流量筆法", message: "出現「您」或「大家好」，只稱呼讀者「你」。" });
  const keyLine = lines.some((line) => /^➤|❝.+❞/.test(line)) || lines.some((line, i) => i > 1 && line.length <= 22 && /[。！]$/.test(line));
  if (!keyLine) issues.push({ level: "warn", area: "流量筆法", message: "找不到一句獨立成行、可以截圖的關鍵句。" });

  const plain = body.replace(/\s+/g, "");
  if (structure) {
    const len = plain.length;
    if (len < structure.length[0] * 0.7) issues.push({ level: "warn", area: "流量筆法", message: `全文約 ${len} 字，比「${structure.name}」建議的 ${structure.length[0]} 字短很多。` });
    else if (len > structure.length[1] * 1.4) issues.push({ level: "warn", area: "流量筆法", message: `全文約 ${len} 字，比「${structure.name}」建議的 ${structure.length[1]} 字長很多。` });
  }
  return issues;
}

/** 給 AI 判定每一步的提示詞 */
export function buildFlowCheckPrompt(id: string, text: string): string {
  const s = FLOW_STRUCTURES[id];
  if (!s) return "";
  return [
    "你是艾瑞克的寫作教練，負責檢查一篇文章有沒有照指定的流量結構寫。",
    `指定結構：${s.name}（${FAMILY_SHORT[s.family]} ${s.id}）。用途：${s.use}`,
    `源頭寫法重點：${s.sourceMove}`,
    `艾瑞克版本的要求：${s.erickTwist}`,
    "逐一檢查下面每一步：",
    ...s.checkpoints.map((c) => `- ${c.id}｜${c.label}：${c.look}`),
    "判定規則：hit 只能是 yes、partial、no。evidence 必須是文章裡原封不動的一句（最多 60 字），找不到就給空字串。note 用一句話說明為什麼，partial 或 no 時說明怎麼改。",
    "另外：",
    "1. thesis：用一句話寫出這篇文章唯一的論點；如果一篇講了兩個以上的論點，在 thesis_note 說明。",
    "2. imitation：判斷這篇是「借結構」還是「在模仿某位創作者」。若句子、案例或標題明顯照抄知名創作者（Jemmy Ko、多米、周加恩）的原文或招牌說法，level 給 high；只有結構相似給 low。note 一句話。",
    "3. fixes：最多三條最值得先改的建議，每條一句話。",
    "全部用繁體中文，不要用破折號。",
    "只輸出 JSON：",
    '{"checkpoints":[{"id":"J1-1","hit":"yes","evidence":"","note":""}],"thesis":"","thesis_note":"","imitation":{"level":"low","note":""},"fixes":[""]}',
    "",
    "### 文章：",
    '"""',
    String(text || "").slice(0, 9000),
    '"""',
  ].join("\n");
}

export interface FlowCheckpointResult { id: string; hit: "yes" | "partial" | "no"; evidence: string; note: string }
export interface FlowCheckResult {
  structureId: string;
  checkpoints: FlowCheckpointResult[];
  thesis: string;
  thesisNote: string;
  imitation: { level: "low" | "high"; note: string };
  fixes: string[];
  rules: FlowRuleIssue[];
  /** 0 到 100，yes 算 1、partial 算 0.5 */
  score: number;
  aiAvailable: boolean;
}

/** 把 AI 回傳清成固定格式；AI 漏掉的步驟補成「未判定」 */
export function normalizeFlowCheck(id: string, raw: unknown, text: string, aiAvailable: boolean): FlowCheckResult {
  const s = FLOW_STRUCTURES[id];
  type RawCheckpoint = { id?: unknown; hit?: unknown; evidence?: unknown; note?: unknown };
  const data = (raw && typeof raw === "object" ? raw : {}) as {
    checkpoints?: unknown; thesis?: unknown; thesis_note?: unknown; imitation?: { level?: unknown; note?: unknown }; fixes?: unknown;
  };
  const list: RawCheckpoint[] = Array.isArray(data.checkpoints) ? (data.checkpoints as RawCheckpoint[]) : [];
  const checkpoints: FlowCheckpointResult[] = (s?.checkpoints || []).map((c) => {
    const found: RawCheckpoint = list.find((item) => item && item.id === c.id) || {};
    const hit = found.hit === "yes" || found.hit === "partial" ? found.hit : "no";
    const evidence = typeof found.evidence === "string" && found.evidence && String(text).includes(found.evidence.trim()) ? found.evidence.trim() : "";
    return { id: c.id, hit: aiAvailable ? hit : "no", evidence, note: aiAvailable ? String(found.note || "") : "AI 沒有回應，這一步需要你自己對照。" };
  });
  const points = checkpoints.reduce((sum, c) => sum + (c.hit === "yes" ? 1 : c.hit === "partial" ? 0.5 : 0), 0);
  return {
    structureId: id,
    checkpoints,
    thesis: String(data.thesis || ""),
    thesisNote: String(data.thesis_note || ""),
    imitation: { level: data.imitation?.level === "high" ? "high" : "low", note: String(data.imitation?.note || "") },
    fixes: Array.isArray(data.fixes) ? (data.fixes as unknown[]).map(String).filter(Boolean).slice(0, 3) : [],
    rules: checkFlowRules(text, id),
    score: checkpoints.length ? Math.round((points / checkpoints.length) * 100) : 0,
    aiAvailable,
  };
}

/** 給海巡批次與其他 AI 用的完整規則文字 */
export function buildFlowStructureCatalog(): string {
  return [
    `【流量結構庫 ${FLOW_STRUCTURE_VERSION}】共 ${FLOW_STRUCTURE_IDS.length} 型。批次提示詞可以用「【流量結構】代號」指定，例如「【流量結構】J3」。不指定就由系統依品牌與文體輪替。`,
    ...FLOW_STRUCTURE_LIST.map((s) => `${s.id} ${s.name}（${FAMILY_SHORT[s.family]}）：${s.use} 適用：${s.brands.join("、")}${s.firstPersonReal ? "，需要艾瑞克的真實素材" : ""}${s.needsCitation ? "，需要查證過的書" : ""}`),
  ].join("\n");
}
