export function EmptyLibrary() {
  return (
    <div className="mt-6 rounded-md border border-dashed border-ink-200 bg-white p-6 text-sm">
      <p className="font-medium text-ink-950">资料库还是空的</p>
      <p className="mt-2 text-ink-700">
        把原始资料放进 inbox/，整理改写后生成 content/lessons/&lt;slug&gt;.html，
        同时在 content/manifest.ts 里登记一条记录。
      </p>
    </div>
  );
}
