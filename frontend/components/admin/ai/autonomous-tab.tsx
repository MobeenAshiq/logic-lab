"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  FileCode2,
  GraduationCap,
  HelpCircle,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  ErrorState,
  LoadingRows,
  StatCard,
  StatusBadge,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import type {
  AutonomousArticleDetail,
  AutonomousArticleSummary,
  AutonomousContentStats,
} from "@/lib/ai-mentor";

const STATS_KEY = ["admin", "autonomous", "stats"] as const;
const ARTICLES_KEY = ["admin", "autonomous", "articles"] as const;

export function AutonomousTab() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editArticleId, setEditArticleId] = useState<string | null>(null);

  // Form state for generator
  const [targetStack, setTargetStack] = useState("fullstack");
  const [customTopic, setCustomTopic] = useState("");
  const [dayIndexInput, setDayIndexInput] = useState<string>("");
  const [autoPublishGen, setAutoPublishGen] = useState(false);

  // Stats query
  const statsQuery = useQuery({
    queryKey: STATS_KEY,
    queryFn: () => api<AutonomousContentStats>("/admin/autonomous/stats"),
  });

  // Articles query
  const articlesQuery = useQuery({
    queryKey: [...ARTICLES_KEY, filterStatus],
    queryFn: () =>
      api<{ total: number; articles: AutonomousArticleSummary[] }>(
        "/admin/autonomous/articles",
        {
          query: {
            limit: 50,
            ...(filterStatus !== "all" ? { status: filterStatus } : {}),
          },
        },
      ),
  });

  // Mutation: Trigger Generation
  const generateMutation = useMutation({
    mutationFn: () =>
      api<AutonomousArticleDetail>("/admin/autonomous/generate", {
        method: "POST",
        body: {
          targetStack,
          customTopic: customTopic.trim() || undefined,
          dayIndex: dayIndexInput ? parseInt(dayIndexInput, 10) : undefined,
          autoPublish: autoPublishGen,
        },
      }),
    onSuccess: (data) => {
      toast.success(`Day ${data.dayIndex} generated successfully!`);
      setGenerateOpen(false);
      setCustomTopic("");
      setDayIndexInput("");
      void queryClient.invalidateQueries({ queryKey: STATS_KEY });
      void queryClient.invalidateQueries({ queryKey: ARTICLES_KEY });
      setEditArticleId(data.id);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to generate daily content.";
      toast.error(msg);
    },
  });

  // Mutation: Toggle Publish
  const togglePublishMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "draft" | "published" }) =>
      api(`/admin/autonomous/articles/${id}`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: () => {
      toast.success("Article status updated.");
      void queryClient.invalidateQueries({ queryKey: STATS_KEY });
      void queryClient.invalidateQueries({ queryKey: ARTICLES_KEY });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to update article status.";
      toast.error(msg);
    },
  });

  // Mutation: Delete Article
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/autonomous/articles/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Daily article deleted.");
      if (editArticleId) setEditArticleId(null);
      void queryClient.invalidateQueries({ queryKey: STATS_KEY });
      void queryClient.invalidateQueries({ queryKey: ARTICLES_KEY });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to delete article.";
      toast.error(msg);
    },
  });

  // Mutation: Update Settings
  const updateSettingsMutation = useMutation({
    mutationFn: (settings: { autoPublish?: boolean; enabled?: boolean }) =>
      api("/admin/autonomous/settings", {
        method: "PATCH",
        body: settings,
      }),
    onSuccess: () => {
      toast.success("Engine settings updated.");
      void queryClient.invalidateQueries({ queryKey: STATS_KEY });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to update settings.";
      toast.error(msg);
    },
  });

  const stats = statsQuery.data;
  const articles = articlesQuery.data?.articles ?? [];

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      {statsQuery.isLoading ? (
        <LoadingRows rows={2} />
      ) : statsQuery.isError ? (
        <ErrorState error={statsQuery.error} onRetry={() => void statsQuery.refetch()} />
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            icon={BookOpen}
            label="Published Lessons"
            value={stats.publishedCount.toString()}
          />
          <StatCard
            icon={FileCode2}
            label="Pending Drafts"
            value={stats.draftCount.toString()}
          />
          <StatCard
            icon={GraduationCap}
            label="Student Submissions"
            value={stats.submissionsCount.toString()}
          />
          <StatCard
            icon={Sparkles}
            label="Average Score"
            value={`${stats.averageScore}%`}
          />
          <StatCard
            icon={Users}
            label="Active Streaks (7d)"
            value={stats.activeStudentsLast7Days.toString()}
          />
        </div>
      ) : null}

      {/* Autonomous Schedule Control & Auto-Publish Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> Autonomous Daily Content Engine
              </CardTitle>
              <CardDescription>
                AI runs nightly at 00:00 UTC to produce lessons, 5-question quizzes, and coding assignments.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void statsQuery.refetch();
                  void articlesQuery.refetch();
                }}
              >
                <RefreshCw className="mr-1.5 size-3.5" /> Refresh
              </Button>
              <Button size="sm" onClick={() => setGenerateOpen(true)}>
                <Plus className="mr-1.5 size-4" /> Generate Day with AI
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-3">
              <Switch
                id="auto-publish"
                checked={stats?.config.autoPublish ?? false}
                onCheckedChange={(checked) =>
                  updateSettingsMutation.mutate({ autoPublish: checked })
                }
              />
              <Label htmlFor="auto-publish" className="cursor-pointer font-medium">
                Auto-Publish mode:{" "}
                <span className="text-muted-foreground font-normal">
                  {stats?.config.autoPublish
                    ? "New lessons go live immediately to students"
                    : "Saved as Drafts for your review & approval before publishing"}
                </span>
              </Label>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3.5" /> Cron runs at midnight UTC (Pakistan: 05:00 AM)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Articles Management Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Curriculum Lessons &amp; Challenges</CardTitle>
              <CardDescription>
                Progressing from layman fundamentals (Day 1-7) to OOP (Day 8-30) and Advanced Systems &amp; DSA (Day 31+)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Drafts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {articlesQuery.isLoading ? (
            <div className="p-6">
              <LoadingRows rows={5} />
            </div>
          ) : articlesQuery.isError ? (
            <div className="p-6">
              <ErrorState error={articlesQuery.error} onRetry={() => void articlesQuery.refetch()} />
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Sparkles className="size-10 text-muted-foreground mb-3" />
              <p className="font-medium text-foreground">No daily lessons generated yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Click &ldquo;Generate Day with AI&rdquo; or wait for the midnight cron worker to build Day 1.
              </p>
              <Button size="sm" className="mt-4" onClick={() => setGenerateOpen(true)}>
                <Plus className="mr-1.5 size-4" /> Generate Day 1 Now
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Day</TableHead>
                  <TableHead>Lesson Title</TableHead>
                  <TableHead>Track / Stack</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-semibold text-primary">
                      Day {item.dayIndex}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground line-clamp-1">
                        {item.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.moduleName} • Week {item.weekNumber}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">
                        {item.targetStack}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={item.status === "published" ? "success" : "neutral"}
                      >
                        {item.status === "published" ? "Published" : "Draft"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <HelpCircle className="size-3 text-primary" /> {item.quizQuestionsCount} questions
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <GraduationCap className="size-3 text-primary" /> {item.assignmentSubmissionsCount} submissions
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setEditArticleId(item.id)}
                        title="Preview & Edit"
                      >
                        <Eye className="size-3.5 mr-1" /> View / Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() =>
                          togglePublishMutation.mutate({
                            id: item.id,
                            status: item.status === "published" ? "draft" : "published",
                          })
                        }
                      >
                        {item.status === "published" ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Delete Day ${item.dayIndex} article?`)) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Generate Next Day with AI */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Generate Curriculum Day
            </DialogTitle>
            <DialogDescription>
              Prompt Gemini 1.5 Flash / Groq to write a complete lesson, 5-question quiz, and coding assignment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="day-num">Day Number (Optional)</Label>
              <Input
                id="day-num"
                type="number"
                placeholder="Leave blank for next chronological day"
                value={dayIndexInput}
                onChange={(e) => setDayIndexInput(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="target-stack">Target Tech Stack</Label>
              <Select value={targetStack} onValueChange={setTargetStack}>
                <SelectTrigger id="target-stack">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fullstack">Full-Stack (Node.js &amp; Next.js)</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="cpp">C++</SelectItem>
                  <SelectItem value="dsa">DSA &amp; Systems Architecture</SelectItem>
                  <SelectItem value="general">Language Agnostic / Fundamentals</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="custom-topic">Custom Topic / Focus (Optional)</Label>
              <Input
                id="custom-topic"
                placeholder="e.g. Hash Maps & Collisions, YOLOv8 Vision, WebSockets..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                If omitted, the engine automatically follows the curated Layman-to-Senior progression.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="auto-pub" className="text-sm font-medium">
                  Publish immediately
                </Label>
                <p className="text-xs text-muted-foreground">
                  Make it visible to students right away without remaining in draft.
                </p>
              </div>
              <Switch
                id="auto-pub"
                checked={autoPublishGen}
                onCheckedChange={setAutoPublishGen}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 size-4" /> Generate with AI
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Preview & Edit Article Detail */}
      {editArticleId && (
        <ArticleDetailModal
          articleId={editArticleId}
          open={!!editArticleId}
          onClose={() => setEditArticleId(null)}
          onUpdated={() => {
            void queryClient.invalidateQueries({ queryKey: STATS_KEY });
            void queryClient.invalidateQueries({ queryKey: ARTICLES_KEY });
            void queryClient.invalidateQueries({
              queryKey: ["admin", "autonomous", "article", editArticleId],
            });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Article Detail & Editor Modal Component
// ---------------------------------------------------------------------------
function ArticleDetailModal({
  articleId,
  open,
  onClose,
  onUpdated,
}: {
  articleId: string;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const query = useQuery({
    queryKey: ["admin", "autonomous", "article", articleId],
    queryFn: () =>
      api<AutonomousArticleDetail>(`/admin/autonomous/articles/${articleId}`),
  });

  const [tab, setTab] = useState<"article" | "quiz" | "assignment" | "submissions">("article");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  if (query.data && !isInitialized) {
    setTitle(query.data.title);
    setContent(query.data.markdownContent);
    setIsInitialized(true);
  }

  const updateMutation = useMutation({
    mutationFn: (data: { title?: string; markdownContent?: string; status?: "draft" | "published" }) =>
      api(`/admin/autonomous/articles/${articleId}`, {
        method: "PATCH",
        body: data,
      }),
    onSuccess: () => {
      toast.success("Saved changes successfully.");
      onUpdated();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to update article.";
      toast.error(msg);
    },
  });

  const data = query.data;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <BookOpen className="size-5 text-primary" />
                {data ? `Day ${data.dayIndex}: ${data.title}` : "Loading..."}
              </DialogTitle>
              {data && (
                <DialogDescription>
                  {data.module.moduleName} • Week {data.module.weekNumber} •{" "}
                  <StatusBadge
                    tone={data.status === "published" ? "success" : "neutral"}
                  >
                    {data.status === "published" ? "Published" : "Draft"}
                  </StatusBadge>
                </DialogDescription>
              )}
            </div>
            {data && (
              <Button
                variant={data.status === "published" ? "outline" : "default"}
                size="sm"
                onClick={() =>
                  updateMutation.mutate({
                    status: data.status === "published" ? "draft" : "published",
                  })
                }
              >
                {data.status === "published" ? "Unpublish to Draft" : "Publish to Portal"}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-3">
          {query.isLoading ? (
            <LoadingRows rows={5} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : data ? (
            <Tabs value={tab} onValueChange={(v) => setTab(v as "article" | "quiz" | "assignment" | "submissions")}>
              <TabsList className="mb-4">
                <TabsTrigger value="article">Lesson Article</TabsTrigger>
                <TabsTrigger value="quiz">
                  5-Question Quiz ({data.quiz?.questionsJson.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="assignment">Assignment &amp; Tests</TabsTrigger>
                <TabsTrigger value="submissions">
                  Submissions ({data.assignment?.submissions.length ?? 0})
                </TabsTrigger>
              </TabsList>

              {/* Tab: Article */}
              <TabsContent value="article" className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Markdown Content</Label>
                  <Textarea
                    rows={16}
                    className="font-mono text-xs leading-relaxed"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() =>
                      updateMutation.mutate({ title, markdownContent: content })
                    }
                    disabled={updateMutation.isPending}
                  >
                    Save Changes
                  </Button>
                </div>
              </TabsContent>

              {/* Tab: Quiz */}
              <TabsContent value="quiz" className="space-y-4">
                {data.quiz?.questionsJson.map((q, qIdx) => (
                  <Card key={qIdx} className="p-4 bg-muted/20">
                    <p className="font-semibold text-sm mb-2 text-foreground">
                      Q{qIdx + 1}: {q.question}
                    </p>
                    <div className="space-y-1.5 pl-2 mb-3">
                      {q.options.map((opt, oIdx) => {
                        const isCorrect = oIdx === q.correctIndex;
                        return (
                          <div
                            key={oIdx}
                            className={`flex items-center gap-2 text-xs p-2 rounded ${
                              isCorrect
                                ? "bg-success/15 text-success font-medium border border-success/30"
                                : "text-muted-foreground"
                            }`}
                          >
                            <span className="font-mono uppercase">
                              {String.fromCharCode(65 + oIdx)}.
                            </span>
                            <span>{opt}</span>
                            {isCorrect && (
                              <CheckCircle2 className="size-3.5 ml-auto text-success" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && (
                      <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                        <strong>Explanation:</strong> {q.explanation}
                      </p>
                    )}
                  </Card>
                ))}
              </TabsContent>

              {/* Tab: Assignment */}
              <TabsContent value="assignment" className="space-y-4">
                {data.assignment ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs uppercase text-muted-foreground font-semibold">
                        Prompt Instructions
                      </Label>
                      <div className="mt-1.5 p-3 rounded-lg border bg-muted/20 text-xs whitespace-pre-wrap">
                        {data.assignment.promptInstructions}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs uppercase text-muted-foreground font-semibold">
                        Starter Code
                      </Label>
                      <pre className="mt-1.5 p-3 rounded-lg border bg-muted/40 text-xs font-mono overflow-x-auto">
                        {data.assignment.starterCode}
                      </pre>
                    </div>
                    <div>
                      <Label className="text-xs uppercase text-muted-foreground font-semibold">
                        Test Cases
                      </Label>
                      <pre className="mt-1.5 p-3 rounded-lg border bg-muted/40 text-xs font-mono overflow-x-auto">
                        {JSON.stringify(data.assignment.testCases, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No assignment configured.</p>
                )}
              </TabsContent>

              {/* Tab: Submissions */}
              <TabsContent value="submissions" className="space-y-4">
                {data.assignment?.submissions.length ? (
                  <div className="space-y-3">
                    {data.assignment.submissions.map((sub) => (
                      <Card key={sub.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-semibold text-sm">
                              {sub.student.profile?.fullName || sub.student.email}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {new Date(sub.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <Badge
                            variant={sub.score >= 60 ? "default" : "destructive"}
                          >
                            Score: {sub.score}/100
                          </Badge>
                        </div>
                        <div className="text-xs font-mono bg-muted p-2 rounded mb-2 overflow-x-auto">
                          {sub.submittedCode}
                        </div>
                        <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 p-2.5 rounded">
                          <strong>AI Senior Mentor Review:</strong>
                          <div className="mt-1 whitespace-pre-wrap">
                            {sub.aiFeedback}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No student submissions received for this assignment yet.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
