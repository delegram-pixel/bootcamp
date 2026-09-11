"use client";

import * as React from "react";
import { HelpCircleIcon } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * A small "?" affordance that explains a scoring metric on hover, keyboard
 * focus, or tap. Radix tooltips open on hover/focus but ignore touch — and their
 * trigger deliberately closes itself on click/pointer-down (it assumes a click
 * means navigation). So we drive `open` ourselves: hover and focus flow through
 * `onOpenChange` as usual, while we suppress Radix's close-on-press
 * (`preventDefault` short-circuits its composed handler) and toggle on click
 * instead — one hint that works the same for mouse, keyboard, and touch. Renders
 * its own provider so it drops straight into a server component.
 */
export function InfoHint({
  label,
  side = "top",
  className,
  children,
}: {
  /** Accessible name for the trigger — the visible bubble is decorative to AT. */
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          type="button"
          aria-label={label}
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            setOpen((o) => !o);
          }}
          className={cn(
            "text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring/50 inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full align-middle outline-none focus-visible:ring-2",
            className,
          )}
        >
          <HelpCircleIcon className="size-3.5" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-xs text-xs font-normal leading-relaxed text-pretty"
        >
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
