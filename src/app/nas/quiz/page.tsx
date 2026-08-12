import type { Metadata } from "next";
import LeadQuiz from "@/components/LeadQuiz";
import { QUIZZES } from "@/data/quizzes";

export const metadata: Metadata = {
  title: "你正在用不適合自己的方式努力嗎？| NAS 生命數字",
  description:
    "三分鐘生命節奏小測。不是告訴你命運已經決定，而是幫你看懂自己慣性的思考與行動模式。",
};

export default function NasQuizPage() {
  return <LeadQuiz config={QUIZZES.nas} />;
}
