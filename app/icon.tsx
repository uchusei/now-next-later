import { ImageResponse } from "next/og"

export const size = {
  width: 512,
  height: 512,
}

export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          background: "#ffffff",
          borderRadius: 120,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 96,
            top: 92,
            width: 168,
            height: 168,
            borderRadius: 9999,
            background: "#ff3355",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 72,
            bottom: 88,
            width: 116,
            height: 116,
            borderRadius: 9999,
            background: "#ffbb00",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 96,
            bottom: 104,
            width: 84,
            height: 84,
            borderRadius: 9999,
            background: "#00bbee",
          }}
        />
      </div>
    ),
    size
  )
}
