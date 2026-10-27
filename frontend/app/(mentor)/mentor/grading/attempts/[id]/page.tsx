"use client";

import { useParams } from "next/navigation";
import { AttemptGrader } from "@/components/grading/attempt-grader";

export default function GradeAttemptPage() {
  const { id } = useParams<{ id: string }>();
  return <AttemptGrader attemptId={id} backHref="/mentor/grading" />;
}
