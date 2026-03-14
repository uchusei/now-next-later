import { promises as fs } from "fs"
import os from "os"
import path from "path"

const OLLAMA_URL = "http://127.0.0.1:11434"
const modelRoot = path.join(os.homedir(), ".ollama", "models")
const logsRoot = path.join(os.homedir(), ".ollama", "logs")

interface OllamaTag {
  name: string
  size?: number
  modified_at?: string
}

interface OllamaTagsResponse {
  models?: OllamaTag[]
}

interface OllamaPsResponse {
  models?: Array<{ name: string }>
}

const preferredLocalModels = [
  "qwen3:4b",
  "gemma3:4b",
  "llama3.2:3b",
  "qwen2.5:3b",
  "phi4-mini",
]

const preferredCloudModels = [
  "glm-4.7:cloud",
  "minimax-m2.1:cloud",
  "qwen3.5:cloud",
  "gpt-oss:120b-cloud",
] as const

const walkDirectory = async (dir: string): Promise<number> => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    let total = 0

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        total += await walkDirectory(fullPath)
      } else if (entry.isFile()) {
        const stats = await fs.stat(fullPath)
        total += stats.size
      }
    }

    return total
  } catch {
    return 0
  }
}

export const formatBytes = (bytes: number) => {
  if (bytes <= 0) {
    return "0 B"
  }

  const units = ["B", "KB", "MB", "GB", "TB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

const safeFetch = async <T>(pathname: string, init?: RequestInit): Promise<T | null> => {
  try {
    const response = await fetch(`${OLLAMA_URL}${pathname}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as T
  } catch {
    return null
  }
}

export const getOllamaStatus = async () => {
  const tags = await safeFetch<OllamaTagsResponse>("/api/tags")
  const running = await safeFetch<OllamaPsResponse>("/api/ps")
  const storageBytes = await walkDirectory(modelRoot)
  const storageExists = await fs
    .access(modelRoot)
    .then(() => true)
    .catch(() => false)
  const localModels = (tags?.models ?? []).sort((left, right) => (left.size ?? 0) - (right.size ?? 0))
  const cloudModels = preferredCloudModels.map((name) => ({
    name,
    size: 0,
    sizeLabel: "Cloud",
    modifiedAt: null,
    kind: "cloud" as const,
  }))
  const models = [
    ...localModels.map((model) => ({
      name: model.name,
      size: model.size ?? 0,
      sizeLabel: formatBytes(model.size ?? 0),
      modifiedAt: model.modified_at ?? null,
      kind: "local" as const,
    })),
    ...cloudModels,
  ]
  const selectedModel =
    preferredLocalModels.find((candidate) => localModels.some((model) => model.name === candidate)) ??
    localModels[0]?.name ??
    null

  return {
    reachable: tags !== null,
    installed: tags !== null,
    selectedModel,
    modelPath: modelRoot,
    storageExists,
    storageBytes,
    storageLabel: formatBytes(storageBytes),
    localModelCount: localModels.length,
    models,
    runningModels: running?.models?.map((model) => model.name) ?? [],
  }
}

export const ollamaGenerate = async <T>({
  model,
  prompt,
  schema,
}: {
  model: string
  prompt: string
  schema: object
}): Promise<T | null> => {
  const response = await safeFetch<{ response?: string }>("/api/generate", {
    method: "POST",
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: schema,
      options: {
        temperature: 0.2,
      },
    }),
  })

  if (!response?.response) {
    return null
  }

  try {
    return JSON.parse(response.response) as T
  } catch {
    return null
  }
}

export const unloadModel = async (model: string) =>
  safeFetch("/api/generate", {
    method: "POST",
    body: JSON.stringify({
      model,
      prompt: "",
      stream: false,
      keep_alive: 0,
    }),
  })

export const deleteModel = async (model: string) =>
  safeFetch("/api/delete", {
    method: "DELETE",
    body: JSON.stringify({ model }),
  })

export const deleteAllLocalModels = async () => {
  const tags = await safeFetch<OllamaTagsResponse>("/api/tags")
  const localModels = tags?.models ?? []

  const results = await Promise.all(localModels.map((model) => deleteModel(model.name)))
  return results.every(Boolean)
}

export const clearOllamaLogs = async () => {
  try {
    await fs.rm(logsRoot, { recursive: true, force: true })
    await fs.mkdir(logsRoot, { recursive: true })
    return true
  } catch {
    return false
  }
}
