/** Shared install manifest data for the Astro endpoint and Next transition adapter. */
export const pwaManifest = {
  id: "/",
  name: "电吉他练习站",
  short_name: "练习站",
  description: "个人电吉他练习站：周练、独立练习、指板音阶与节拍器。",
  lang: "zh-CN",
  dir: "ltr",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "any",
  background_color: "#0a0d12",
  theme_color: "#0a0d12",
  categories: ["music", "education"],
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    {
      src: "/icons/icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
  shortcuts: [
    {
      name: "练习",
      short_name: "练习",
      url: "/practice",
      icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    },
    {
      name: "资料库",
      short_name: "资料库",
      url: "/library",
      icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    },
    {
      name: "节拍器",
      short_name: "节拍器",
      url: "/metronome",
      icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    },
  ],
};
