import { usePathname } from "next/navigation";

/** The course editor is shared by admins (/admin/content) and mentors (/mentor/content). */
export function useEditorPortal() {
  const isMentor = usePathname().startsWith("/mentor");
  return {
    isMentor,
    pages: isMentor ? "/mentor/content" : "/admin/content",
    home: isMentor ? "/mentor" : "/admin/content",
    bankHref: (courseId: string) =>
      isMentor ? `/mentor/courses/${courseId}/questions` : `/admin/content/courses/${courseId}/questions`,
  };
}
