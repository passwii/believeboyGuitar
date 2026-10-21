import { CheatsheetSection } from "@/components/CheatsheetSection";
import { CheatsheetColumn, CheatsheetHead, CheatsheetTable } from "@/components/CheatsheetTable";
import { tempoBands } from "@/lib/cheatsheet";
import { BPM_MAX, BPM_MIN } from "@/lib/metronome";

/**
 * BPM 与速度术语的对应。
 *
 * 区间由 tempoName 逐 BPM 扫出来，所以改了速度区间的定义，这里跟着变。
 */

export function CheatsheetTempo() {
  const bands = tempoBands();

  return (
    <CheatsheetSection
      id="tempo"
      title="速度术语"
      summary="BPM 与意大利术语的对应区间"
      hint={`节拍器可调范围 ${BPM_MIN}–${BPM_MAX} BPM。术语只作提示：同一段速度在不同语境里叫法会差一档，练曲子时先记住大致区间就够了。`}
    >
      <CheatsheetTable caption="速度术语与 BPM 区间的对应">
        <CheatsheetHead>
          <CheatsheetColumn>术语</CheatsheetColumn>
          <CheatsheetColumn>中文</CheatsheetColumn>
          <CheatsheetColumn align="center">BPM</CheatsheetColumn>
        </CheatsheetHead>
        <tbody>
          {bands.map((band) => (
            <tr key={band.name} className="border-b border-rule last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-normal">
                <span className="font-semibold text-ink-950">{band.name}</span>
              </th>
              <td className="px-3 py-2 text-ink-700">{band.gloss}</td>
              <td className="px-3 py-2 text-center font-mono text-ink-950 tabular-nums">
                {band.min}–{band.max}
              </td>
            </tr>
          ))}
        </tbody>
      </CheatsheetTable>
    </CheatsheetSection>
  );
}
