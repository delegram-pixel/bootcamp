"use client";

import { useEffect, useRef, useState } from "react";
import {
  BoldIcon,
  CodeIcon,
  EyeIcon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Markdown } from "@/components/markdown";

/** The result of a toolbar command: the new text and the selection to restore. */
type Edit = { next: string; start: number; end: number };

/** Wrap the current selection in `before`/`after`; insert `placeholder` (selected) if nothing is selected. */
function wrapSelection(
  ta: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string,
): Edit {
  const { value, selectionStart, selectionEnd } = ta;
  const inner =
    selectionEnd > selectionStart ? value.slice(selectionStart, selectionEnd) : placeholder;
  const next =
    value.slice(0, selectionStart) + before + inner + after + value.slice(selectionEnd);
  const start = selectionStart + before.length;
  return { next, start, end: start + inner.length };
}

/** Prepend a prefix to every line touched by the selection (numbered lists increment). */
function prefixLines(ta: HTMLTextAreaElement, make: (index: number) => string): Edit {
  const { value, selectionStart, selectionEnd } = ta;
  const from = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const nextNewline = value.indexOf("\n", selectionEnd);
  const to = nextNewline === -1 ? value.length : nextNewline;
  const transformed = value
    .slice(from, to)
    .split("\n")
    .map((line, i) => make(i) + line)
    .join("\n");
  const next = value.slice(0, from) + transformed + value.slice(to);
  return { next, start: from, end: from + transformed.length };
}

/** `[label](url)` — uses the selection as the label and leaves `url` selected to type over. */
function insertLink(ta: HTMLTextAreaElement): Edit {
  const { value, selectionStart, selectionEnd } = ta;
  const label =
    selectionEnd > selectionStart ? value.slice(selectionStart, selectionEnd) : "text";
  const insert = `[${label}](url)`;
  const next = value.slice(0, selectionStart) + insert + value.slice(selectionEnd);
  const start = selectionStart + label.length + 3; // "[" + label + "]("
  return { next, start, end: start + 3 }; // select "url"
}

const TOOLS: { label: string; icon: LucideIcon; run: (ta: HTMLTextAreaElement) => Edit }[] = [
  { label: "Bold", icon: BoldIcon, run: (ta) => wrapSelection(ta, "**", "**", "bold text") },
  { label: "Italic", icon: ItalicIcon, run: (ta) => wrapSelection(ta, "*", "*", "italic text") },
  { label: "Heading", icon: Heading2Icon, run: (ta) => prefixLines(ta, () => "## ") },
  { label: "Subheading", icon: Heading3Icon, run: (ta) => prefixLines(ta, () => "### ") },
  { label: "Bulleted list", icon: ListIcon, run: (ta) => prefixLines(ta, () => "- ") },
  {
    label: "Numbered list",
    icon: ListOrderedIcon,
    run: (ta) => prefixLines(ta, (i) => `${i + 1}. `),
  },
  { label: "Quote", icon: QuoteIcon, run: (ta) => prefixLines(ta, () => "> ") },
  { label: "Inline code", icon: CodeIcon, run: (ta) => wrapSelection(ta, "`", "`", "code") },
  { label: "Link", icon: LinkIcon, run: insertLink },
];

/**
 * A markdown body editor: a formatting toolbar that wraps/inserts markdown at
 * the cursor, plus Write / Preview tabs. Controlled — `value` / `onChange` are
 * wired straight to the form field; the same `<Markdown>` used to render notes
 * powers the preview, so what you see here is what readers get.
 */
export function NoteBodyEditor({
  value,
  onChange,
  id,
  placeholder,
  rows = 16,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<[number, number] | null>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");

  // After a toolbar command changes the value, restore focus + selection once
  // React has re-rendered the textarea with the new text.
  useEffect(() => {
    if (pendingSelection.current && ref.current) {
      const [start, end] = pendingSelection.current;
      ref.current.focus();
      ref.current.setSelectionRange(start, end);
      pendingSelection.current = null;
    }
  });

  function run(command: (ta: HTMLTextAreaElement) => Edit) {
    const ta = ref.current;
    if (!ta) return;
    const { next, start, end } = command(ta);
    pendingSelection.current = [start, end];
    onChange(next);
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as "write" | "preview")}
      className="gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div
          role="toolbar"
          aria-label="Formatting"
          className="flex flex-wrap items-center gap-0.5"
        >
          {TOOLS.map((tool) => (
            <Button
              key={tool.label}
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              title={tool.label}
              aria-label={tool.label}
              disabled={tab !== "write"}
              onClick={() => run(tool.run)}
            >
              <tool.icon className="size-4" />
            </Button>
          ))}
        </div>
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">
            <EyeIcon />
            Preview
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="write">
        <Textarea
          id={id}
          ref={ref}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Write your note in markdown…"}
          className="min-h-64 font-mono text-sm"
        />
      </TabsContent>

      <TabsContent value="preview">
        <div className="min-h-64 rounded-lg border px-3 py-2">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-muted-foreground text-sm">Nothing to preview yet.</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
