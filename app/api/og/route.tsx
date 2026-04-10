import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "paytowin.cz";
  const sub = searchParams.get("sub") || "";

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px",
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: "bold",
            color: "#ffffff",
            textAlign: "center",
            marginBottom: 32,
            display: "flex",
          }}
        >
          {title}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 40,
              color: "#fbbf24",
              textAlign: "center",
              display: "flex",
            }}
          >
            {sub}
          </div>
        )}
        <div
          style={{
            fontSize: 32,
            color: "#6b7280",
            textAlign: "center",
            marginTop: 48,
            display: "flex",
          }}
        >
          paytowin.cz
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
