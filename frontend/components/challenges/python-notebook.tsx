"use client";

import { useState } from "react";
import { CodeEditor } from "@/components/challenges/code-editor";
import { runNotebookCode, type NotebookOutput } from "@/lib/notebook-runner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const INITIAL_CELLS = [
  "import pandas as pd\nimport numpy as np\n\ndata = pd.DataFrame({\n    'day': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],\n    'hours': [1.5, 2.0, 0.5, 3.0, 2.5],\n})\nprint(data)\n\n# Set result to a dict. DataFrames and numpy arrays are converted for display.\nresult = {\n    'table': data,\n    'chart': {\n        'title': 'Study hours',\n        'labels': data['day'].tolist(),\n        'values': data['hours'].tolist(),\n    },\n}",
];

function NotebookResultView({ output }: { output: NotebookOutput }) {
  const value = output.result && typeof output.result === "object" ? output.result as Record<string, unknown> : {};
  const tableValue = Array.isArray(value.table) ? value.table as Record<string, unknown>[] : Array.isArray(output.result) ? output.result as Record<string, unknown>[] : [];
  const chart = value.chart && typeof value.chart === "object" ? value.chart as { title?: string; labels?: string[]; values?: number[] } : null;
  const max = Math.max(1, ...(chart?.values ?? []).map((n) => Number(n) || 0));
  return <div className="space-y-4">
    {output.stdout && <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{output.stdout}</pre>}
    {tableValue.length > 0 && <div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{Object.keys(tableValue[0]).map((key) => <th key={key} className="px-3 py-2 font-semibold">{key}</th>)}</tr></thead><tbody>{tableValue.map((row, i) => <tr key={i} className="border-t">{Object.keys(tableValue[0]).map((key) => <td key={key} className="px-3 py-2">{String(row[key] ?? "")}</td>)}</tr>)}</tbody></table></div>}
    {chart?.labels && chart.values && <div className="rounded-lg border p-4"><h3 className="mb-3 text-sm font-semibold">{chart.title ?? "Chart"}</h3><div className="flex h-48 items-end gap-3 border-b border-l px-3">{chart.values.map((raw, index) => { const val = Number(raw) || 0; return <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-1"><span className="text-muted-foreground text-[10px]">{val}</span><div className="w-full max-w-12 rounded-t bg-primary" style={{ height: `${Math.max(3, val / max * 80)}%` }} /><span className="text-muted-foreground truncate text-[10px]">{chart.labels?.[index]}</span></div>; })}</div></div>}
    {output.result !== null && output.result !== undefined && tableValue.length === 0 && !chart && <pre className="overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">{JSON.stringify(output.result, null, 2)}</pre>}
  </div>;
}

export function PythonNotebook() {
  const [cells, setCells] = useState(INITIAL_CELLS);
  const [outputs, setOutputs] = useState<Record<number, NotebookOutput>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [running, setRunning] = useState<number | null>(null);

  const run = async (index: number) => {
    setRunning(index);
    setErrors((previous) => ({ ...previous, [index]: "" }));
    try {
      const output = await runNotebookCode(cells[index]);
      setOutputs((previous) => ({ ...previous, [index]: output }));
    } catch (error) {
      setErrors((previous) => ({ ...previous, [index]: error instanceof Error ? error.message : "Could not run this cell." }));
    } finally { setRunning(null); }
  };

  return <div className="space-y-6">
    <div><h1 className="font-heading text-2xl font-bold">Python data notebook</h1><p className="text-muted-foreground mt-1 text-sm">Run Python with Pyodide, pandas and numpy in a Web Worker. Execution stops after 5 seconds.</p></div>
    {cells.map((code, index) => <Card key={index}><CardHeader><CardTitle className="text-base">Cell {index + 1}</CardTitle><CardDescription>Use <span className="font-mono">result</span> to display a table or chart. Return a pandas DataFrame in <span className="font-mono">table</span>, and chart labels/values in <span className="font-mono">chart</span>.</CardDescription></CardHeader><CardContent className="space-y-4"><CodeEditor value={code} onChange={(value) => setCells((previous) => previous.map((cell, i) => i === index ? value : cell))} language="python" height={320} /><Button onClick={() => void run(index)} disabled={running !== null}>{running === index ? "Running…" : "Run cell"}</Button>{errors[index] && <p className="text-destructive rounded-lg bg-destructive/10 p-3 text-sm" role="alert">{errors[index]}</p>}{outputs[index] && <NotebookResultView output={outputs[index]} />}</CardContent></Card>)}
    <Button variant="outline" onClick={() => { setCells((previous) => [...previous, "# Add your analysis here\\nresult = None"]); }}>Add cell</Button>
  </div>;
}
