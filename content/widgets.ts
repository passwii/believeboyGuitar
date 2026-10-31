/**
 * 正文文件里可以嵌入的交互组件。
 *
 * 这是「正文 HTML」与「网站代码」之间的唯一契约：正文只写一个占位标记
 * `<lesson-widget name="…"></lesson-widget>`，具体渲染什么由网站决定。
 * 正文因此依然不带样式、不带脚本。
 */
export const WIDGET_NAMES = ["week1-tab-drill", "week2-tab-drill"] as const;

export type WidgetName = (typeof WIDGET_NAMES)[number];
