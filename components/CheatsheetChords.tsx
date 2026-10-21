import { CheatsheetSection } from "@/components/CheatsheetSection";
import { CheatsheetColumn, CheatsheetHead, CheatsheetTable } from "@/components/CheatsheetTable";
import { chordRows } from "@/lib/cheatsheet";

/**
 * 常见和弦的指法。
 *
 * 每个和弦取「最省力的那一个音位」——由 practicalChordVoicings 推导
 * （位宽不超过 4 品、最低音是根音、同形状只留位置最低的），
 * 所以表里没有一个手抄的指法。
 */

export function CheatsheetChords() {
  const rows = chordRows();

  return (
    <CheatsheetSection
      id="chords"
      title="常见和弦的指法"
      summary="C / G / D / A / E / F 大调与 Am / Em / Dm 小调"
      hint="每行给的是一个指法，不是全部指法。根音在最低音（同度根音），位宽不超过 4 品。同一根和弦在指板上还有很多别的按法，这里只留最省力的那个。"
    >
      <CheatsheetTable caption="九个常见和弦的最省力指法与音级构成">
        <CheatsheetHead>
          <CheatsheetColumn>和弦</CheatsheetColumn>
          <CheatsheetColumn>性质</CheatsheetColumn>
          <CheatsheetColumn>音级</CheatsheetColumn>
          <CheatsheetColumn>指法</CheatsheetColumn>
        </CheatsheetHead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol} className="border-b border-rule last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-normal">
                <span className="block font-semibold text-ink-950">{row.symbol}</span>
              </th>
              <td className="px-3 py-2 whitespace-nowrap text-ink-700">{row.typeLabel}</td>
              <td className="px-3 py-2 font-mono whitespace-nowrap text-ink-700">
                {row.degreeLabels.join(" · ")}
              </td>
              <td className="px-3 py-2">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {row.voicing.map((note) => (
                    <span key={note.stringNumber} className="whitespace-nowrap">
                      <span className="font-mono text-ink-950 tabular-nums">
                        {note.stringNumber} 弦 {note.fret === 0 ? "空弦" : `${note.fret} 品`}
                      </span>
                      <span
                        className={`ml-1 font-mono ${
                          note.isRoot ? "font-semibold text-accent-700" : "text-ink-500"
                        }`}
                      >
                        {note.name}
                      </span>
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </CheatsheetTable>
    </CheatsheetSection>
  );
}
