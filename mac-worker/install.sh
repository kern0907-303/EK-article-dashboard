#!/bin/bash
# 在 Mac mini 的「終端機」執行一次：bash install.sh
# 做的事：安裝套件 → 檢查 .env → 設成開機自動啟動（掛掉會自動重開）。
set -e
cd "$(dirname "$0")"
DIR="$(pwd)"
NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then echo "找不到 Node.js，請先安裝（https://nodejs.org，選 LTS 版本），再重跑這個檔案。"; exit 1; fi
echo "使用 Node：$NODE（$($NODE -v)）"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "已建立 .env，請用文字編輯器打開 $DIR/.env 填入 Supabase 網址與金鑰，存檔後再執行一次 bash install.sh"
  exit 1
fi
"$(dirname "$NODE")/npm" install --omit=dev
PLIST="$HOME/Library/LaunchAgents/com.ek.imageworker.plist"
mkdir -p "$HOME/Library/LaunchAgents"
sed -e "s#__NODE__#$NODE#g" -e "s#__DIR__#$DIR#g" com.ek.imageworker.plist.template > "$PLIST"
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "完成。小程式已啟動，開機會自動執行。看運作紀錄：tail -f \"$DIR/worker.log\""
echo "要停止：launchctl bootout gui/$(id -u) \"$PLIST\""
