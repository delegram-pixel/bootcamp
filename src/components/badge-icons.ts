import {
  CheckCheckIcon,
  CheckCircle2Icon,
  FlameIcon,
  LayersIcon,
  SendIcon,
  StarIcon,
  TrendingUpIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

import { type BadgeIconKey } from "@/lib/scoring";

/**
 * Badge icons keyed by string, mirroring `nav-icons.ts`. The badge registry in
 * `scoring.ts` is a pure, icon-library-free module, so it stores an icon *key*
 * and the (server) badge grid resolves the component here. Keeping the map
 * `Record<BadgeIconKey, …>` means a new badge icon fails to compile until it's
 * wired up on both sides.
 */
export const BADGE_ICONS: Record<BadgeIconKey, LucideIcon> = {
  send: SendIcon,
  check: CheckCircle2Icon,
  star: StarIcon,
  "trending-up": TrendingUpIcon,
  flame: FlameIcon,
  "check-check": CheckCheckIcon,
  layers: LayersIcon,
  zap: ZapIcon,
};
