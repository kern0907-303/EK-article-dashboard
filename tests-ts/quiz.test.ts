import { QUIZZES, scoreQuiz } from "../src/data/quizzes";
let fail = 0;
for (const q of Object.values(QUIZZES)) {
  const counts: Record<string, number> = {};
  const n = q.questions.length;
  const total = Math.pow(4, n);
  for (let i = 0; i < total; i++) {
    const answers: Record<string, number> = {};
    let x = i;
    for (const question of q.questions) {
      answers[question.id] = (x % 4) % question.options.length;
      x = Math.floor(x / 4);
    }
    const r = scoreQuiz(q, answers);
    counts[r.key] = (counts[r.key] || 0) + 1;
  }
  console.log(`\n【${q.brandLabel}】窮舉 ${total} 種作答`);
  for (const res of q.results) {
    const c = counts[res.key] || 0;
    const pct = ((c / total) * 100).toFixed(1);
    const ok = c > 0;
    if (!ok) fail++;
    console.log(`  ${ok ? "✓" : "✗"} ${res.key.padEnd(18)} ${String(c).padStart(4)} 次 (${pct}%)`);
  }
}
console.log(fail === 0 ? "\n✓ 所有結果皆可達" : `\n✗ 有 ${fail} 個結果永遠不會出現`);
process.exit(fail === 0 ? 0 : 1);
