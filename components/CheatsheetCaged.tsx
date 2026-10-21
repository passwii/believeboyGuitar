import { CheatsheetSection } from "@/components/CheatsheetSection";
import { CheatsheetColumn, CheatsheetHead, CheatsheetTable } from "@/components/CheatsheetTable";
import { cagedRows } from "@/lib/cheatsheet";

/**
 * CAGED 五形状。
 *
 * 基准品位不是常量：CAGED_SHAPES_BY_POSITION 由标准调弦与根音算出，
 * 所以 C → A → G → E → D 的顺序与各自的品域都是推导结果。
 */

const STRING_HEADERS = [6, 5, 4, 3, 2, 1];

export function CheatsheetCaged() {
  const rows = cagedRows();

  return (
    <CheatsheetSection
      id="caged"
      title="CAGED 五形状"
      summary="形状名、基准品位、覆盖品域与由来"
      hint="五个开放和弦形状首尾相接，把整条指板串起来。基准品位是根音所在的那一品；相邻两个形状的根音落在同一条 C 上，所以合起来正好覆盖整条指板。"
    >
      <CheatsheetTable caption="C 大调下 CAGED 五个形状的基准品位、覆盖品域与由来">
        <CheatsheetHead>
          <CheatsheetColumn>形状</CheatsheetColumn>
          <CheatsheetColumn align="center">基准品位</CheatsheetColumn>
          <CheatsheetColumn align="center">覆盖品域</CheatsheetColumn>
          <CheatsheetColumn>由来</CheatsheetColumn>
        </CheatsheetHead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-rule last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-normal">
                <span className="block font-semibold text-ink-950">{row.name} 形</span>
                <span className="mt-0.5 block text-micro text-ink-500">
                  根音 {row.rootNote} · {row.rootStringNumber} 弦
                </span>
              </th>
              <td className="px-3 py-2 text-center font-mono text-ink-950 tabular-nums">
                {row.baseFret}
              </td>
              <td className="px-3 py-2 text-center font-mono text-ink-700 tabular-nums">
                {row.minFret}–{row.maxFret}
              </td>
              <td className="px-3 py-2 text-ink-700">{row.origin}</td>
            </tr>
          ))}
        </tbody>
      </CheatsheetTable>

      <div className="mt-4">
        <CheatsheetTable caption="CAGED 五个形状在六根弦上的品位">
          <CheatsheetHead>
            <CheatsheetColumn>形状</CheatsheetColumn>
            {STRING_HEADERS.map((stringNumber) => (
              <CheatsheetColumn key={stringNumber} align="center">
                {stringNumber} 弦
              </CheatsheetColumn>
            ))}
          </CheatsheetHead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-rule last:border-0">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  <span className="whitespace-nowrap font-semibold text-ink-950">
                    {row.name} 形
                  </span>
                  <span className="mt-0.5 block text-micro text-ink-500 tabular-nums">
                    {row.baseFret} 起
                  </span>
                </th>
                {STRING_HEADERS.map((stringNumber) => {
                  const cell = row.fretsByString.find(
                    (item) => item.stringNumber === stringNumber,
                  );
                  const isRoot = cell?.fret === row.baseFret;
                  return (
                    <td key={stringNumber} className="px-2 py-2 text-center">
                      {cell && cell.fret !== null ? (
                        <span
                          className={`font-mono tabular-nums ${
                            isRoot ? "font-semibold text-accent-700" : "text-ink-950"
                          }`}
                        >
                          {cell.fret}
                        </span>
                      ) : (
                        <span className="text-micro text-ink-300" aria-hidden="true">
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
      </div>
    </CheatsheetSection>
  );
}
