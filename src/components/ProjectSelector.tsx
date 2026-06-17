"use client";

import React, { useState, useEffect } from "react";
import { 
  ChevronDown, Settings, Plus, RefreshCw, Check, 
  Loader2, AlertCircle, HelpCircle, ExternalLink, Sheet, Folder 
} from "lucide-react";
import { saveWorkspace } from "@/lib/firebase";

export interface ProjectData {
  id: string;
  name: string;
  guidelines: string;
  social_copy?: string;
  web_architecture?: string;
  seo_keywords?: any;
  ad_data?: any;
  aeo_schema?: string;
  aeo_faq?: string;
}

interface ProjectSelectorProps {
  activeProjectId: string | null;
  onChangeProject: (projectId: string) => void;
}

const APPS_SCRIPT_TEMPLATE = `function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var data = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var item = {};
    for (var j = 0; j < headers.length; j++) {
      item[headers[j]] = row[j];
    }
    data.push(item);
  }
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var params = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  
  // 欄位標題定義
  var targetHeaders = ['id', 'name', 'guidelines', 'social_copy', 'web_architecture', 'seo_keywords', 'ad_data', 'aeo_schema', 'aeo_faq'];
  
  var idIndex = headers.indexOf('id');
  if (idIndex === -1) {
    headers = targetHeaders;
    sheet.clear();
    sheet.appendRow(headers);
    idIndex = 0;
  }
  
  var projectId = params.id;
  var rowIndex = -1;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][idIndex] === projectId) {
      rowIndex = i + 1; // 加上標題行並轉為 1-indexed
      break;
    }
  }
  
  var rowData = [];
  for (var j = 0; j < headers.length; j++) {
    var key = headers[j];
    var val = params[key] !== undefined ? params[key] : '';
    if (typeof val === 'object') {
      val = JSON.stringify(val);
    }
    rowData.push(val);
  }
  
  if (rowIndex > -1) {
    for (var k = 0; k < rowData.length; k++) {
      sheet.getRange(rowIndex, k + 1).setValue(rowData[k]);
    }
  } else {
    sheet.appendRow(rowData);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

export default function ProjectSelector({ activeProjectId, onChangeProject }: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [scriptUrl, setScriptUrl] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  
  // 新專案表單狀態
  const [newProjId, setNewProjId] = useState("");
  const [newProjName, setNewProjName] = useState("");
  const [newProjGuidelines, setNewProjGuidelines] = useState("");

  // 狀態通知
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // 1. 初始化讀取設定與專案
  useEffect(() => {
    const savedUrl = localStorage.getItem("google_sheets_apps_script_url") || "";
    setScriptUrl(savedUrl);

    // 載入本地快取的專案清單
    const savedProjects = localStorage.getItem("google_sheets_projects");
    if (savedProjects) {
      try {
        setProjects(JSON.parse(savedProjects));
      } catch (e) {
        console.error("Failed to parse projects cache", e);
      }
    }
  }, []);

  // 2. 當專案載入/更新時重新整理 LocalStorage
  const updateProjectsList = (newList: ProjectData[]) => {
    setProjects(newList);
    localStorage.setItem("google_sheets_projects", JSON.stringify(newList));
  };

  // 3. 從試算表同步資料
  const syncFromSheets = async (targetUrl = scriptUrl) => {
    if (!targetUrl.trim()) {
      setSyncStatus("error");
      setStatusMessage("請先設定 Google Apps Script Web App URL！");
      return;
    }

    setIsLoading(true);
    setSyncStatus("idle");
    setStatusMessage("");

    try {
      const response = await fetch(`/api/projects?url=${encodeURIComponent(targetUrl)}`);
      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "同步失敗");
      }

      const list: ProjectData[] = resData.data || [];
      
      // 過濾並確保 ID 格式正確，專案 ID 強制 project_ 前綴
      const formattedList = list.map((item) => {
        let cleanId = item.id;
        if (!cleanId.startsWith("project_")) {
          cleanId = `project_${cleanId}`;
        }
        return {
          ...item,
          id: cleanId,
        };
      });

      updateProjectsList(formattedList);
      setSyncStatus("success");
      setStatusMessage(`同步成功！已載入 ${formattedList.length} 個專案。`);

      // 如果當前有選中的專案，將其數據同步到 LocalStorage/Firebase 工作區
      if (activeProjectId) {
        const activeProj = formattedList.find(p => p.id === activeProjectId);
        if (activeProj) {
          syncProjectToWorkspace(activeProj);
        }
      } else if (formattedList.length > 0) {
        // 預設選擇第一個
        onChangeProject(formattedList[0].id);
        syncProjectToWorkspace(formattedList[0]);
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      setSyncStatus("error");
      setStatusMessage(`同步失敗: ${err.message || "請檢查網址或試算表設定"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. 將特定專案寫入 LocalStorage / Firebase 做為工作區當前內容
  const syncProjectToWorkspace = async (proj: ProjectData) => {
    let keywords = [];
    try {
      if (proj.seo_keywords) {
        keywords = typeof proj.seo_keywords === "string" 
          ? JSON.parse(proj.seo_keywords) 
          : proj.seo_keywords;
      }
    } catch (e) {}

    let adData = [];
    try {
      if (proj.ad_data) {
        adData = typeof proj.ad_data === "string" 
          ? JSON.parse(proj.ad_data) 
          : proj.ad_data;
      }
    } catch (e) {}

    await saveWorkspace(proj.id, {
      brand_guidelines: proj.guidelines || "",
      social_copy: proj.social_copy || "",
      web_architecture: proj.web_architecture || "",
      seo_keywords: keywords,
      ad_data: adData,
      aeo_schema: proj.aeo_schema || "",
      aeo_faq: proj.aeo_faq || ""
    });
  };

  // 5. 測試連線
  const handleTestConnection = async () => {
    if (!scriptUrl.trim()) {
      alert("請輸入 Web App URL");
      return;
    }
    await syncFromSheets(scriptUrl);
  };

  // 6. 儲存 API 網址設定
  const handleSaveSettings = () => {
    localStorage.setItem("google_sheets_apps_script_url", scriptUrl.trim());
    setStatusMessage("設定已儲存！");
    setSyncStatus("success");
    // 儲存後自動進行同步
    syncFromSheets(scriptUrl.trim());
  };

  // 7. 新增階段專案
  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjId.trim() || !newProjName.trim() || !newProjGuidelines.trim()) {
      alert("請填寫所有必要欄位");
      return;
    }

    const cleanId = `project_${newProjId.trim().replace(/[^a-zA-Z0-9_-]/g, "")}`;

    // 檢查 ID 重複
    if (projects.some(p => p.id === cleanId)) {
      alert("專案 ID 已存在，請使用不同的英文代碼！");
      return;
    }

    const newProject: ProjectData = {
      id: cleanId,
      name: newProjName.trim(),
      guidelines: newProjGuidelines.trim(),
      social_copy: `【${newProjName.trim()}】專案文案生成中...\n請在左側與 Erick 營運長對話下達任務指令！`,
      web_architecture: `- 網頁架構規劃中`,
      seo_keywords: [],
      ad_data: [],
      aeo_schema: "",
      aeo_faq: ""
    };

    setIsLoading(true);

    try {
      // 1. 同步到工作區
      await syncProjectToWorkspace(newProject);

      // 2. 更新本地快取清單
      const updatedList = [...projects, newProject];
      updateProjectsList(updatedList);

      // 3. 如果設定了 Google Sheet URL，同步推送到試算表
      const savedUrl = localStorage.getItem("google_sheets_apps_script_url");
      if (savedUrl) {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: savedUrl,
            project: {
              ...newProject,
              seo_keywords: JSON.stringify([]),
              ad_data: JSON.stringify([])
            }
          })
        });
        const resData = await response.json();
        if (!response.ok || !resData.success) {
          console.warn("Could not sync new project to sheet immediately:", resData.error);
        }
      }

      // 4. 重置表單並切換專案
      setNewProjId("");
      setNewProjName("");
      setNewProjGuidelines("");
      setShowAddForm(false);
      onChangeProject(cleanId);
      
      alert(`🎉 專案【${newProject.name}】建立成功！`);
    } catch (err: any) {
      console.error(err);
      alert(`建立專案時發生錯誤: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
    alert("📋 Apps Script 程式碼已複製！");
  };

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="relative w-full space-y-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
            切換執行專案 (階段性)
          </label>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowSettings(false);
                setShowAddForm(!showAddForm);
              }}
              title="新增專案"
              className="p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setShowSettings(!showSettings);
              }}
              title="試算表設定"
              className="p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => syncFromSheets()}
              disabled={isLoading}
              title="從試算表同步"
              className="p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Dropdown Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-amber-500/20 bg-slate-900/60 hover:bg-slate-800/80 transition-all duration-300 backdrop-blur-md cursor-pointer"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-100 text-sm leading-tight">
                {activeProject ? activeProject.name : "請選擇執行專案"}
              </h4>
              <p className="text-xs text-slate-400 truncate max-w-[150px]">
                {activeProject ? activeProject.id.replace("project_", "") : "尚未選取任何專案"}
              </p>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown List */}
        {isOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
            <ul className="absolute left-0 right-0 mt-2 bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl z-40 backdrop-blur-xl overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
              {projects.length === 0 ? (
                <li className="px-4 py-3 text-xs text-slate-500 text-center font-medium">
                  尚未建立任何專案。點選右上角 + 按鈕新增，或設定試算表同步。
                </li>
              ) : (
                projects.map((proj) => {
                  const isSelected = proj.id === activeProjectId;
                  return (
                    <li key={proj.id}>
                      <button
                        onClick={() => {
                          onChangeProject(proj.id);
                          syncProjectToWorkspace(proj);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/60 transition-colors text-left cursor-pointer ${
                          isSelected ? "bg-slate-800/40" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-md ${isSelected ? "bg-amber-500/10 text-amber-400" : "bg-slate-800 text-slate-400"}`}>
                            <Folder className="w-4 h-4" />
                          </div>
                          <div>
                            <span className={`text-sm font-semibold block ${isSelected ? "text-slate-100" : "text-slate-300"}`}>
                              {proj.name}
                            </span>
                            <span className="text-xs text-slate-500 block truncate max-w-[200px]">
                              {proj.guidelines}
                            </span>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </>
        )}
      </div>

      {/* 試算表設定面板 */}
      {showSettings && (
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-md space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sheet className="w-4 h-4 text-emerald-400" />
              Google Sheets 同步設定
            </span>
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-bold"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              設定教學
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-400 block">
              Google Apps Script Web App URL
            </label>
            <input
              type="url"
              value={scriptUrl}
              onChange={(e) => setScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3 py-2 text-xs bg-slate-950/80 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500/40"
            />
          </div>

          {statusMessage && (
            <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 font-medium ${
              syncStatus === "success" 
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                : "bg-rose-500/10 text-rose-400 border border-rose-500/25"
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSaveSettings}
              disabled={isLoading}
              className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "儲存並同步"}
            </button>
            <button
              onClick={handleTestConnection}
              disabled={isLoading}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg cursor-pointer transition-colors border border-slate-700"
            >
              測試連線
            </button>
          </div>

          {/* 教學說明 */}
          {showInstructions && (
            <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-lg space-y-3 text-[11px] text-slate-400 max-h-[300px] overflow-y-auto leading-relaxed">
              <h5 className="font-extrabold text-slate-200 text-xs">🛠 試算表後台架設步驟：</h5>
              <ol className="list-decimal list-inside space-y-2">
                <li>
                  建立一個新的 Google 試算表，在第一行建立以下 9 個欄位標題：
                  <div className="p-1.5 bg-slate-900 border border-slate-850 rounded mt-1 overflow-x-auto whitespace-nowrap text-[9px] text-emerald-400 font-mono">
                    id, name, guidelines, social_copy, web_architecture, seo_keywords, ad_data, aeo_schema, aeo_faq
                  </div>
                </li>
                <li>
                  點選試算表選單的 **「延伸功能」 ➔ 「Apps Script」**。
                </li>
                <li>
                  將預設程式碼全部清空，並貼上點選下方按鈕複製的程式碼：
                  <button
                    onClick={handleCopyCode}
                    className="mt-1.5 w-full py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    複製 Apps Script 程式碼
                  </button>
                </li>
                <li>
                  點選上方儲存圖示，點選右上角 **「部署」 ➔ 「新建部署」**。
                </li>
                <li>
                  選取類型為 **「網頁應用程式」** (Web App)。
                </li>
                <li>
                  設定為：執行身分：**「我」**，誰有權限存取：**「所有人」**。
                </li>
                <li>
                  點選「部署」➔ 進行帳號權限授權 ➔ 複製產生的「網頁應用程式 URL」➔ 貼回本設定框中儲存。
                </li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* 新增專案表單 */}
      {showAddForm && (
        <form
          onSubmit={handleAddProject}
          className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-md space-y-3 animate-in fade-in slide-in-from-top-1 duration-200"
        >
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-amber-400" />
            建立全新執行專案
          </span>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 block">專案英文代碼 (ID, 僅限英文底線)</label>
            <input
              type="text"
              required
              value={newProjId}
              onChange={(e) => setNewProjId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              placeholder="e.g. project_618_campaign"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500/40"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 block">專案名稱 (顯示名稱)</label>
            <input
              type="text"
              required
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              placeholder="e.g. 618年中促銷文案專案"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500/40"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 block">專案定位、主題與調性 (做成 Skill / 指令)</label>
            <textarea
              required
              rows={4}
              value={newProjGuidelines}
              onChange={(e) => setNewProjGuidelines(e.target.value)}
              placeholder="請填入此專案的背景、主要受眾、品牌調性與文案規範... (本內容將直接成為 AI 的系統決策 Skill 規範)"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500/40 resize-none leading-relaxed"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "確認建立專案"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg cursor-pointer transition-colors border border-slate-700"
            >
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
