import type { Metadata } from "next";
import LeadQuiz from "@/components/LeadQuiz";
import { QUIZZES } from "@/data/quizzes";

export const metadata: Metadata = {
  title: "你的狀態，已經撐了多久？| ABL 狀態調和",
  description:
    "五題狀態自我檢視。不是給你更多方法，而是先看清楚目前的消耗來自哪裡。",
};

export default function AblCheckPage() {
  return <LeadQuiz config={QUIZZES.abl} />;
}
