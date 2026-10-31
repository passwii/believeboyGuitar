import type { ComponentType } from "react";
import { WeekOneTabDrill } from "@/components/WeekOneTabDrill";
import { WeekTwoTabDrill } from "@/components/WeekTwoTabDrill";
import type { WidgetName } from "@/content/widgets";

/**
 * 正文里的 `<lesson-widget name="…">` 标记与真实组件的对应表。
 * 加一个新组件时，先登记到 content/widgets.ts，再在这里接上实现。
 */
const WIDGETS: Record<WidgetName, ComponentType> = {
  "week1-tab-drill": WeekOneTabDrill,
  "week2-tab-drill": WeekTwoTabDrill,
};

export function LessonWidget({ name }: { name: WidgetName }) {
  const Widget = WIDGETS[name];
  return <Widget />;
}
