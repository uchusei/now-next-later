"use client"

import * as React from "react"
import { Check, Globe } from "lucide-react"
import { useCopy, useLanguage, type AppLanguage } from "@/components/language-provider"
import { cn } from "@/lib/utils"

const options: Array<{ value: AppLanguage; short: string }> = [
  { value: "en", short: "EN" },
  { value: "sv", short: "SV" },
]

export function LanguagePicker() {
  const { language, setLanguage } = useLanguage()
  const t = useCopy()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (!(target instanceof Node)) return
      const root = document.getElementById("language-picker-root")
      if (root && !root.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointer)
    return () => document.removeEventListener("mousedown", handlePointer)
  }, [])

  return (
    <div id="language-picker-root" className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-black text-white shadow-[0_12px_32px_rgba(0,0,0,0.26)] ring-1 ring-white/10 transition-all hover:bg-black/95 sm:h-14 sm:w-14 sm:rounded-[1.35rem]"
        aria-label={t.language.label}
        aria-expanded={open}
      >
        <Globe className="size-4.5 sm:size-5" />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-40 rounded-[1rem] bg-[#ece8e2] p-2 text-black shadow-[0_12px_26px_rgba(0,0,0,0.18)] ring-1 ring-black/8 sm:w-44">
          {options.map((option) => {
            const active = language === option.value
            const label = option.value === "en" ? t.language.english : t.language.swedish

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setLanguage(option.value)
                  setOpen(false)
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-[0.9rem] px-3 py-2 text-left text-sm transition-colors",
                  active ? "bg-black text-white" : "hover:bg-black/6"
                )}
              >
                <span>{label}</span>
                <span className="flex items-center gap-2">
                  <span className={cn("text-xs font-semibold", active ? "text-white/75" : "text-black/45")}>
                    {option.short}
                  </span>
                  {active ? <Check className="size-4" /> : null}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
