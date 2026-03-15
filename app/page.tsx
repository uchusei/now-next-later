"use client"

import FocusBoard from "@/components/focus-board"
import { useCopy } from "@/components/language-provider"
import { LanguagePicker } from "@/components/language-picker"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Home() {
  const t = useCopy()

  return (
    <main className="relative min-h-screen bg-background px-4 py-5 text-foreground md:px-10">
      <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2 md:left-auto md:right-10 md:top-5 md:translate-x-0">
        <div className="pointer-events-auto flex items-start gap-2 md:gap-3">
          <ThemeToggle />
          <LanguagePicker />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-6xl justify-end gap-3 opacity-0">
        <ThemeToggle />
        <LanguagePicker />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 py-20 md:py-2">
        <section className="max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-muted-foreground">
            {t.hero.eyebrow}
          </p>
          <h1 className="mt-2 text-balance text-[3rem] font-semibold tracking-tight sm:text-[3.4rem] md:text-6xl">
            {t.hero.title}
          </h1>
          <p className="mt-2 text-pretty text-base leading-8 text-muted-foreground md:text-lg">
            {t.hero.description}
          </p>
        </section>
        <FocusBoard />
        <footer className="w-full border-t border-border/60 pt-6 text-center text-sm text-muted-foreground">
          <p>
            Built by{" "}
            <a
              className="underline underline-offset-4 transition-colors hover:text-foreground"
              href="https://github.com/uchusei"
              target="_blank"
              rel="noreferrer"
            >
              uchusei
            </a>
            {" "}under{" "}
            <a
              className="underline underline-offset-4 transition-colors hover:text-foreground"
              href="https://wowen.se"
              target="_blank"
              rel="noreferrer"
            >
              WOWEN
            </a>
            . The source code is available on{" "}
            <a
              className="underline underline-offset-4 transition-colors hover:text-foreground"
              href="https://github.com/uchusei/now-next-later"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            .
          </p>
        </footer>
      </div>
    </main>
  )
}
