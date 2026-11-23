"use client";

import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingRows } from "@/components/shared";
import { PythonNotebook } from "@/components/challenges/python-notebook";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import type { StudentBilling } from "@/types/api";

export default function PythonNotebookPage() {
  const billing = useQuery({ queryKey: ["student-billing"], queryFn: () => api<StudentBilling>("/student/billing") });
  if (billing.isError) return <ErrorState error={billing.error} onRetry={() => void billing.refetch()} />;
  if (!billing.data) return <LoadingRows rows={3} />;
  // Runs in the browser, so any student with a plan or a course in its free period can use it.
  if (!billing.data.hasAccess) return <Card><CardContent className="p-8 text-center"><h1 className="font-semibold">Start a course to use the notebook</h1><p className="text-muted-foreground mt-1 text-sm">Open any course (the first 14 days are free) to unlock the Python notebook.</p></CardContent></Card>;
  return <PythonNotebook />;
}
