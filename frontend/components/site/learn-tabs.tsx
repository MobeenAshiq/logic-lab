"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Small, correct examples of what each language looks like in our lessons.
const EXAMPLES = [
  {
    id: "python",
    label: "Python",
    file: "even_numbers.py",
    code: `numbers = [3, 8, 10, 7, 4]

total = 0
for n in numbers:
    if n % 2 == 0:
        total += n

print("Sum of evens:", total)  # 22`,
  },
  {
    id: "javascript",
    label: "JavaScript",
    file: "greet.js",
    code: `function greet(name) {
  return \`Hello, \${name}! Ready to code?\`;
}

const students = ["Ali", "Sara", "Hina"];
students.forEach((s) => console.log(greet(s)));`,
  },
  {
    id: "cpp",
    label: "C++",
    file: "main.cpp",
    code: `#include <iostream>
using namespace std;

int main() {
    for (int i = 1; i <= 5; i++) {
        cout << i << " x 2 = " << i * 2 << endl;
    }
    return 0;
}`,
  },
  {
    id: "html",
    label: "HTML",
    file: "index.html",
    code: `<!DOCTYPE html>
<html>
<body>
  <h1>My first page</h1>
  <p>Built while learning at LogicLab.</p>
</body>
</html>`,
  },
] as const;

export function LearnTabs({ startHref }: { startHref: string }) {
  const [active, setActive] = useState<(typeof EXAMPLES)[number]["id"]>("python");
  const ex = EXAMPLES.find((e) => e.id === active) ?? EXAMPLES[0];

  return (
    <div className="mx-auto max-w-2xl">
      <div role="tablist" aria-label="Choose a language" className="flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((e) => (
          <button
            key={e.id}
            type="button"
            role="tab"
            aria-selected={e.id === active}
            onClick={() => setActive(e.id)}
            className={cn(
              "min-h-10 rounded-[4px] border px-4 text-sm font-semibold transition-colors",
              e.id === active
                ? "border-[#0B1220] bg-[#0B1220] text-white dark:border-white dark:bg-white dark:text-[#0B1220]"
                : "border-border bg-card text-foreground hover:border-primary/50",
            )}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-6 overflow-hidden rounded-[6px] border border-border bg-card shadow-md">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#F87171]" />
          <span className="size-2.5 rounded-full bg-[#FBBF24]" />
          <span className="size-2.5 rounded-full bg-[#34D399]" />
          <span className="text-muted-foreground ml-2 text-xs font-semibold">
            {ex.label} example · {ex.file}
          </span>
        </div>
        <pre className="min-h-56 overflow-x-auto border-l-4 border-primary bg-background px-5 py-4 font-mono text-sm leading-6 text-foreground">
          {ex.code}
        </pre>
        <div className="border-t border-border bg-surface px-4 py-3">
          <Button asChild size="sm" className="font-bold">
            <Link href={startHref}>
              Try it yourself <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Button asChild variant="outline" className="bg-card font-semibold">
          <Link href={startHref}>Start learning</Link>
        </Button>
        <Button asChild variant="outline" className="bg-card font-semibold">
          <Link href="/courses">Browse courses</Link>
        </Button>
        <Button asChild variant="outline" className="bg-card font-semibold">
          <Link href="/pricing">See pricing</Link>
        </Button>
      </div>
    </div>
  );
}
