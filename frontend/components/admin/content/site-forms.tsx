"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  Controller,
  type FieldValues,
  useFieldArray,
  useForm,
  type UseFormReturn,
} from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { EmptyState, Field } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { applyFormErrors } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { Banner, SiteContent, SiteContentKey } from "@/types/api";
import {
  type BannerForm,
  bannerFormSchema,
  faqSchema,
  heroSchema,
  testimonialsSchema,
} from "./schemas";

const s = t.adminContent.site;

function useSaveBlock<T extends FieldValues>(key: SiteContentKey, form: UseFormReturn<T>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api(`/admin/content/site/${key}`, { method: "PUT", body: data }),
    onSuccess: () => {
      toast.success(s.savedBlock(s.tabs[key]));
      void queryClient.invalidateQueries({ queryKey: ["admin", "site"] });
      form.reset(form.getValues());
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });
}

function SaveBar({ pending, dirty }: { pending: boolean; dirty: boolean }) {
  return (
    <div className="flex justify-end">
      <Button type="submit" disabled={pending || !dirty}>
        {pending ? t.common.actions.saving : t.common.actions.save}
      </Button>
    </div>
  );
}

function ItemShell({
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-xl border p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">{s.item(index + 1)}</span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={s.moveUp}
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={s.moveDown}
            disabled={index === count - 1}
            onClick={() => onMove(index, index + 1)}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t.common.actions.remove}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

// --- Hero ---

type HeroValues = z.infer<typeof heroSchema>;

export function HeroForm({ value }: { value: SiteContent["hero"] }) {
  const form = useForm<HeroValues>({ resolver: zodResolver(heroSchema), defaultValues: value });
  const save = useSaveBlock("hero", form);
  const { errors } = form.formState;
  const h = s.hero;
  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4">
      <Field label={h.title} htmlFor="hero-title" error={errors.title?.message}>
        <Input id="hero-title" {...form.register("title")} />
      </Field>
      <Field label={h.subtitle} htmlFor="hero-subtitle" error={errors.subtitle?.message}>
        <Textarea id="hero-subtitle" rows={3} {...form.register("subtitle")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={h.ctaText} htmlFor="hero-cta" error={errors.ctaText?.message}>
          <Input id="hero-cta" {...form.register("ctaText")} />
        </Field>
        <Field
          label={h.ctaHref}
          htmlFor="hero-href"
          error={errors.ctaHref?.message}
          hint={h.ctaHrefHint}
        >
          <Input id="hero-href" {...form.register("ctaHref")} />
        </Field>
      </div>
      <SaveBar pending={save.isPending} dirty={form.formState.isDirty} />
    </form>
  );
}

// --- FAQ ---

type FaqValues = z.infer<typeof faqSchema>;

export function FaqForm({ value }: { value: SiteContent["faq"] }) {
  const form = useForm<FaqValues>({ resolver: zodResolver(faqSchema), defaultValues: value });
  const items = useFieldArray({ control: form.control, name: "items" });
  const save = useSaveBlock("faq", form);
  const { errors } = form.formState;
  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4">
      {items.fields.length === 0 && <EmptyState title={s.faq.empty} />}
      {items.fields.map((item, i) => (
        <ItemShell
          key={item.id}
          index={i}
          count={items.fields.length}
          onMove={items.move}
          onRemove={() => items.remove(i)}
        >
          <Field
            label={s.faq.question}
            htmlFor={`faq-q-${i}`}
            error={errors.items?.[i]?.question?.message}
          >
            <Input id={`faq-q-${i}`} {...form.register(`items.${i}.question`)} />
          </Field>
          <Field
            label={s.faq.answer}
            htmlFor={`faq-a-${i}`}
            error={errors.items?.[i]?.answer?.message}
          >
            <Textarea id={`faq-a-${i}`} rows={3} {...form.register(`items.${i}.answer`)} />
          </Field>
        </ItemShell>
      ))}
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={items.fields.length >= 30}
          onClick={() => items.append({ question: "", answer: "" })}
        >
          <Plus /> {s.faq.add}
        </Button>
        <SaveBar pending={save.isPending} dirty={form.formState.isDirty} />
      </div>
    </form>
  );
}

// --- Testimonials ---

type TestimonialsValues = z.infer<typeof testimonialsSchema>;

export function TestimonialsForm({ value }: { value: SiteContent["testimonials"] }) {
  const form = useForm<TestimonialsValues>({
    resolver: zodResolver(testimonialsSchema),
    defaultValues: value,
  });
  const items = useFieldArray({ control: form.control, name: "items" });
  const save = useSaveBlock("testimonials", form);
  const { errors } = form.formState;
  const ts = s.testimonials;
  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4">
      {items.fields.length === 0 && <EmptyState title={ts.empty} />}
      {items.fields.map((item, i) => (
        <ItemShell
          key={item.id}
          index={i}
          count={items.fields.length}
          onMove={items.move}
          onRemove={() => items.remove(i)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={ts.name} htmlFor={`t-name-${i}`} error={errors.items?.[i]?.name?.message}>
              <Input id={`t-name-${i}`} {...form.register(`items.${i}.name`)} />
            </Field>
            <Field label={ts.role} htmlFor={`t-role-${i}`} error={errors.items?.[i]?.role?.message}>
              <Input
                id={`t-role-${i}`}
                placeholder={ts.rolePlaceholder}
                {...form.register(`items.${i}.role`)}
              />
            </Field>
          </div>
          <Field
            label={ts.quote}
            htmlFor={`t-quote-${i}`}
            error={errors.items?.[i]?.quote?.message}
          >
            <Textarea id={`t-quote-${i}`} rows={3} {...form.register(`items.${i}.quote`)} />
          </Field>
        </ItemShell>
      ))}
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={items.fields.length >= 20}
          onClick={() => items.append({ name: "", role: "", quote: "" })}
        >
          <Plus /> {ts.add}
        </Button>
        <SaveBar pending={save.isPending} dirty={form.formState.isDirty} />
      </div>
    </form>
  );
}

// --- Banners ---

const toLocal = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

function toBannerForm(items: Banner[]): BannerForm {
  return {
    items: items.map((b) => ({
      ...b,
      href: b.href ?? "",
      startsAt: toLocal(b.startsAt),
      endsAt: toLocal(b.endsAt),
    })),
  };
}

function fromBannerForm(v: BannerForm): SiteContent["banners"] {
  return {
    items: v.items.map((b) => ({
      ...b,
      href: b.href || null,
      startsAt: toIso(b.startsAt),
      endsAt: toIso(b.endsAt),
    })),
  };
}

export function BannersForm({ value }: { value: SiteContent["banners"] }) {
  const form = useForm<BannerForm>({
    resolver: zodResolver(bannerFormSchema),
    defaultValues: toBannerForm(value.items),
  });
  const items = useFieldArray({ control: form.control, name: "items", keyName: "fieldKey" });
  const save = useSaveBlock("banners", form);
  const { errors } = form.formState;
  const b = s.banners;
  return (
    <form
      onSubmit={form.handleSubmit((v) => save.mutate(fromBannerForm(v)))}
      className="grid gap-4"
    >
      {items.fields.length === 0 && <EmptyState title={b.empty} />}
      {items.fields.map((item, i) => (
        <ItemShell
          key={item.fieldKey}
          index={i}
          count={items.fields.length}
          onMove={items.move}
          onRemove={() => items.remove(i)}
        >
          <Field label={b.text} htmlFor={`b-text-${i}`} error={errors.items?.[i]?.text?.message}>
            <Input id={`b-text-${i}`} {...form.register(`items.${i}.text`)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Field
              label={b.href}
              htmlFor={`b-href-${i}`}
              error={errors.items?.[i]?.href?.message}
              hint={b.hrefHint}
            >
              <Input id={`b-href-${i}`} {...form.register(`items.${i}.href`)} />
            </Field>
            <Field label={b.variant}>
              <Controller
                control={form.control}
                name={`items.${i}.variant`}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["info", "promo", "warning"] as const).map((v) => (
                        <SelectItem key={v} value={v}>
                          {b.variants[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
            <Field label={b.active}>
              <Controller
                control={form.control}
                name={`items.${i}.active`}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-1.5"
                  />
                )}
              />
            </Field>
            <Field label={b.startsAt} htmlFor={`b-start-${i}`} hint={b.dateHint}>
              <Input
                id={`b-start-${i}`}
                type="datetime-local"
                {...form.register(`items.${i}.startsAt`)}
              />
            </Field>
            <Field label={b.endsAt} htmlFor={`b-end-${i}`} hint={b.dateHint}>
              <Input
                id={`b-end-${i}`}
                type="datetime-local"
                {...form.register(`items.${i}.endsAt`)}
              />
            </Field>
          </div>
        </ItemShell>
      ))}
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={items.fields.length >= 10}
          onClick={() =>
            items.append({
              id: crypto.randomUUID().slice(0, 8),
              text: "",
              href: "",
              variant: "info",
              active: true,
              startsAt: "",
              endsAt: "",
            })
          }
        >
          <Plus /> {b.add}
        </Button>
        <SaveBar pending={save.isPending} dirty={form.formState.isDirty} />
      </div>
    </form>
  );
}
