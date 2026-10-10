// 衍生稿也要套用文體檢查的「禁用詞」：與 Facebook 發佈前的檢查用同一份清單，避免改寫後反而漏掉。
import { FORBIDDEN_WORDS } from "@/lib/genre-check";

export function genreBlockers(content: string): string[] {
  const hits = FORBIDDEN_WORDS.filter((word) => content.includes(word));
  return hits.length ? [`文體禁用詞：${hits.join("、")}，請改寫後才能標為可用`] : [];
}
