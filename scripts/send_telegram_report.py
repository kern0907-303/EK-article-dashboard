#!/usr/bin/env python3
import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime

def load_dotenv():
    if os.path.exists(".env"):
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip()
                    if not os.environ.get(k) and v:
                        os.environ[k] = v

def mask_token(token):
    if not token:
        return "None"
    if len(token) <= 8:
        return "***"
    return token[:4] + "..." + token[-4:]

def send_telegram_message(token, chat_id, text):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.loads(response.read().decode('utf-8'))

def send_telegram_document(token, chat_id, filepath):
    import uuid
    boundary = '----TelegramDocBoundary' + uuid.uuid4().hex
    filename = os.path.basename(filepath)
    if not os.path.exists(filepath):
        print(f"Warning: Document {filepath} not found. Skipping.")
        return None
        
    with open(filepath, 'rb') as f:
        file_content = f.read()
        
    parts = []
    parts.append(f'--{boundary}'.encode())
    parts.append(b'Content-Disposition: form-data; name="chat_id"')
    parts.append(b'')
    parts.append(str(chat_id).encode())
    
    parts.append(f'--{boundary}'.encode())
    parts.append(b'Content-Disposition: form-data; name="document"; filename="' + filename.encode() + b'"')
    parts.append(b'Content-Type: application/octet-stream')
    parts.append(b'')
    parts.append(file_content)
    
    parts.append(f'--{boundary}--'.encode())
    parts.append(b'')
    
    body = b'\r\n'.join(parts)
    headers = {
        'Content-Type': f'multipart/form-data; boundary={boundary}',
        'Content-Length': str(len(body))
    }
    
    url = f"https://api.telegram.org/bot{token}/sendDocument"
    req = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode('utf-8'))

def main():
    load_dotenv()
    
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    send_docs = os.environ.get("TELEGRAM_SEND_DOCUMENTS", "false").lower() == "true"
    
    # Safely print status
    print(f"TELEGRAM_BOT_TOKEN: {mask_token(bot_token)}")
    print(f"TELEGRAM_CHAT_ID: {chat_id if chat_id else 'None'}")
    print(f"TELEGRAM_SEND_DOCUMENTS: {send_docs}")
    
    if not bot_token or not chat_id:
        print("TELEGRAM_SEND_FAILED: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment.")
        sys.exit(0) # Non-blocking failure
        
    today_str = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime("%Y-%m-%d")
    ops_dir = f"operations/daily/{today_str}"
    
    brief_path = os.path.join(ops_dir, "daily_morning_brief.md")
    summary_path = os.path.join(ops_dir, "run_summary.md")
    
    # 1. Read files and parse details
    status = "DAILY_RUN_FAILED"
    reason = "No run summary or brief found."
    topics = []
    drafts_count = 0
    cost_str = "$0.00"
    
    if os.path.exists(brief_path):
        with open(brief_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
        # Parse Status
        for line in lines:
            if "DAILY_RUN_CONFIRMED" in line:
                status = "DAILY_RUN_CONFIRMED"
            elif "DAILY_RUN_FAILED" in line:
                status = "DAILY_RUN_FAILED"
                
        # Parse Topics
        topic_parsing = False
        for line in lines:
            if "## 3. 今日 Top 3 建議主題" in line or "Top 3 Topics" in line:
                topic_parsing = True
                continue
            if topic_parsing and line.startswith("## "):
                topic_parsing = False
            if topic_parsing and line.strip().startswith("* **Rank"):
                parts = line.split(":", 1)
                if len(parts) > 1:
                    topics.append(parts[1].strip())
            elif topic_parsing and line.strip().startswith("* **#") or line.strip().startswith("- **#"):
                # Handle possible alternative format
                parts = line.split(":", 1)
                if len(parts) > 1:
                    topics.append(parts[1].strip())
                    
        # Parse Drafts Count
        for line in lines:
            if "pending_review" in line:
                drafts_count += 1
                
        # Parse Cost
        for line in lines:
            if "Estimated API Cost" in line or "estimated cost" in line or "今日成本" in line or "Cost" in line:
                import re
                cost_match = re.search(r'\$\s*([0-9\.]+)', line)
                if cost_match:
                    cost_str = f"${cost_match.group(1)}"
                    
    if os.path.exists(summary_path) and status == "DAILY_RUN_FAILED":
        with open(summary_path, "r", encoding="utf-8") as f:
            summary_content = f.read()
            reason_idx = summary_content.find("Errors:")
            if reason_idx != -1:
                reason = summary_content[reason_idx:].strip()
            else:
                reason = "Unknown run failure occurred."

    # 2. Format Telegram message text
    if status == "DAILY_RUN_CONFIRMED":
        msg_text = f"""<b>Brand Intelligence OS</b>
{today_str} 07:00 Daily Brief

<b>Status:</b>
DAILY_RUN_CONFIRMED

<b>Top 3 Topics:</b>
"""
        for idx, t in enumerate(topics[:3]):
            msg_text += f"{idx+1}. {t}\n"
        if not topics:
            msg_text += "1. No topics recommended\n"
            
        msg_text += f"""
<b>Drafts:</b>
{drafts_count} pending_review drafts generated

<b>Cost:</b>
{cost_str} estimated

<b>Report Folder:</b>
<code>operations/daily/{today_str}/</code>"""
    else:
        msg_text = f"""<b>Brand Intelligence OS</b>
Daily Run Failed

<b>Reason:</b>
{reason[:200]}

<b>Check:</b>
<code>operations/daily/{today_str}/run_summary.md</code>"""

    # 3. Send text message
    try:
        send_telegram_message(bot_token, chat_id, msg_text)
        print("Telegram text brief sent successfully.")
    except Exception as e:
        print(f"TELEGRAM_SEND_FAILED: Error sending message ({str(e)})")
        if os.path.exists(summary_path):
            with open(summary_path, "a", encoding="utf-8") as f:
                f.write(f"\nTelegram Text Send Error: {str(e)}\n")
        return
        
    # 4. Optionally send documents
    if status == "DAILY_RUN_CONFIRMED" and send_docs:
        docs_to_send = [
            "daily_morning_brief.md",
            "daily_intelligence_report.md",
            "recommended_topics.md",
            "draft_assets.md"
        ]
        for doc_name in docs_to_send:
            doc_path = os.path.join(ops_dir, doc_name)
            if os.path.exists(doc_path):
                try:
                    send_telegram_document(bot_token, chat_id, doc_path)
                    print(f"Telegram document {doc_name} sent successfully.")
                except Exception as e:
                    print(f"TELEGRAM_SEND_FAILED: Error sending document {doc_name} ({str(e)})")
                    if os.path.exists(summary_path):
                        with open(summary_path, "a", encoding="utf-8") as f:
                            f.write(f"\nTelegram Doc Send Error ({doc_name}): {str(e)}\n")

if __name__ == "__main__":
    main()
