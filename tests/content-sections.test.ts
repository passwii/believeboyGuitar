import { describe, expect, it } from "vitest";
import {
  splitContentSections,
  stripArticleWrapper,
  widgetMarkerNames,
} from "@/lib/content-sections";

const MARKER = '<lesson-widget name="week1-tab-drill"></lesson-widget>';

describe("widgetMarkerNames", () => {
  it("按出现顺序取出组件名", () => {
    expect(widgetMarkerNames(`<p>a</p>${MARKER}<p>b</p>${MARKER}`)).toEqual([
      "week1-tab-drill",
      "week1-tab-drill",
    ]);
  });

  it("没有标记时返回空数组", () => {
    expect(widgetMarkerNames("<article><p>a</p></article>")).toEqual([]);
  });

  it("保留未注册的名字，交给校验函数报错", () => {
    expect(widgetMarkerNames('<lesson-widget name="nope"></lesson-widget>')).toEqual(["nope"]);
  });
});

describe("stripArticleWrapper", () => {
  it("去掉最外层的 article", () => {
    expect(stripArticleWrapper("<article>\n<p>a</p>\n</article>")).toBe("<p>a</p>");
  });

  it("没有 article 时原样返回去空白后的内容", () => {
    expect(stripArticleWrapper("  <p>a</p>  ")).toBe("<p>a</p>");
  });
});

describe("splitContentSections", () => {
  it("没有组件时只有一段正文", () => {
    expect(splitContentSections("<article><p>a</p></article>")).toEqual([
      { kind: "prose", html: "<p>a</p>" },
    ]);
  });

  it("按标记切成正文、组件、正文三段", () => {
    expect(splitContentSections(`<article><p>a</p>${MARKER}<p>b</p></article>`)).toEqual([
      { kind: "prose", html: "<p>a</p>" },
      { kind: "widget", name: "week1-tab-drill" },
      { kind: "prose", html: "<p>b</p>" },
    ]);
  });

  it("跳过空白的正文片段", () => {
    expect(splitContentSections(`  ${MARKER}  `)).toEqual([
      { kind: "widget", name: "week1-tab-drill" },
    ]);
  });

  it("遇到未注册的组件名直接抛错", () => {
    expect(() =>
      splitContentSections('<lesson-widget name="nope"></lesson-widget>'),
    ).toThrow(/未注册的组件/);
  });
});
