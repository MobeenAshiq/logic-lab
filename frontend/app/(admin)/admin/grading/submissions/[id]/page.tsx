"use client";

import { useParams } from "next/navigation";
import { SubmissionGrader } from "@/components/grading/submission-grader";

export default function GradeSubmissionPage() {
  const { id } = useParams<{ id: string }>();
  return <SubmissionGrader submissionId={id} backHref="/admin/grading" />;
}
