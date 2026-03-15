"use client"

import * as React from "react"
import { Laptop, Moon, Sun } from "lucide-react"
import { useCopy } from "@/components/language-provider"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

type ThemeOption = "system" | "light" | "dark"

const options: Array<{
  value: ThemeOption
  label: string
  badge: string
  icon: typeof Laptop
}> = [
  { value: "system", label: "Follow System", badge: "S", icon: Laptop },
  { value: "light", label: "Light Mode", badge: "L", icon: Sun },
  { value: "dark", label: "Dark Mode", badge: "D", icon: Moon },
]

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const t = useCopy()
  const [mounted, setMounted] = React.useState(false)
  const [hovered, setHovered] = React.useState<ThemeOption | null>(null)
  const [focused, setFocused] = React.useState<ThemeOption | null>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const activeTheme = (theme as ThemeOption | undefined) ?? "system"
  const localizedOptions = [
    { ...options[0], label: t.theme.system },
    { ...options[1], label: t.theme.light },
    { ...options[2], label: t.theme.dark },
  ]
  const visibleTheme = hovered ?? focused
  const activeOption =
    localizedOptions.find((option) => option.value === visibleTheme) ?? localizedOptions[0]
  const visibleIndex = Math.max(
    0,
    options.findIndex((option) => option.value === visibleTheme)
  )
  const tooltipAnchor = ["16.666%", "50%", "83.333%"][visibleIndex] ?? "50%"

  return (
    <div className="relative w-[10.5rem] sm:w-[12rem] md:w-[13.5rem]">
      <div className="relative grid grid-cols-3 rounded-[1.35rem] bg-black p-2 text-white shadow-[0_12px_32px_rgba(0,0,0,0.26)] ring-1 ring-white/10">
        {localizedOptions.map((option) => {
          const isActive = activeTheme === option.value

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              onMouseEnter={() => setHovered(option.value)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setFocused(option.value)}
              onBlur={() => setFocused(null)}
              className={cn(
                "relative z-10 flex h-9 items-center justify-center rounded-[0.95rem] transition-all duration-200 sm:h-10",
                isActive ? "bg-white/16 text-white" : "text-white/86 hover:bg-white/8"
              )}
              aria-label={option.label}
              aria-pressed={isActive}
            >
              {option.value === "dark" ? (
                <Moon className="size-4.5 sm:size-5" />
              ) : option.value === "light" ? (
                <Sun className="size-4.5 sm:size-5" />
              ) : (
                <Laptop className="size-4.5 sm:size-5" />
              )}
            </button>
          )
        })}
      </div>

      {visibleTheme ? (
        <div
          className="absolute top-[calc(100%+0.75rem)] z-20"
          style={{
            left: tooltipAnchor,
            transform: "translateX(-50%)",
          }}
        >
          <div className="relative rounded-[1rem] bg-[#ece8e2] px-4 py-2.5 text-black shadow-[0_12px_26px_rgba(0,0,0,0.18)] ring-1 ring-black/8">
            <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[0.2rem] bg-[#ece8e2] ring-1 ring-black/8" />
            <div className="relative flex items-center gap-4 whitespace-nowrap">
              <span className="text-[0.9rem] font-medium tracking-tight">{activeOption.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-[0.85rem] bg-black/8 text-sm font-semibold">
                {activeOption.badge}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
