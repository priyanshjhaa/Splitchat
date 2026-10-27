import {
  BedDouble,
  Car,
  Receipt,
  ShoppingBag,
  Ticket,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "@/lib/types";

export const CATEGORY_STYLE: Record<
  Category,
  { icon: LucideIcon; label: string; tile: string }
> = {
  food: {
    icon: Utensils,
    label: "Food",
    tile: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  },
  travel: {
    icon: Car,
    label: "Travel",
    tile: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  },
  stay: {
    icon: BedDouble,
    label: "Stay",
    tile: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  },
  activities: {
    icon: Ticket,
    label: "Activities",
    tile: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300",
  },
  shopping: {
    icon: ShoppingBag,
    label: "Shopping",
    tile: "bg-lime-100 text-lime-700 dark:bg-lime-900/50 dark:text-lime-300",
  },
  other: {
    icon: Receipt,
    label: "Other",
    tile: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
};

export function CategoryTile({ category }: { category: Category }) {
  const { icon: Icon, tile } = CATEGORY_STYLE[category];
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tile}`}
    >
      <Icon className="size-5" />
    </span>
  );
}
