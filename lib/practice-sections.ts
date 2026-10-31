import { WEEK1_SECTIONS } from "@/lib/week-1-tab-exercises";
import { WEEK2_SECTIONS } from "@/lib/week-2-tab-exercises";
import type { TabSection } from "@/lib/tab-practice";

const SECTIONS_BY_SLUG: Record<string, readonly TabSection[]> = {
  "week-1-finger-independence": WEEK1_SECTIONS,
  "week-2-alternate-picking": WEEK2_SECTIONS,
};

export function practiceSections(slug: string): readonly TabSection[] {
  return SECTIONS_BY_SLUG[slug] ?? [];
}

const ANCHOR_PREFIX: Record<string, string> = {
  "week-1-finger-independence": "week1-tab",
  "week-2-alternate-picking": "week2-tab",
};

export function practiceSectionAnchor(weekSlug: string, sectionId: string): string {
  return `${ANCHOR_PREFIX[weekSlug] ?? "practice"}-${sectionId}`;
}
