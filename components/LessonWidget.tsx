import type { ComponentType } from "react";
import { ThreeNotesPerString } from "@/components/ThreeNotesPerString";
import { CagedSystem } from "@/components/CagedSystem";
import { TwelveBarBlues } from "@/components/TwelveBarBlues";
import { BendPitchMeter } from "@/components/BendPitchMeter";
import { TabExercise } from "@/components/TabExercise";
import type { WidgetName } from "@/content/widgets";

/**
 * 正文里的 `<lesson-widget name="…">` 标记与真实组件的对应表。
 * 加一个新组件时，先登记到 content/widgets.ts，再在这里接上实现。
 */
const WIDGETS: Record<WidgetName, ComponentType> = {
  "c-major-three-notes-per-string": ThreeNotesPerString,
  "caged-system": CagedSystem,
  "twelve-bar-blues": TwelveBarBlues,
  "bend-pitch-meter": BendPitchMeter,
  "week1-tab-drill": TabExercise,
};

export function LessonWidget({ name }: { name: WidgetName }) {
  const Widget = WIDGETS[name];
  return <Widget />;
}
