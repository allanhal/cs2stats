import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/$", "/matches", "/players", "/hall", "/cartinhas"],
        disallow: [
          "/api/",
          "/admin",
          "/conta",
          "/upload",
          "/players/*/cartinha",
          "/cartinhas/*/image",
        ],
      },
    ],
  };
}
