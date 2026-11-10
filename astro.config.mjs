import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  output: "static",
  srcDir: "./astro",
  trailingSlash: "never",
  // 保持与迁移前一致的本地预览约定：3000 端口、局域网可访问。
  server: { host: true, port: 3000 },
  build: { format: "file" },
  integrations: [react()],
  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL(".", import.meta.url)),
      },
    },
  },
});
