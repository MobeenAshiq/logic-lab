"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  ExternalLink,
  GraduationCap,
  Loader2,
  Play,
  Upload,
  Users,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { JitsiEmbed } from "@/components/live/jitsi-embed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import type { AdminCourseTree, LiveSessionDetail } from "@/types/api";

export default function MentorLiveSessionDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const qc = useQueryClient();
  const initialTab = searchParams?.get("tab") || "room";
  const [tab, setTab] = useState(initialTab);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Lesson publishing form state
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonNotes, setLessonNotes] = useState("");

  const { data: session, isLoading, refetch } = useQuery({
    queryKey: ["mentor-live-session", id],
    queryFn: () => api<LiveSessionDetail>(`/teach/live-sessions/${id}`),
  });

  // Load course details to get modules for lesson publishing
  const { data: courseTree } = useQuery({
    queryKey: ["course-tree", session?.course?.id],
    queryFn: () => api<AdminCourseTree>(`/admin/content/courses/${session!.course.id}`),
    enabled: Boolean(session?.course?.id),
  });

  // Upload recording file to R2
  const handleRecordingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["video/mp4", "video/webm"].includes(file.type)) {
      toast.error("Please upload an MP4 or WebM video file.");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(10);

      // 1. Get presigned upload URL
      const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>(
        `/teach/live-sessions/${id}/recording-url`,
        {
          method: "POST",
          body: { contentType: file.type, size: file.size },
        },
      );

      setUploadProgress(40);

      // 2. Upload file to R2
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!res.ok) throw new Error("Upload to storage failed");
      setUploadProgress(80);

      // 3. Complete recording on backend
      await api(`/teach/live-sessions/${id}/recording-complete`, {
        method: "POST",
        body: { key },
      });

      setUploadProgress(100);
      toast.success("Recording uploaded successfully!");
      qc.invalidateQueries({ queryKey: ["mentor-live-session", id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload recording.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Publish as lesson mutation
  const publishLessonMutation = useMutation({
    mutationFn: (body: { moduleId: string; title?: string; notes?: string }) =>
      api(`/teach/live-sessions/${id}/publish-as-lesson`, {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      toast.success("Recording published as course lesson!");
      qc.invalidateQueries({ queryKey: ["course-tree", session?.course?.id] });
      setLessonTitle("");
      setLessonNotes("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to publish lesson");
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Live session not found.</p>
        <Button asChild className="mt-4" variant="outline" size="sm">
          <Link href="/mentor/live">Back to Live Classes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="size-8">
            <Link href="/mentor/live">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{session.course.title}</Badge>
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Clock className="size-3" />
                {session.durationMinutes} min
              </Badge>
            </div>
            <h1 className="text-xl font-bold mt-1">{session.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {new Date(session.startsAt).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="room" className="text-xs gap-1.5">
            <Video className="size-3.5" />
            Classroom Video
          </TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs gap-1.5">
            <Users className="size-3.5" />
            Attendance ({session.attendance?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="recording" className="text-xs gap-1.5">
            <Upload className="size-3.5" />
            Recording & Lesson
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Live Video Classroom */}
        <TabsContent value="room" className="space-y-4">
          {session.roomName ? (
            <JitsiEmbed
              roomName={session.roomName}
              displayName={session.mentor.fullName || "Mentor"}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Room not configured.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Attendance Records with Join & Leave Times */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader className="py-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{t.live.attendanceTab}</CardTitle>
                  <CardDescription>
                    Real-time attendance record tracking student join and leave times.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="gap-1 font-bold">
                  <Users className="size-3.5" />
                  {session.attendance?.length ?? 0} Students
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!session.attendance || session.attendance.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  {t.live.noAttendance}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>{t.live.studentName}</TableHead>
                      <TableHead>{t.live.email}</TableHead>
                      <TableHead>{t.live.joinedAt}</TableHead>
                      <TableHead>{t.live.leftAt}</TableHead>
                      <TableHead className="text-right">{t.live.durationMinutes}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {session.attendance.map((record) => (
                      <TableRow key={record.id} className="text-xs">
                        <TableCell className="font-medium flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarImage src={record.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-[10px]">
                              {record.fullName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {record.fullName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.email}
                        </TableCell>
                        <TableCell>
                          {new Date(record.joinedAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          {record.leftAt ? (
                            new Date(record.leftAt).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                              second: "2-digit",
                            })
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5">
                              Still in room
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {record.durationMinutes !== null
                            ? `${record.durationMinutes} min`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Upload Recording & Publish as Lesson */}
        <TabsContent value="recording" className="space-y-6">
          {/* Recording Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.live.uploadRecording}</CardTitle>
              <CardDescription>{t.live.uploadDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleRecordingUpload}
                accept="video/mp4,video/webm"
                className="hidden"
              />

              {session.recordingUrl ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    <CheckCircle className="size-4" />
                    Recording uploaded to R2 storage
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" asChild className="text-xs gap-1.5">
                      <a href={session.recordingUrl} target="_blank" rel="noopener noreferrer">
                        <Play className="size-3.5 fill-current" />
                        Preview Recording
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="text-xs"
                    >
                      Replace
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {uploading ? `Uploading (${uploadProgress}%)...` : "Select Video File (MP4/WebM)"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Publish as Lesson Form */}
          <Card className={cn(!session.recordingKey && "opacity-60 pointer-events-none")}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="size-5 text-primary" />
                {t.live.publishLesson}
              </CardTitle>
              <CardDescription>
                Convert this recorded live session into a course lesson so future students can learn from it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedModuleId) {
                    toast.error("Please select a module.");
                    return;
                  }
                  publishLessonMutation.mutate({
                    moduleId: selectedModuleId,
                    title: lessonTitle.trim() || undefined,
                    notes: lessonNotes.trim() || undefined,
                  });
                }}
                className="space-y-4 max-w-lg"
              >
                <div className="space-y-1.5">
                  <Label>{t.live.selectModule}</Label>
                  <Select
                    value={selectedModuleId}
                    onValueChange={setSelectedModuleId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose module in this course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courseTree?.modules?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t.live.lessonTitle}</Label>
                  <Input
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                    placeholder={session.title}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Notes & Resources (Optional)</Label>
                  <Textarea
                    value={lessonNotes}
                    onChange={(e) => setLessonNotes(e.target.value)}
                    placeholder="Key takeaways, links mentioned in class..."
                    rows={3}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={publishLessonMutation.isPending || !session.recordingKey}
                  className="gap-2"
                >
                  {publishLessonMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Publish Recording to Course
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
