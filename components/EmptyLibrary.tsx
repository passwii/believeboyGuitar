export function EmptyLibrary() {
  return (
    <div className="mt-6 max-w-3xl break-words text-base leading-[1.8]">
      <p className="font-medium text-ink">资料库还是空的</p>
      <p className="mt-2 text-ink-muted">
        把原始资料放进 inbox/，整理改写后生成 content/lessons/&lt;slug&gt;.html，
        同时在 content/manifest.ts 里登记一条记录。
      </p>
    </div>
  );
}
