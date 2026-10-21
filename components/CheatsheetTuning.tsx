import { CheatsheetSection } from "@/components/CheatsheetSection";
import { CheatsheetColumn, CheatsheetHead, CheatsheetTable } from "@/components/CheatsheetTable";
import { tuningRows } from "@/lib/cheatsheet";

/**
 * 调弦与音名对照。
 *
 * 数字来自 lib/cheatsheet.ts，由 STANDARD_TUNING 推出：改标准调弦这一页跟着变。
 */

export function CheatsheetTuning() {
  const rows = tuningRows();

  return (
    <CheatsheetSection
      id="tuning"
      title="调弦与音名对照"
      summary="六根弦的空弦音名、MIDI 音高与 C 大调音级"
      hint="标准调弦是 EADGBE，MIDI 音高以中央 C（C4）为 60。后面所有速查都建立在这个前提上——换调弦或换标准音高时，这一页会一起变。"
    >
      <CheatsheetTable caption="标准调弦下六根弦的空弦音名、MIDI 音高与 C 大调音级">
        <CheatsheetHead>
          <CheatsheetColumn>弦</CheatsheetColumn>
          <CheatsheetColumn>空弦</CheatsheetColumn>
          <CheatsheetColumn>八度</CheatsheetColumn>
          <CheatsheetColumn align="center">MIDI</CheatsheetColumn>
          <CheatsheetColumn align="center">C 大调音级</CheatsheetColumn>
          <CheatsheetColumn align="center">唱名</CheatsheetColumn>
        </CheatsheetHead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.stringNumber} className="border-b border-rule last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-normal">
                <span className="font-mono text-ink-950">{row.stringNumber} 弦</span>
              </th>
              <td className="px-3 py-2 font-mono font-semibold text-ink-950">
                {row.openName}
              </td>
              <td className="px-3 py-2 font-mono text-ink-700">{row.openNote}</td>
              <td className="px-3 py-2 text-center font-mono text-ink-700 tabular-nums">
                {row.openMidi}
              </td>
              <td className="px-3 py-2 text-center text-ink-700">
                {row.degree === null ? (
                  <span className="text-ink-500">调外</span>
                ) : (
                  <span>
                    <span className="font-semibold text-accent-700">{row.degree}</span>
                    <span className="ml-1 text-ink-500">{row.degreeNote}</span>
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-center font-mono text-ink-700">
                {row.solfege ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </CheatsheetTable>
    </CheatsheetSection>
  );
}
