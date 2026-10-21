import {
  GUIDE_CLOSING,
  GUIDE_HISTORY_NOTE,
  GUIDE_LEAD,
  GUIDE_SECTIONS,
} from "@/lib/metronome-guide";

/**
 * 节拍器页面的「配套指引」。
 *
 * 文案来自 research/practice.md §4 的 M1–M10：那轮调研的结论是
 * 「节拍器页面现有功能已经全部支持，不需要改代码」，所以这一块只有说明文字，
 * 不引入任何新控件。
 *
 * 结构：一句引言（把节拍器重新定位成两件工具加一条使用纪律）→ 三小节
 * （速度标尺 / 分组锚点 / 使用纪律）→ 一句关于不记录历史的说明 → 一句收尾。
 *
 * 没有交互，因此是服务端组件。层级靠字号与字重：区块标题用 text-title，
 * 小节标题用 text-body 加粗，正文用 text-body，靠墨色深浅再分一层。
 */
export function MetronomeGuide() {
  return (
    <section aria-labelledby="metronome-guide-heading" className="mt-12 border-t border-rule pt-8">
      <h2
        id="metronome-guide-heading"
        className="text-title font-display text-ink-950 text-balance"
      >
        配套指引
      </h2>
      <p className="mt-3 text-body text-ink-700 text-pretty">{GUIDE_LEAD}</p>

      {GUIDE_SECTIONS.map((section) => (
        <div key={section.id} className="mt-8 border-t border-rule pt-6">
          <h3
            id={`metronome-guide-${section.id}`}
            className="scroll-mt-24 text-body font-semibold text-ink-950"
          >
            {section.title}
          </h3>
          <p className="mt-1 text-meta text-ink-500 text-pretty">{section.summary}</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-ink-500">
            {section.items.map((item) => (
              <li key={item.title} className="text-body text-ink-700 text-pretty">
                <span className="font-medium text-ink-950">{item.title}</span>：{item.body}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="mt-8 border-t border-rule pt-5 text-meta text-ink-500 text-pretty">
        {GUIDE_HISTORY_NOTE}
      </p>
      <p className="mt-3 text-body text-ink-950 text-pretty">{GUIDE_CLOSING}</p>
    </section>
  );
}
