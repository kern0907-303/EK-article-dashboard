// 把衍生稿文字拆成「可以分別複製貼上」的片段。純函式，方便測試。

const THREAD_SINGLE = /^單則版\s*[：:]\s*(.*)$/;
const THREAD_ITEM = /^串文第\s*\d+\s*則\s*[：:]\s*(.*)$/;
const IG_CAPTION = /^說明文字\s*[：:]\s*(.*)$/;
const IG_TAGS = /^標籤\s*[：:]\s*(.*)$/;
const NEXT_BLOCK = /^(?:單則版|串文第|說明文字|標籤|第\s*\d+\s*張|【需補)/;

function collect(content, matchers) {
  const found = [];
  let current = null;
  for (const raw of String(content).split(/\r?\n/)) {
    const line = raw.trim();
    const hit = matchers.map((m) => ({ m, r: line.match(m.pattern) })).find((x) => x.r);
    if (hit) { current = { kind: hit.m.kind, text: hit.r[1].trim() }; found.push(current); continue; }
    if (!current || !line) continue;
    if (NEXT_BLOCK.test(line)) { current = null; continue; }
    current.text = `${current.text}\n${line}`.trim();
  }
  return found.filter((item) => item.text);
}

/** Threads：回傳 [{ label, text }]，第一個是單則版，後面是串文每一則 */
export function parseThreadParts(content = "") {
  const items = collect(content, [{ kind: "single", pattern: THREAD_SINGLE }, { kind: "thread", pattern: THREAD_ITEM }]);
  let n = 0;
  return items.map((item) => item.kind === "single" ? { label: "單則版", text: item.text } : { label: `串文第 ${++n} 則`, text: item.text });
}

/** IG：回傳 { caption, tags }，tags 為不含 # 的陣列 */
export function parseIgParts(content = "") {
  const items = collect(content, [{ kind: "caption", pattern: IG_CAPTION }, { kind: "tags", pattern: IG_TAGS }]);
  const caption = items.find((item) => item.kind === "caption")?.text || "";
  const tagText = items.find((item) => item.kind === "tags")?.text || "";
  const tags = tagText.split(/[、,，\s]+/).map((tag) => tag.replace(/^#+/, "").trim()).filter(Boolean);
  return { caption, tags };
}

/** IG 說明文字加上標籤，可直接貼到 IG */
export function igCaptionWithTags(content = "") {
  const { caption, tags } = parseIgParts(content);
  if (!caption) return "";
  return tags.length ? `${caption}\n\n${tags.map((tag) => `#${tag}`).join(" ")}` : caption;
}
