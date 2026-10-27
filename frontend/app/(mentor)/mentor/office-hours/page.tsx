"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface SlotItem {
  weekday: number;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

interface OfficeHoursResponse {
  slots: SlotItem[];
  withinOfficeHours: boolean | null;
}

export default function MentorOfficeHoursPage() {
  const qc = useQueryClient();
  const [slots, setSlots] = useState<SlotItem[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["mentor-office-hours"],
    queryFn: () => api<OfficeHoursResponse>("/mentor/office-hours"),
  });

  useEffect(() => {
    if (data?.slots) {
      setSlots(data.slots);
    }
  }, [data?.slots]);

  const saveMutation = useMutation({
    mutationFn: (newSlots: SlotItem[]) =>
      api<OfficeHoursResponse>("/mentor/office-hours", {
        method: "PUT",
        body: { slots: newSlots },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentor-office-hours"] });
      toast.success(t.realtime.officeHours.saved);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save office hours");
    },
  });

  const addSlot = (weekday: number) => {
    setSlots((prev) => [
      ...prev,
      { weekday, start: "14:00", end: "18:00" },
    ]);
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: "start" | "end", value: string) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const applyTemplate = (type: "weekdays" | "evenings") => {
    if (type === "weekdays") {
      // Mon (1) to Fri (5) from 10:00 to 18:00
      const newSlots: SlotItem[] = [1, 2, 3, 4, 5].map((day) => ({
        weekday: day,
        start: "10:00",
        end: "18:00",
      }));
      setSlots(newSlots);
    } else {
      // Mon (1) to Fri (5) from 18:00 to 22:00
      const newSlots: SlotItem[] = [1, 2, 3, 4, 5].map((day) => ({
        weekday: day,
        start: "18:00",
        end: "22:00",
      }));
      setSlots(newSlots);
    }
    toast.info("Template applied. Click 'Save' to confirm.");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2.5">
            <Clock className="size-7 text-primary" />
            {t.realtime.officeHours.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t.realtime.officeHours.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {data?.withinOfficeHours !== null && (
            <Badge
              variant={data?.withinOfficeHours ? "default" : "outline"}
              className="text-xs py-1"
            >
              {data?.withinOfficeHours
                ? "Currently In Office Hours"
                : "Currently Offline"}
            </Badge>
          )}
          <Button
            onClick={() => saveMutation.mutate(slots)}
            disabled={saveMutation.isPending}
            className="gap-1.5"
          >
            <Check className="size-4" />
            {t.realtime.officeHours.save}
          </Button>
        </div>
      </div>

      {/* Quick templates */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-muted-foreground">
            Quick Templates:
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyTemplate("weekdays")}
              className="text-xs h-8"
            >
              Mon–Fri 10:00 – 18:00 (Full time)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyTemplate("evenings")}
              className="text-xs h-8"
            >
              Mon–Fri 18:00 – 22:00 (Evenings)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Day by Day schedule */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          {DAYS.map((dayName, weekdayIndex) => {
            const daySlots = slots
              .map((s, originalIndex) => ({ ...s, originalIndex }))
              .filter((s) => s.weekday === weekdayIndex);

            return (
              <Card key={dayName} className="shadow-xs">
                <CardHeader className="py-3 px-4 sm:px-6 flex flex-row items-center justify-between border-b bg-muted/20">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold">{dayName}</CardTitle>
                    <span className="text-xs text-muted-foreground">
                      ({daySlots.length} {daySlots.length === 1 ? "slot" : "slots"})
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addSlot(weekdayIndex)}
                    className="h-7 text-xs text-primary gap-1"
                  >
                    <Plus className="size-3.5" />
                    {t.realtime.officeHours.addSlot}
                  </Button>
                </CardHeader>

                <CardContent className="p-4 sm:p-6">
                  {daySlots.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Unavailable / Off day
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {daySlots.map((slot) => (
                        <div
                          key={slot.originalIndex}
                          className="flex items-center gap-3 bg-muted/30 p-2.5 rounded-lg border max-w-md"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              type="time"
                              value={slot.start}
                              onChange={(e) =>
                                updateSlot(
                                  slot.originalIndex,
                                  "start",
                                  e.target.value,
                                )
                              }
                              className="h-8 text-xs font-mono"
                            />
                            <span className="text-xs text-muted-foreground">to</span>
                            <Input
                              type="time"
                              value={slot.end}
                              onChange={(e) =>
                                updateSlot(
                                  slot.originalIndex,
                                  "end",
                                  e.target.value,
                                )
                              }
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSlot(slot.originalIndex)}
                            className="size-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
