import type { Metadata } from "next";
import Link from "next/link";
import { libraryEntries } from "@/content/manifest";

export const metadata: Metadata = {
  title: "资料库",
};

export default function LibraryPage() {
  return (
    <main className="shell flex-1 py-8 sm:py-12">
      <header className="border-b border-rule pb-5">
        <p className="text-micro font-medium uppercase text-ink-500">Library</p>
        <h1 className="mt-2 text-display font-display text-ink-950">资料库</h1>
        <p className="mt-2 font-mono text-meta text-ink-500">
          {String(libraryEntries.length).padStart(2, "0")} MATERIAL
        </p>
      </header>

      <ul>
        {libraryEntries.map((entry) => (
          <li key={entry.href} className="border-b border-rule">
            <Link href={entry.href} className="library-material-row">
              <span>
                <strong>{entry.title}</strong>
                <small>{entry.meta}</small>
              </span>
              <span className="library-color-strip" aria-hidden="true">
                {[1, 2, 3, 4, 5, 6].map((id) => (
                  <i key={id} className={`scale-color-${id}`} />
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
