"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared";
import { QuestionBank } from "@/components/teaching/question-bank";
import { t } from "@/lib/i18n";

export default function MentorQuestionBankPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <Link
        href="/mentor"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t.teaching.bank.back}
      </Link>
      <PageHeader title={t.teaching.bank.title} description={t.teaching.bank.subtitle} />
      <QuestionBank courseId={id} />
    </>
  );
}
