import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/dev/", "/auth/", "/game/", "/local/"] },
    sitemap: "https://startovnipole.cz/sitemap.xml",
  };
}
