"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import {
  BannersForm,
  FaqForm,
  HeroForm,
  TestimonialsForm,
} from "@/components/admin/content/site-forms";
import { ErrorState, LoadingRows, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import type { SiteContent } from "@/types/api";

const s = t.adminContent.site;

export default function SiteContentPage() {
  const site = useQuery({
    queryKey: ["admin", "site"],
    queryFn: () => api<SiteContent>("/admin/content/site"),
    // Forms keep their own state; don't reset them by refetching on focus.
    staleTime: Infinity,
  });

  return (
    <>
      <PageHeader
        title={s.title}
        description={s.description}
        actions={
          <Button variant="outline" asChild>
            <Link href="/" target="_blank">
              <ExternalLink /> {s.view}
            </Link>
          </Button>
        }
      />
      {site.isLoading ? (
        <LoadingRows rows={5} />
      ) : site.isError || !site.data ? (
        <ErrorState error={site.error} onRetry={() => site.refetch()} />
      ) : (
        <Tabs defaultValue="hero">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList>
              <TabsTrigger value="hero">{s.tabs.hero}</TabsTrigger>
              <TabsTrigger value="faq">{s.tabs.faq}</TabsTrigger>
              <TabsTrigger value="testimonials">{s.tabs.testimonials}</TabsTrigger>
              <TabsTrigger value="banners">{s.tabs.banners}</TabsTrigger>
            </TabsList>
          </div>
          <Card className="mt-4">
            <CardContent>
              <TabsContent value="hero">
                <HeroForm value={site.data.hero} />
              </TabsContent>
              <TabsContent value="faq">
                <FaqForm value={site.data.faq} />
              </TabsContent>
              <TabsContent value="testimonials">
                <TestimonialsForm value={site.data.testimonials} />
              </TabsContent>
              <TabsContent value="banners">
                <BannersForm value={site.data.banners} />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      )}
    </>
  );
}
