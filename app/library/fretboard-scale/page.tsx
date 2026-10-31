import type { Metadata } from "next";
import { FretboardScale } from "@/components/FretboardScale";

export const metadata: Metadata = {
  title: "指板音阶",
};

export default function FretboardScalePage() {
  return (
    <main className="shell flex-1 py-4 sm:py-8">
      <FretboardScale />
    </main>
  );
}
