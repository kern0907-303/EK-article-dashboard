# Acceptance Test Report: AI Capability Orchestrator MVP

This report documents the results of executing the 6 required acceptance test cases on the AI Capability Orchestrator CLI.

---

## Test Run Summary

| # | Task Category | Prompt / Input | Target Route | Actual Route | Status |
|---|---|---|---|---|---|
| 1 | Research | 「請研究三個女性成長品牌的活動頁...」 | Gemini ➔ Claude ➔ ChatGPT | **GEMINI ➔ CLAUDE ➔ CHATGPT** | PASS |
| 2 | Long Text Analysis | 「請分析一篇 8000 字逐字稿...」 | Claude ➔ ChatGPT | **CLAUDE ➔ CHATGPT** | PASS |
| 3 | Brand Copywriting | 「請幫 NAS 生命數字寫一篇 FB 貼文...」 | ChatGPT only | **CHATGPT** | PASS |
| 4 | Corporate Advisory | 「請用 I8 角度分析一家企業業績停滯...」 | Claude ➔ ChatGPT | **CLAUDE ➔ CHATGPT** | PASS |
| 5 | Coding / Debugging | 「請建立 Python 腳本，讀取 capabilities.json...」 | Codex | **CODEX** | PASS |
| 6 | Knowledge Base Sync | 「請把本次執行結果整理成 markdown 知識庫...」 | Cowork | **COWORK** | PASS |

---

## Detailed Test Case Reports

### 1. Research 任務
* **Task Prompt**: `"請研究三個女性成長品牌的活動頁，整理它們的受眾、痛點、CTA 與活動包裝。"`
* **Classifier Result**:
  * **Task Type**: `Competitive Analysis & Marketing Asset Generation`
  * **Required Capabilities**: `['brand_translation', 'copywriting', 'cta_generation', 'deep_analysis', 'pain_point_extraction', 'retrieval', 'scraping']`
  * **Difficulty**: `high`
* **Selected Route**: `GEMINI ➔ CLAUDE ➔ CHATGPT`
* **Excluded Agents**:
  * `CODEX` (本地代碼測試/修復，專長不符)
  * `COWORK` (本地知識庫同步，專長不符)
* **Reasoning**: Gemini 用於高效率地爬取與彙整多個品牌的活動頁原始內容；Claude 針對產出的 Raw text 做核心痛點與受眾分析，產出情報卡；ChatGPT 將情報卡轉譯為女性成長品牌調性的行銷文案（FB、短影音、CTA）。
* **Token Estimate**: Input: 6,500 | Output: 4,500 (Total: 11,000)
* **Mock Output Path**:
  * [raw_f9adc99a-c579-4645-8a38-eab22285b591.md](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/storage/raw/raw_f9adc99a-c579-4645-8a38-eab22285b591.md)
  * [card_f9adc99a-c579-4645-8a38-eab22285b591.json](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/storage/clean/card_f9adc99a-c579-4645-8a38-eab22285b591.json)
  * [assets_f9adc99a-c579-4645-8a38-eab22285b591.json](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/storage/assets/assets_f9adc99a-c579-4645-8a38-eab22285b591.json)
* **是否符合預期**: 是，完全符合預期。

---

### 2. 長文分析任務
* **Task Prompt**: `"請分析一篇 8000 字逐字稿，整理核心觀點、痛點、金句與可轉換內容。"`
* **Classifier Result**:
  * **Task Type**: `Content Creation`
  * **Required Capabilities**: `['brand_translation', 'copywriting', 'cta_generation', 'deep_analysis', 'pain_point_extraction']`
  * **Difficulty**: `high`
* **Selected Route**: `CLAUDE ➔ CHATGPT`
* **Excluded Agents**:
  * `GEMINI` (僅需做逐字稿分析，不需要網頁爬取或外部檢索)
  * `CODEX` (專長不符)
  * `COWORK` (專長不符)
* **Reasoning**: Claude Sonnet 負責對 8000 字逐字稿進行深度的邏輯提煉與痛點分析；ChatGPT 接著根據分析出的重點撰寫金句與社群行銷的「可轉換內容」。
* **Token Estimate**: Input: 2,500 | Output: 3,000 (Total: 5,500)
* **Mock Output Path**:
  * [card_7e6024a5-47e1-44e0-b8c3-1ac82b56f2cb.json](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/storage/clean/card_7e6024a5-47e1-44e0-b8c3-1ac82b56f2cb.json)
  * [assets_7e6024a5-47e1-44e0-b8c3-1ac82b56f2cb.json](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/storage/assets/assets_7e6024a5-47e1-44e0-b8c3-1ac82b56f2cb.json)
* **是否符合預期**: 是，完全符合預期。

---

### 3. 品牌文案任務
* **Task Prompt**: `"請幫 NAS 生命數字寫一篇第一層公開 FB 貼文，主題是中年女性找回人生方向。"`
* **Classifier Result**:
  * **Task Type**: `Content Creation`
  * **Required Capabilities**: `['brand_translation', 'copywriting', 'cta_generation']`
  * **Difficulty**: `medium`
* **Selected Route**: `CHATGPT` (ChatGPT only)
* **Excluded Agents**:
  * `GEMINI` (無資料擷取需求)
  * `CLAUDE` (單純社群行銷文案，不需高成本深度分析，ChatGPT mini 性價比最優)
  * `CODEX` / `COWORK` (專長不符)
* **Reasoning**: 單純的社群發文與品牌語氣轉換（如 NAS），直接交給善於社群感性筆觸、且成本極低的 ChatGPT-mini 即可完成，省下呼叫 Claude 的費用。
* **Token Estimate**: Input: 1,000 | Output: 2,000 (Total: 3,000)
* **Mock Output Path**:
  * [assets_f0272c81-6fdd-4d51-941c-4de2ee2ee413.json](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/storage/assets/assets_f0272c81-6fdd-4d51-941c-4de2ee2ee413.json)
* **是否符合預期**: 是，完全符合預期。

---

### 4. 企業顧問任務
* **Task Prompt**: `"請用 I8 角度分析一家企業業績停滯背後可能的組織承載力與決策卡點。"`
* **Classifier Result**:
  * **Task Type**: `Content Creation`
  * **Required Capabilities**: `['brand_translation', 'copywriting', 'cta_generation', 'deep_analysis', 'pain_point_extraction']`
  * **Difficulty**: `high`
* **Selected Route**: `CLAUDE ➔ CHATGPT`
* **Excluded Agents**:
  * `GEMINI` (無需外部網頁抓取，為顧問個案思考)
  * `CODEX` / `COWORK` (專長不符)
* **Reasoning**: 企業組織承載力與決策卡點需要極高邏輯推理與戰略深度，故首選 Claude 進行「卡點分析」；接著由 ChatGPT 以 I8 品牌的商業顧問角度（Brand Translation）包裝成對外的分析報告或 CTA 行銷內容。
* **Token Estimate**: Input: 2,500 | Output: 3,000 (Total: 5,500)
* **Mock Output Path**:
  * [card_cd162e76-8812-49dd-a779-992f5026835e.json](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/storage/clean/card_cd162e76-8812-49dd-a779-992f5026835e.json)
  * [assets_cd162e76-8812-49dd-a779-992f5026835e.json](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/storage/assets/assets_cd162e76-8812-49dd-a779-992f5026835e.json)
* **是否符合預期**: 是，完全符合預期。

---

### 5. 程式任務
* **Task Prompt**: `"請建立 Python 腳本，讀取 capabilities.json 並檢查每個 agent 是否有能力標籤、成本、限制與輸入輸出格式。"`
* **Classifier Result**:
  * **Task Type**: `Software Engineering & Testing`
  * **Required Capabilities**: `['code_patching', 'syntax_check', 'unit_test_run']`
  * **Difficulty**: `medium`
* **Selected Route**: `CODEX` (Codex only)
* **Excluded Agents**:
  * `GEMINI` / `CLAUDE` / `CHATGPT` / `COWORK` (因為僅是本地代碼的靜態檢查、測試執行，Codex 作為本地執行器最適合且免費)
* **Reasoning**: 此任務為 Python 腳本的自動化檢查與能力格式驗證，不需外部大型生成模型介入。由本地的 Codex 直接進行語法分析、單元測試執行即可，符合 0 成本、超高速的反饋需求。
* **Token Estimate**: Input: 500 | Output: 500 (Total: 1,000)
* **Mock Output Path**: 
  * 本地生成測試報告數據，未寫入 content 文件目錄以防止雜訊。
* **是否符合預期**: 是，完全符合預期。

---

### 6. 知識庫整理任務
* **Task Prompt**: `"請把本次執行結果整理成 markdown 知識庫，更新 agent 能力與任務案例。"`
* **Classifier Result**:
  * **Task Type**: `General Analytical Task`
  * **Required Capabilities**: `['kb_sync']`
  * **Difficulty**: `low`
* **Selected Route**: `COWORK` (Cowork only)
* **Excluded Agents**:
  * `GEMINI` / `CLAUDE` / `CHATGPT` / `CODEX` (因為是本地文件資料更新與任務狀態歸檔，由 Cowork 本地完成)
* **Reasoning**: 這是一個典型的知識整理與狀態存檔任務，無須耗費外部 LLM 的 API 費用。Cowork 自動將結果同步寫入本地的 `storage/knowledge_base.md` 中。
* **Token Estimate**: Input: 1,000 | Output: 200 (Total: 1,200)
* **Mock Output Path**:
  * [knowledge_base.md](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/storage/knowledge_base.md)
* **是否符合預期**: 是，完全符合預期。
