import type { MetadataRoute } from "next";
import { PLATFORM_DESCRIPTION, PLATFORM_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PLATFORM_NAME,
    short_name: PLATFORM_NAME,
    description: PLATFORM_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16a34a",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
    ],
  };
}
