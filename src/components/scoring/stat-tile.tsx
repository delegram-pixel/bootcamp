import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfoHint } from "@/components/scoring/info-hint";

/**
 * Compact metric tile for the standing / progress views — the same shape as the
 * admin overview stat cards, without the link wrapper. A server component, so it
 * takes the Lucide icon component directly (no Server→Client boundary to cross,
 * unlike the nav icons).
 */
export function StatTile({
  label,
  value,
  hint,
  info,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Optional one-line explanation, revealed by a "?" beside the label. */
  info?: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CardDescription>{label}</CardDescription>
            {info ? (
              <InfoHint label={`How ${label.toLowerCase()} is calculated`}>
                {info}
              </InfoHint>
            ) : null}
          </div>
          <Icon className="text-muted-foreground size-4" />
        </div>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}
