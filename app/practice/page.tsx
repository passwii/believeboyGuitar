import type { Metadata } from "next";
import { PracticePlanner } from "@/components/PracticePlanner";
import { CAVEATS, DISCIPLINES } from "@/lib/practice-plan";

export const metadata: Metadata = {
  title: "练习计划",
  description: "选好总时长、技术目标与曲目，生成一份每次练琴都能照着做的练习计划。",
};

export default function PracticePage() {
  return (
    <main className="shell flex-1 py-10 sm:py-14">
      <header className="measure">
        <p className="text-micro font-medium uppercase text-ink-500">Practice plan</p>
        <h1 className="mt-3 text-display font-display text-ink-950 text-balance">练习计划</h1>
        <p className="mt-4 text-body text-ink-700 text-pretty">
          选好总时长、今天要练的技术和曲目，生成一份照着做就能练的安排。
        </p>
      </header>

      <div className="measure">
        <PracticePlanner />

        <section className="mt-14" aria-labelledby="practice-discipline-heading">
          <h2
            id="practice-discipline-heading"
            className="text-micro font-medium uppercase text-ink-500"
          >
            三条纪律
          </h2>
          <ol className="mt-4 list-none divide-y divide-rule border-y border-rule">
            {DISCIPLINES.map((discipline, index) => (
              <li
                key={discipline.title}
                className="border-l-2 border-accent-700 py-5 pl-4 sm:pl-5"
              >
                <p className="text-title text-ink-950 text-pretty">
                  <span className="mr-2 text-ink-500 tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {discipline.title}
                </p>
                <p className="mt-2 text-body text-ink-700 text-pretty">{discipline.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14" aria-labelledby="practice-caveat-heading">
          <h2
            id="practice-caveat-heading"
            className="text-micro font-medium uppercase text-ink-500"
          >
            一条提醒
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-body text-ink-700 marker:text-ink-500">
            {CAVEATS.map((caveat) => (
              <li key={caveat} className="text-pretty">
                {caveat}
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-14 border-t border-rule pt-5">
          <p className="text-meta text-ink-500 text-pretty">
            这是一份建议结构，不是标准答案。段落比例来自练习方法的一般经验，
            没有「最优间隔」这回事，具体的分钟数请按自己的作息和曲子难度调整。
          </p>
          <p className="mt-2 text-meta text-ink-500 text-pretty">
            做法与纪律的依据见资料库里的《练习方法：速度墙与注意力焦点》。
          </p>
        </footer>
      </div>
    </main>
  );
}
