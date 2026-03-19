import { NextResponse } from "next/server"

const SERVER_AI_DISABLED_MESSAGE =
  "Server AI routes are disabled on the public deployment. Use built-in logic or connect local Ollama from this device."

export const isServerAiRouteEnabled = () =>
  process.env.NODE_ENV !== "production" || process.env.ENABLE_SERVER_AI_ROUTES === "true"

export const createServerAiDisabledResponse = () =>
  NextResponse.json({ error: SERVER_AI_DISABLED_MESSAGE }, { status: 403 })

export const createServerAiDisabledStatus = () =>
  NextResponse.json({
    reachable: false,
    installed: false,
    selectedModel: null,
    modelPath: "~/.ollama/models",
    storageExists: false,
    storageBytes: 0,
    storageLabel: "Unavailable on hosted server",
    localModelCount: 0,
    models: [],
    runningModels: [],
  })
