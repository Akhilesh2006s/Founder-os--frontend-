import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Simple tab icon so `/favicon.ico` requests aren’t delegated to missing static files on some hosts. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0c0c0c",
          color: "#c9a962",
          fontSize: 20,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif"
        }}
      >
        F
      </div>
    ),
    size
  );
}
