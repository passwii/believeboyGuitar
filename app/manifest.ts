import type { MetadataRoute } from "next";
import { pwaManifest } from "@/lib/pwa-manifest";

/** Keep the current Next transition build emitting the same shared manifest data. */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return pwaManifest as MetadataRoute.Manifest;
}
