import { CheatsheetSection } from "@/components/CheatsheetSection";
import { CheatsheetColumn, CheatsheetHead, CheatsheetTable } from "@/components/CheatsheetTable";
import { beatUnitName, meterRows } from "@/lib/cheatsheet";

/**
 * 拍号的重音模型。
 *
 * 重音位置由 METERS 的 accents 推出（经过 accentIndexes 规整），
 * 节拍器页面的节拍器用的就是同一份数据。
 */

export function CheatsheetMeters() {
  const rows = meterRows();

  return (
    <CheatsheetSection
      id="meters"
      title="节拍器重音模型"
      summary="六种拍号各自的重音位置与听感"
      hint="拍号的上排数字是每小节几拍，下排数字是一拍等于几分音符。重音位置按小节内的拍序数给出——节拍器页用的是同一份模型。"
    >
      <CheatsheetTable caption="六种常见拍号的每小节拍数、一拍单位与重音位置">
        <CheatsheetHead>
          <CheatsheetColumn>拍号</CheatsheetColumn>
          <CheatsheetColumn align="center">每小节拍数</CheatsheetColumn>
          <CheatsheetColumn>一拍</CheatsheetColumn>
          <CheatsheetColumn align="center">重音位置</CheatsheetColumn>
          <CheatsheetColumn>听感</CheatsheetColumn>
        </CheatsheetHead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-rule last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-normal">
                <span className="font-mono font-semibold text-ink-950">{row.label}</span>
              </th>
              <td className="px-3 py-2 text-center font-mono text-ink-700 tabular-nums">
                {row.beatsPerBar}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-ink-700">
                {beatUnitName(row.beatUnit)}
              </td>
              <td className="px-3 py-2 text-center font-mono text-ink-950 tabular-nums">
                {row.accentBeats.join(" · ")}
              </td>
              <td className="px-3 py-2 text-ink-700">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </CheatsheetTable>
    </CheatsheetSection>
  );
}
