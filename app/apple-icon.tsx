import { ImageResponse } from "next/og"

export const size = {
  width: 180,
  height: 180,
}

export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          background: "#ffffff",
          borderRadius: 42,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 34,
            top: 30,
            width: 58,
            height: 58,
            borderRadius: 9999,
            background: "#ff3355",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 26,
            bottom: 28,
            width: 42,
            height: 42,
            borderRadius: 9999,
            background: "#ffbb00",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 32,
            bottom: 34,
            width: 32,
            height: 32,
            borderRadius: 9999,
            background: "#00bbee",
          }}
        />
      </div>
    ),
    size
  )
}
