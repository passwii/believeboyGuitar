import { CheatsheetSection } from "@/components/CheatsheetSection";
import { CheatsheetColumn, CheatsheetHead, CheatsheetTable } from "@/components/CheatsheetTable";
import { scalePositionRows } from "@/lib/cheatsheet";

/**
 * C 大调七个音级在指板上的位置。
 *
 * 每一格是该音级在某根弦上的全部品位（含空弦），
 * 由 buildScaleNeckNotes 从标准调弦推出，不是手抄的音位表。
 */

const STRING_HEADERS = [6, 5, 4, 3, 2, 1];

export function CheatsheetScalePositions() {
  const rows = scalePositionRows();

  return (
    <CheatsheetSection
      id="scale-positions"
      title="C 大调音级与指板音位"
      summary="七个音级在六根弦上的全部品位与对应调式"
      hint="同一根弦上会出现不止一个品位——那是相隔一个八度的同一个音。音级 1 是主音 C，其余六个音级各自对应一个调式：从哪个音级开始，弹出的就是这个调式。"
    >
      <CheatsheetTable caption="C 大调七个音级在六根弦上的品位，以及各音级对应的调式">
        <CheatsheetHead>
          <CheatsheetColumn>音级</CheatsheetColumn>
          <CheatsheetColumn>调式</CheatsheetColumn>
          {STRING_HEADERS.map((stringNumber) => (
            <CheatsheetColumn key={stringNumber} align="center">
              {stringNumber} 弦
            </CheatsheetColumn>
          ))}
        </CheatsheetHead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.degree} className="border-b border-rule last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-normal">
                <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="font-semibold text-accent-700">{row.degree}</span>
                  <span className="font-mono text-ink-950">{row.noteName}</span>
                </span>
              </th>
              <td className="px-3 py-2">
                <span className="block whitespace-nowrap text-ink-950">{row.mode}</span>
                <span className="mt-0.5 block text-micro text-ink-500">
                  {row.modeZh} · {row.character}
                </span>
              </td>
              {STRING_HEADERS.map((stringNumber) => {
                const cell = row.fretsByString.find(
                  (item) => item.stringNumber === stringNumber,
                );
                return (
                  <td key={stringNumber} className="px-2 py-2 text-center font-mono">
                    {cell && cell.frets.length > 0 ? (
                      <span className="text-ink-950 tabular-nums">
                        {cell.frets.join(" · ")}
                      </span>
                    ) : (
                      <span className="text-ink-300" aria-hidden="true">
                        —
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </CheatsheetTable>
    </CheatsheetSection>
  );
}
