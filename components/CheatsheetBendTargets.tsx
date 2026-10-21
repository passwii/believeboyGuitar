import { CheatsheetSection } from "@/components/CheatsheetSection";
import { CheatsheetColumn, CheatsheetHead, CheatsheetTable } from "@/components/CheatsheetTable";
import { bendRows } from "@/lib/cheatsheet";

/**
 * 常用起音的推弦目标音。
 *
 * 目标音与对应品位由 buildBendTargets 从标准调弦推出。
 * 调内音（C 大调里的音）用深墨色，调外音用次级墨色，
 * 不只靠颜色区分——每格都有给读屏的文字说明。
 */

export function CheatsheetBendTargets() {
  const rows = bendRows();

  return (
    <CheatsheetSection
      id="bend-targets"
      title="推弦目标音"
      summary="常用起音能推到哪些音，以及对应的等效品位"
      hint="推 1 音（全音）等于往高走 1 品，推 1.5 音等于 1.5 品——所以「推到位」的目标就是那个品位发出的音。括号里是等效品位，调外音用浅色标出。"
    >
      <CheatsheetTable caption="常用推弦起音能推到的目标音与等效品位">
        <CheatsheetHead>
          <CheatsheetColumn>起音</CheatsheetColumn>
          <CheatsheetColumn>起始音</CheatsheetColumn>
          <CheatsheetColumn align="center">半音</CheatsheetColumn>
          <CheatsheetColumn align="center">1 音</CheatsheetColumn>
          <CheatsheetColumn align="center">1.5 音</CheatsheetColumn>
          <CheatsheetColumn align="center">2 音</CheatsheetColumn>
        </CheatsheetHead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.stringNumber}-${row.fret}`} className="border-b border-rule last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-normal">
                <span className="whitespace-nowrap font-mono text-ink-950">
                  {row.stringNumber} 弦 {row.fret === 0 ? "空弦" : `${row.fret} 品`}
                </span>
              </th>
              <td className="px-3 py-2 font-mono text-ink-700">{row.fromName}</td>
              {row.targets.map((target) => (
                <td key={target.units} className="px-2 py-2 text-center">
                  <span
                    className={`font-mono ${
                      target.inKey ? "text-ink-950" : "text-ink-500"
                    }`}
                  >
                    {target.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-micro text-ink-500 tabular-nums">
                    {target.targetFret} 品
                  </span>
                  <span className="sr-only">
                    ，推 {target.label}到 {target.name}，
                    {target.inKey ? "C 大调调内音" : "C 大调调外音"}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </CheatsheetTable>
    </CheatsheetSection>
  );
}
