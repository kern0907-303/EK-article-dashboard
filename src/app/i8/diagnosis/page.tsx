import type { Metadata } from "next";
import LeadQuiz from "@/components/LeadQuiz";
import { QUIZZES } from "@/data/quizzes";

export const metadata: Metadata = {
  title: "你的公司卡在哪一層？| I8 企業決策校準",
  description:
    "五題經營卡點自評。判斷瓶頸出在定位、組織承載力，還是決策節奏。",
};

export default function I8DiagnosisPage() {
  return <LeadQuiz config={QUIZZES.i8} />;
}
