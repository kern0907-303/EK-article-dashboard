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
  brandLabel: "I8 企業醫生｜企業決策校準",
  title: "公司裡，哪些管理情境最常反覆出現？",
  subtitle: "五題管理情境盤點",
  intro:
    "企業最怕的不是問題出現，而是一直處理錯問題。這份盤點協助你整理目前較常出現的管理情境，作為下一步釐清優先順序的參考；它不是正式診斷或自動判定服務。",
  submitLabel: "查看盤點摘要",
  privacyNote: "我們只會用這個信箱寄送本次盤點摘要，不會轉發給第三方，也不會有業務電話。",
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
      title: "組織協作：同一件事，團隊沒有共同判斷基準",
      body: "當同一個管理情境出現時，不同角色各自採取不同做法，問題未必在某個人做得不夠好。可以先回頭確認：團隊是否看得到相同的關鍵因素，以及目前優先順序是否有被清楚說明。",
      nextStep:
        "挑一個最近反覆出現的管理情境，請三位不同角色各自寫下他們認為的優先順序，再一起對照差異。",
    },
    {
      key: "i8_capacity",
      title: "角色權責：決策過度集中在同一個人身上",
      body: "當多數問題都需要同一位管理者最後決定，先不要急著把原因放在團隊承接力。更值得盤點的是：哪些決策可以由不同角色處理、每個角色需要哪些資訊，以及什麼情況需要再往上升級。",
      nextStep:
        "選一類反覆出現的決策，寫下目前由誰決定、需要哪些資訊、什麼情況才需要升級確認。",
    },
    {
      key: "i8_pricing",
      title: "資源配置：投入很多，但沒有共同的處理順序",
      body: "當不同工作同時被標為最急，團隊容易在很多方向分散投入。這不一定代表任何一個計畫不重要，而是資源配置尚未有一個能被共同採用的優先順序。",
      nextStep:
        "列出目前三件最佔用時間的工作，逐一標記它們要解決的管理情境，以及若延後一週會造成什麼影響。",
    },
    {
      key: "i8_rhythm",
      title: "管理節奏：問題反覆出現，但沒有回到經營流程盤點",
      body: "同一個問題反覆出現，不代表單一員工或部門就是原因。可以先把每次問題出現前後的經營流程、資訊交接與決策時間點放在一起看，較容易找到需要優先處理的關鍵因素。",
      nextStep:
        "把最近一個月重複出現的問題列出來，挑最常見的一項，依序記下它發生前的資訊、決策與交接環節。",
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
