// 各品牌的名單捕捉測驗題庫
//
// 這三份測驗是信任漏斗的入口。依 conversion.ts 的漏斗階段設計：
// NAS(entry) 對陌生人、ABL/I8(nurture) 對已知道自己卡住的人。
// 語氣與用詞遵循品牌規範，禁用詞已避開（NAS 不談信息場、I8 不談靈性）。

export interface QuizOption {
  label: string;
  /** 對應到哪個結果類型 */
  scores: Record<string, number>;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
}

export interface QuizResult {
  /** 寫入名單表的 result_type */
  key: string;
  title: string;
  /** 結果說明，同時作為寄出信件的主體 */
  body: string;
  /** 看完結果後的下一步建議 */
  nextStep: string;
}

export interface QuizConfig {
  slug: string;
  brandId: string;
  shortId: string;
  brandLabel: string;
  title: string;
  subtitle: string;
  /** 開始前的說明 */
  intro: string;
  /** 表單送出按鈕文字 */
  submitLabel: string;
  /** email 欄位下方的信任說明 */
  privacyNote: string;
  accent: {
    text: string;
    bg: string;
    bgHover: string;
    border: string;
    ring: string;
  };
  questions: QuizQuestion[];
  results: QuizResult[];
}

// ---------------------------------------------------------------- NAS

const NAS_QUIZ: QuizConfig = {
  slug: "nas/quiz",
  brandId: "brand_b_nas",
  shortId: "nas",
  brandLabel: "NAS 生命數字",
  title: "你正在用不適合自己的方式努力嗎？",
  subtitle: "三分鐘生命節奏小測",
  intro:
    "有些人不是不努力，而是一直用不適合自己的方式努力，所以才會越做越累。這份小測不會告訴你命運已經決定，而是幫你看懂自己慣性的思考與行動模式。",
  submitLabel: "看我的完整解析",
  privacyNote: "我們只會用這個信箱寄送你的解析結果，不會轉發給第三方。",
  accent: {
    text: "text-violet-300",
    bg: "bg-violet-600",
    bgHover: "hover:bg-violet-500",
    border: "border-violet-500/30",
    ring: "focus:ring-violet-500/30",
  },
  questions: [
    {
      id: "n1",
      text: "當你面對一個新機會，通常第一個反應是？",
      options: [
        { label: "先想清楚所有細節與風險，確定了再動", scores: { analyst: 2, builder: 1 } },
        { label: "先感受一下這件事對不對，再決定要不要投入", scores: { feeler: 2 } },
        { label: "先看有沒有人一起做，一個人會有點猶豫", scores: { connector: 2 } },
        { label: "直接開始，邊做邊修", scores: { builder: 2 } },
      ],
    },
    {
      id: "n2",
      text: "最近讓你消耗最多的，比較接近哪一種？",
      options: [
        { label: "想太多、遲遲無法下決定", scores: { analyst: 2 } },
        { label: "太在意別人的感受，委屈了自己", scores: { connector: 2, feeler: 1 } },
        { label: "事情很多，但看不到累積", scores: { builder: 2 } },
        { label: "說不上來，就是提不起勁", scores: { feeler: 2 } },
      ],
    },
    {
      id: "n3",
      text: "在關係裡，你比較常出現哪種狀況？",
      options: [
        { label: "習慣先照顧對方，久了覺得不平衡", scores: { connector: 2 } },
        { label: "希望對方講清楚，模糊會讓我不安", scores: { analyst: 2 } },
        { label: "情緒來得快也去得快，但當下很強烈", scores: { feeler: 2 } },
        { label: "用做事表達關心，不太說出口", scores: { builder: 2 } },
      ],
    },
    {
      id: "n4",
      text: "如果現在有一整天完全屬於你，你最想做什麼？",
      options: [
        { label: "把積欠的事情一次整理完，會很有成就感", scores: { builder: 2 } },
        { label: "研究一個一直想搞懂的主題", scores: { analyst: 2 } },
        { label: "跟重要的人好好聊一場", scores: { connector: 2 } },
        { label: "什麼都不做，讓自己空著", scores: { feeler: 2 } },
      ],
    },
    {
      id: "n5",
      text: "你希望三年後的自己，最明顯的改變是什麼？",
      options: [
        { label: "有清楚的方向，不再反覆搖擺", scores: { analyst: 2, feeler: 1 } },
        { label: "做出實際的成果，而不只是忙", scores: { builder: 2 } },
        { label: "關係更輕鬆，不用一直討好", scores: { connector: 2 } },
        { label: "更認識自己，知道什麼適合我", scores: { feeler: 2 } },
      ],
    },
  ],
  results: [
    {
      key: "nas_analyst",
      title: "思考型節奏：你需要的是「夠好」而不是「確定」",
      body: "你習慣把事情想清楚再動，這讓你少犯很多錯，但也常讓你錯過時機。你不是猶豫不決，你只是對「還沒想通」這件事特別不安。你的天賦在於看見別人看不到的細節與風險；你的盲點是把「準備好」設得太高。",
      nextStep:
        "接下來一週，挑一件小事，在資訊只有七成的情況下就先動。你會發現世界不會塌，而你的節奏會鬆開一點。",
    },
    {
      key: "nas_feeler",
      title: "感受型節奏：你的敏銳不是問題，是還沒被好好安放",
      body: "你不是想太多，你只是對感受比較敏銳，需要一點時間把自己整理清楚。你能接收到很多別人忽略的訊息，這是天賦；但當你沒有space消化，這些訊息就會變成內耗。",
      nextStep:
        "接下來一週，每天留十五分鐘什麼都不做。不是放空，是讓已經接收到的東西有時間沉澱。",
    },
    {
      key: "nas_connector",
      title: "關係型節奏：你照顧了很多人，包括不該由你照顧的",
      body: "你很自然地會先感受到別人的需要，這讓你在關係中很被信任。但你的課題是：你常常在別人開口之前就先給了，久了對方習以為常，你卻覺得不被看見。這不是對方的錯，也不是你的錯，是你的慣性還沒被調整。",
      nextStep:
        "接下來一週，練習一次「不主動提供」。等對方開口再回應，觀察自己的不安從哪裡來。",
    },
    {
      key: "nas_builder",
      title: "行動型節奏：你做了很多，但方向需要重新對焦",
      body: "你的優勢是啟動快、執行力強，別人還在討論你已經做完了。但這也讓你容易在錯誤的方向上跑很遠。你的疲累通常不是來自做太多，而是來自做了之後發現不是想要的。",
      nextStep:
        "接下來一週，在啟動任何新事情之前，先問自己一句：「三個月後，這件事會累積成什麼？」",
    },
  ],
};

// ---------------------------------------------------------------- ABL

const ABL_QUIZ: QuizConfig = {
  slug: "abl/check",
  brandId: "brand_c_abl",
  shortId: "abl",
  brandLabel: "ABL 狀態調和",
  title: "你的狀態，已經撐了多久？",
  subtitle: "五題狀態自我檢視",
  intro:
    "你不是沒有努力，而是你已經用撐住的方式活太久了。這份檢視不會給你更多方法，而是先幫你看清楚，目前的消耗來自哪裡。",
  submitLabel: "看我的狀態整理建議",
  privacyNote:
    "這份檢視僅供自我覺察，不構成醫療診斷。我們只會用這個信箱寄送結果，不會轉發給第三方。",
  accent: {
    text: "text-teal-300",
    bg: "bg-teal-600",
    bgHover: "hover:bg-teal-500",
    border: "border-teal-500/30",
    ring: "focus:ring-teal-500/30",
  },
  questions: [
    {
      id: "a1",
      text: "最近三個月，你的睡眠狀況是？",
      options: [
        { label: "大致穩定，起床後有恢復感", scores: { steady: 2 } },
        { label: "睡得著但淺，醒來還是累", scores: { depleted: 2 } },
        { label: "腦袋停不下來，很難入睡", scores: { overloaded: 2 } },
        { label: "時好時壞，跟情緒有關", scores: { looping: 2 } },
      ],
    },
    {
      id: "a2",
      text: "當你想改變某件事，最常卡在哪裡？",
      options: [
        { label: "知道該怎麼做，但就是動不了", scores: { depleted: 2, looping: 1 } },
        { label: "一開始很有動力，過幾天就回到原樣", scores: { looping: 2 } },
        { label: "事情太多，根本排不進去", scores: { overloaded: 2 } },
        { label: "還好，通常可以推進", scores: { steady: 2 } },
      ],
    },
    {
      id: "a3",
      text: "身體最近有沒有給你什麼訊號？",
      options: [
        { label: "肩頸緊、頭痛，檢查卻沒什麼問題", scores: { overloaded: 2 } },
        { label: "容易疲倦，提不起勁", scores: { depleted: 2 } },
        { label: "腸胃或皮膚跟著情緒起伏", scores: { looping: 2 } },
        { label: "目前還算平穩", scores: { steady: 2 } },
      ],
    },
    {
      id: "a4",
      text: "面對別人的需要，你通常會？",
      options: [
        { label: "很難拒絕，答應了才後悔", scores: { depleted: 2 } },
        { label: "會答應，但心裡累積不滿", scores: { looping: 2 } },
        { label: "已經沒有餘力，只能先顧自己", scores: { overloaded: 2 } },
        { label: "可以視情況拒絕，不太有負擔", scores: { steady: 2 } },
      ],
    },
    {
      id: "a5",
      text: "如果用一句話形容現在的自己，比較接近？",
      options: [
        { label: "還在撐，但快撐不住了", scores: { overloaded: 2 } },
        { label: "沒有很糟，只是空空的", scores: { depleted: 2 } },
        { label: "一直在同一個地方繞", scores: { looping: 2 } },
        { label: "整體還可以，想再穩一點", scores: { steady: 2 } },
      ],
    },
  ],
  results: [
    {
      key: "abl_overloaded",
      title: "長期過載：你的系統已經在超速運轉",
      body: "很多情緒不是突然出現的，而是長期被壓下來的訊號。你目前的狀態顯示，消耗速度大於恢復速度已經有一段時間了。身體的緊繃、睡不深、腦袋停不下來，都是同一件事的不同表現。這不代表你壞掉了，而是這套運作方式已經到了它的極限。",
      nextStep:
        "先不要急著加方法。接下來三天，每天找一個十分鐘的空檔，什麼都不做，只是坐著。目標不是放鬆，是讓系統知道可以停。",
    },
    {
      key: "abl_depleted",
      title: "低電量：不是不想動，是真的沒有力氣",
      body: "有些改變不是靠意志力，而是需要先讓狀態穩定下來。你現在的狀況比較像是電量長期偏低——道理都懂，但執行需要的能量不夠。這時候要求自己更努力，只會讓落差感更重。",
      nextStep:
        "接下來一週，把待辦清單砍到只剩三件。不是因為其他不重要，而是先讓自己重新感覺到「做得到」。",
    },
    {
      key: "abl_looping",
      title: "反覆迴圈：你不是退步，是還沒走出同一個模式",
      body: "你現在的反應，不一定是錯的，它可能曾經保護過你，只是現在已經不再適合。一直回到原點通常不是意志力問題，而是那個模式在某個時期真的有用，所以身體記住了它。要調整的不是決心，是先看清楚這個迴圈的觸發點。",
      nextStep:
        "接下來一週，記錄「回到原樣」的那個瞬間發生了什麼。不用改變它，只要先看見。",
    },
    {
      key: "abl_steady",
      title: "相對穩定：可以往「更清明」的方向調",
      body: "你目前的狀態相對穩定，這是很好的基礎。這個階段適合處理的不是危機，而是那些一直存在、但被你忽略的小消耗——那些你以為「還好」但其實一直在扣分的地方。",
      nextStep:
        "接下來一週，找出一件你長期忍耐但沒說的事。穩定的時候，才有餘力處理它。",
    },
  ],
};

// ---------------------------------------------------------------- I8

const I8_QUIZ: QuizConfig = {
  slug: "i8/diagnosis",
  brandId: "brand_a_i8",
  shortId: "i8",
  brandLabel: "I8 企業決策校準",
  title: "你的公司卡在哪一層？",
  subtitle: "五題經營卡點自評",
  intro:
    "企業經營最怕的不是問題出現，而是一直處理錯問題。這份自評幫你判斷，目前的瓶頸比較可能出在定位、組織承載力，還是決策節奏。",
  submitLabel: "看我的診斷結果",
  privacyNote: "我們只會用這個信箱寄送診斷結果，不會轉發給第三方，也不會有業務電話。",
  accent: {
    text: "text-indigo-300",
    bg: "bg-indigo-600",
    bgHover: "hover:bg-indigo-500",
    border: "border-indigo-500/30",
    ring: "focus:ring-indigo-500/30",
  },
  questions: [
    {
      id: "i1",
      text: "過去一年，公司的業績狀況比較接近？",
      options: [
        { label: "成長停滯，做的事沒少但數字沒動", scores: { positioning: 2 } },
        { label: "有成長，但利潤沒有跟著上來", scores: { pricing: 2 } },
        { label: "起伏很大，難以預測", scores: { rhythm: 2 } },
        { label: "成長中，但團隊快跟不上", scores: { capacity: 2 } },
      ],
    },
    {
      id: "i2",
      text: "如果客戶問「為什麼要選你們」，你的回答是？",
      options: [
        { label: "有清楚的答案，團隊講的也一致", scores: { capacity: 1, rhythm: 1 } },
        { label: "我講得出來，但同仁講的版本都不太一樣", scores: { positioning: 2 } },
        { label: "主要還是靠價格或關係", scores: { pricing: 2 } },
        { label: "老實說要想一下", scores: { positioning: 2 } },
      ],
    },
    {
      id: "i3",
      text: "公司裡有多少決策最後要你點頭？",
      options: [
        { label: "幾乎所有重要的都要", scores: { capacity: 2 } },
        { label: "一半以上", scores: { capacity: 2, rhythm: 1 } },
        { label: "只有真正關鍵的", scores: { rhythm: 1 } },
        { label: "已經有人可以獨立判斷", scores: { positioning: 1 } },
      ],
    },
    {
      id: "i4",
      text: "調漲價格這件事，你的感覺是？",
      options: [
        { label: "不太敢，怕客戶跑掉", scores: { pricing: 2 } },
        { label: "想過，但不知道怎麼開口", scores: { pricing: 2 } },
        { label: "調過，客戶接受度還可以", scores: { capacity: 1 } },
        { label: "價格不是我們的主要問題", scores: { positioning: 1, rhythm: 1 } },
      ],
    },
    {
      id: "i5",
      text: "你最近一次覺得「又在處理同樣的問題」是什麼時候？",
      options: [
        { label: "這個月就有好幾次", scores: { rhythm: 2 } },
        { label: "偶爾，但都是同一類的事", scores: { capacity: 2 } },
        { label: "很久沒有了", scores: { positioning: 1 } },
        { label: "一直都是這樣，已經習慣", scores: { rhythm: 2, capacity: 1 } },
      ],
    },
  ],
  results: [
    {
      key: "i8_positioning",
      title: "定位層：問題不在行銷，在於「你是誰」還沒說清楚",
      body: "當業績停滯時，不一定是行銷問題，也可能是定位出現偏差。一個明顯的訊號是：同一個問題，你和同仁給出的答案不一樣。這代表定位還停留在你的腦袋裡，沒有變成整個組織的共識，於是每個接觸點傳遞的訊息都在稀釋。",
      nextStep:
        "找三位同仁分別問「客戶為什麼選我們」，把答案寫下來對照。差異的地方就是你的定位缺口。",
    },
    {
      key: "i8_capacity",
      title: "組織承載力層：公司的天花板是你的工作時數",
      body: "很多老闆以為公司缺的是人才，但真正缺的可能是授權結構。當大部分決策都要經過你，公司的成長上限就等於你的處理速度。這不是同仁能力不足，通常是判斷的標準沒有被寫下來，所以他們不敢決定。",
      nextStep:
        "挑一類反覆出現的決策，把你的判斷邏輯寫成三條規則交給同仁。觀察一個月的錯誤率——多半會低於你的預期。",
    },
    {
      key: "i8_pricing",
      title: "價值承接層：不是不能漲價，是還沒建立漲價的理由",
      body: "不敢調價通常不是勇氣問題，而是你自己也不完全確定客戶買的是什麼。當價值只能用「服務好、有經驗」來描述時，客戶自然只能用價格比較。有成長但利潤沒跟上，往往就是這一層的訊號。",
      nextStep:
        "回頭看最近五個成交案例，找出客戶真正付錢解決的那件事。那才是你可以定價的東西。",
    },
    {
      key: "i8_rhythm",
      title: "決策節奏層：問題一直回來，因為處理的是症狀",
      body: "當企業目標、團隊節奏與老闆決策狀態不一致時，營運就容易出現反覆消耗。同樣的問題一個月出現好幾次，通常不是執行不力，而是每次都在處理表面，沒有動到產生它的結構。",
      nextStep:
        "把這個月重複出現的問題列出來，針對最頻繁的那一個，往上追三層問「為什麼會發生」。第三層通常才是真正的卡點。",
    },
  ],
};

export const QUIZZES: Record<string, QuizConfig> = {
  nas: NAS_QUIZ,
  abl: ABL_QUIZ,
  i8: I8_QUIZ,
};

/** 依作答計分，回傳得分最高的結果 */
export function scoreQuiz(config: QuizConfig, answers: Record<string, number>): QuizResult {
  const totals: Record<string, number> = {};
  for (const q of config.questions) {
    const chosen = answers[q.id];
    if (chosen === undefined) continue;
    const opt = q.options[chosen];
    if (!opt) continue;
    for (const [key, val] of Object.entries(opt.scores)) {
      totals[key] = (totals[key] || 0) + val;
    }
  }

  let bestKey = "";
  let bestScore = -1;
  for (const [key, val] of Object.entries(totals)) {
    if (val > bestScore) {
      bestScore = val;
      bestKey = key;
    }
  }

  // results 的 key 是 <shortId>_<type>，這裡用結尾比對
  return (
    config.results.find((r) => r.key.endsWith(`_${bestKey}`)) || config.results[0]
  );
}
