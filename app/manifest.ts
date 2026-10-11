import type { MetadataRoute } from "next";

/** ReqGen v4 — installable app details (IET name, colours and logo). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ReqGen — Islamic Education Trust",
    short_name: "ReqGen",
    description: "Islamic Education Trust request, approval and payment voucher records.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F5F7FB",
    theme_color: "#B83E00",
    icons: [
      { src: "/v4/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/v4/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/v4/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
