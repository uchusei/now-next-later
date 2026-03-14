import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { deleteModel, unloadModel } from "@/lib/ollama"

const requestSchema = z.object({
  model: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const parsed = requestSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid model request." }, { status: 400 })
  }

  const result = await unloadModel(parsed.data.model)

  if (!result) {
    return NextResponse.json({ error: "Could not unload the model." }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const parsed = requestSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid model request." }, { status: 400 })
  }

  const result = await deleteModel(parsed.data.model)

  if (!result) {
    return NextResponse.json({ error: "Could not delete the model." }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
