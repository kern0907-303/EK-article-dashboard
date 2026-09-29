import type { Metadata } from "next";
import LeadQuiz from "@/components/LeadQuiz";
import { QUIZZES } from "@/data/quizzes";

export const metadata: Metadata = {
  title: "五題管理情境盤點｜I8 企業醫生｜企業決策校準",
  description:
    "從組織協作、角色權責與管理節奏，整理企業反覆出現的管理情境，作為釐清優先順序的參考。",
};

export default function I8DiagnosisPage() {
  return <LeadQuiz config={QUIZZES.i8} />;
}
