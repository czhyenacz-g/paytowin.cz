import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/dev/", "/auth/"] },
    sitemap: "https://paytowin.cz/sitemap.xml",
  };
}
