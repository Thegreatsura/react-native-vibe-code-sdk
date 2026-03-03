'use client'

import { cn } from '@/lib/utils'
import { Sparkles, History, Globe, MousePointer2, Mic, Server, Database, Smartphone, Zap, Plug } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

const INTEGRATION_ICONS_ROW1 = [
  "https://cdn-icons-png.flaticon.com/512/5968/5968854.png",
  "https://cdn-icons-png.flaticon.com/512/732/732221.png",
  "https://cdn-icons-png.flaticon.com/512/733/733609.png",
  "https://cdn-icons-png.flaticon.com/512/732/732084.png",
  "https://cdn-icons-png.flaticon.com/512/733/733585.png",
  "https://cdn-icons-png.flaticon.com/512/281/281763.png",
  "https://cdn-icons-png.flaticon.com/512/888/888879.png",
];

const INTEGRATION_ICONS_ROW2 = [
  "https://cdn-icons-png.flaticon.com/512/174/174857.png",
  "https://cdn-icons-png.flaticon.com/512/906/906324.png",
  "https://cdn-icons-png.flaticon.com/512/888/888841.png",
  "https://cdn-icons-png.flaticon.com/512/5968/5968875.png",
  "https://cdn-icons-png.flaticon.com/512/906/906361.png",
  "https://cdn-icons-png.flaticon.com/512/732/732190.png",
  "https://cdn-icons-png.flaticon.com/512/888/888847.png",
];

export function LandingFeatures() {
  return (
    <section className="w-full bg-background py-20 pt-[5px] md:py-32 md:pt-0 md:-top-[240px] md:relative">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        {/* Hero Headline */}
        <div className="text-center mb-2 md:mb-4 max-w-4xl m-auto">
          <h3 className="text-2xl md:text-3xl font-semibold text-foreground mb-2 leading-tight">
            Anybody can be an app creator by

            <br />
            <span className="font-bold">vibe coding ideas into mobile and web apps</span>
          </h3>
          <p className="text-muted-foreground text-md md:text-lg max-w-2xl mx-auto">
            The app agent codes for you, so you can create apps by just prompting text or using your voice.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Card 1: AI Model Selector - Full width on top */}
          <BentoCard className="md:col-span-2 p-8 md:p-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              <div className="max-w-md">
                <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-3">
                  The best code agent by default
                </h3>
                <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                  React Native Vibe Code integrates Claude Code the revolutionary coding agent that is shaking the internet. Its a magical combination. We integrated the Claude Code Agent SDK and set by default Claude Opus 4.5 the most powerful coding model on the planet. 
                </p>
              </div>
              <div className="flex flex-col gap-2 min-w-[300px]">
                <ModelOption
                  icon={<Image src="/claude-color.svg" alt="Claude" width={24} height={24} />}
                  name="Claude Opus 4.5"
                  isActive
                  defa
                />
                <ModelOption
                  icon={<Image src="/claude-color.svg" alt="Claude" width={24} height={24} />}
                  name="Claude Sonnet 4.5"
                  latest
                />
                <ModelOption
                  icon={<Image src="/claude-color.svg" alt="Claude" width={24} height={24} />}
                  name="Claude Haiku 4.5"
                  latest
                />
              </div>
            </div>
          </BentoCard>

          {/* Card 2: 98% Less Errors */}
          {/* <BentoCard className="p-8 md:p-12 flex flex-col justify-between min-h-[320px]">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <span className="text-7xl md:text-8xl lg:text-9xl font-bold text-blue-400 tracking-tight">
                  100<span className="text-5xl md:text-6xl lg:text-7xl">%</span>
                </span>
                <p className="text-2xl md:text-4xl text-muted-foreground mt-1 text-blue-400">type safe code</p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm md:text-base text-center mt-6">
              The agent type check all your code. It means it will make sure things do not break and code contracts in your code are valid. This create a robust codebase in the back less prone to errors and by itself make the agent fly without breaking the app while coding for you.
            </p>
          </BentoCard> */}

          {/* Card 3: History Backup */}
          <BentoCard className="p-8 md:p-12 flex flex-col min-h-[320px]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <History className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-foreground">
                History Backup
              </h3>
            </div>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-6">
              Rollback to any previous version you have. By default we save any change you make on each prompt but you can easily rollback if the changes do not suit you. You have 100% control and a safety net for experimenting without worries.
            </p>
            <div className="flex-1 flex items-end">
              <div className="w-full space-y-2">
                {[
                  { time: '2 min ago', label: 'Added login screen', active: true },
                  { time: '5 min ago', label: 'Updated navigation' },
                  { time: '12 min ago', label: 'Initial setup' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg border transition-colors",
                      item.active
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-muted-foreground/5 border-muted-foreground/10 hover:bg-muted-foreground/10"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        item.active ? "bg-amber-500" : "bg-muted-foreground/30"
                      )} />
                      <span className="text-sm text-foreground">{item.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </BentoCard>

          {/* Card 4: Real-time Preview */}
          <BentoCard className="p-8 md:p-12 flex flex-col min-h-[280px]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-green-500" />
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-foreground">
                Live Preview
              </h3>
            </div>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-6">
              See your iOS, Android, and web apps render in real-time as the AI builds. No waiting, no refreshing—just instant visual feedback. Native mobile preview on your phone and web app preview on the browser too.
            </p>
            <div className="flex-1 flex items-end">
              <div className="flex gap-2 w-full">
                <div className="flex-1 h-24 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">iOS</span>
                </div>
                <div className="flex-1 h-24 rounded-lg bg-gradient-to-br from-green-500/20 to-teal-500/20 border border-green-500/30 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">Android</span>
                </div>
                <div className="flex-1 h-24 rounded-lg bg-gradient-to-br from-orange-500/20 to-yellow-500/20 border border-orange-500/30 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">Web</span>
                </div>
              </div>
            </div>
          </BentoCard>

          {/* Card: Automatic Backend and Database */}
          <BentoCard className="md:col-span-2 p-8 md:p-12">
            <div className="flex flex-col items-center text-center">
              <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-3">
                Cloud: Backend and Database
              </h3>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-2xl mb-8">
                The magic of having an app that not only builds UI but also connects all the pieces to a database and backend logic. Every new app you create can get this integration by enabling the cloud option. After enabling it the code agent knows and creates fullstack apps always for you from there on.<br/> Powered by <Link className="underline" target='_blank' href="https://convex.dev">Convex.</Link>
              </p>
              <div className="flex items-center justify-center gap-4 md:gap-6">
                {/* Backend */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <Server className="w-7 h-7 text-cyan-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">Backend</span>
                </div>
                {/* Line */}
                <div className="w-8 md:w-12 h-0.5 bg-muted-foreground/30 -top-[12px] relative" />
                {/* Database */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Database className="w-7 h-7 text-emerald-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">Database</span>
                </div>
                {/* Line */}
                <div className="w-8 md:w-12 h-0.5 bg-muted-foreground/30 -top-[12px] relative" />
                {/* UI */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <Smartphone className="w-7 h-7 text-violet-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">UI</span>
                </div>
              </div>
            </div>
          </BentoCard>
{/* 60/40 Split Row */}
          <div className="md:col-span-2 flex flex-col md:flex-row gap-4 md:gap-6">
            <BentoCard className="p-8 md:p-12 flex flex-col min-h-[280px] md:w-[60%]">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-blue-500" />
                </div>
                <h3 className="text-xl md:text-2xl font-semibold text-foreground">
                  Publish to web
                </h3>
              </div>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-6">
                Make your web app go live with a custom domain on one click. Your universal app running on the web right away and then publish its native version to the app stores.
              </p>
              <div className="flex-1 flex items-end">
                <div className="w-full p-4 rounded-lg bg-muted-foreground/5 border border-muted-foreground/10">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm text-muted-foreground font-mono">http://my-amazing-app.pages.dev</span>
                  </div>
                </div>
              </div>
            </BentoCard>
            {/* Card 5: Voice Prompting */}
            <BentoCard className="p-8 md:p-12 flex flex-col min-h-[280px] md:w-[40%]">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xl md:text-2xl m-auto font-semibold text-foreground mb-3">
                  Voice Prompting
                </h3>
              </div>
              <div className="flex-1 flex items-center justify-center py-6 pb-10">
                <div className="relative flex items-center justify-center">
                  {/* Pulsing expanding circles */}
                  <div className="absolute w-20 h-20 rounded-full bg-rose-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute w-16 h-16 rounded-full bg-rose-500/30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                  <div className="absolute w-12 h-12 rounded-full bg-rose-500/40 animate-pulse" />
                  {/* Mic icon */}
                  <div className="relative w-14 h-14 rounded-full bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
                    <Mic className="w-7 h-7 text-white" />
                  </div>
                </div>
              </div>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed text-center">
                Vibe coding with your voice sets you free to very easily express your ideas, jump into the flow and let go.
              </p>
            </BentoCard>

          </div>


          {/* Card: Visual Edits */}
          <BentoCard className="md:col-span-2 p-8 md:p-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              <div className="max-w-md">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <MousePointer2 className="w-4 h-4 text-purple-500" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-semibold text-foreground">
                    Visual Edits
                  </h3>
                </div>
                <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                  Hovering and pointing at the visual element you want to change enables easy prompting. There is no need to tell the agent where to make changes, only what to change.                </p>
              </div>
              <div className="flex-1 max-w-[320px]">
                <div className="relative rounded-xl bg-muted-foreground/5 border border-muted-foreground/10 p-4">
                  {/* Mock UI with cursor */}
                  <div className="space-y-3 ">
                    <div className="h-8 w-3/4 rounded bg-muted-foreground/10" />
                    <div className="h-4 w-full rounded bg-muted-foreground/10" />
                    <div className="h-4 w-2/3 rounded bg-muted-foreground/10" />
                    <div className="relative">
                      <div className="h-10 w-24 rounded-lg bg-purple-500/20 border-2 border-purple-500 border-dashed flex items-center justify-center">
                        <span className="text-xs text-purple-400">Button</span>
                      </div>
                      <MousePointer2 className="absolute left-[110px] -bottom-2 w-5 h-5 text-purple-500 transform rotate-12 " />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </BentoCard>

          {/* 50/50 Split Row - AI and Integrations */}
          <BentoCard className="p-8 md:p-12 flex flex-col min-h-[320px]">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-500" />
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-foreground">
                AI
              </h3>
            </div>

            <div className="space-x-2 mb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                no keys needed
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                no setup needed
              </span>
            </div>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-6">
              Add GPT-4o, o3, Claude Sonnet 4, Gemini 2.5, and all the latest AI models in 1 prompt.
            </p>
            <div className="flex-1 flex items-end">
              <div className="flex gap-4 w-full justify-center">
                <div className="w-24 h-24 rounded-2xl bg-white border border-gray-300 flex items-center justify-center p-4">
                  <Image src="/claude-color.svg" alt="Anthropic Claude" width={64} height={64} className="w-full h-full object-contain" />
                </div>
                <div className="w-24 h-24 rounded-2xl bg-white border border-gray-300 flex items-center justify-center p-4">
                  <Image src="/icons/openai-svg.svg" alt="OpenAI" width={64} height={64} className="w-full h-full object-contain" />
                </div>
                <div className="w-24 h-24 rounded-2xl bg-white border border-gray-300 flex items-center justify-center p-4">
                  <Image src="/gemini-svg.png" alt="Google Gemini" width={64} height={64} className="w-full h-full object-contain" />
                </div>
              </div>
            </div>
          </BentoCard>

          <BentoCard className="p-8 md:p-12 flex flex-col min-h-[320px] overflow-hidden">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Plug className="w-4 h-4 text-orange-500" />
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-foreground">
                Integrations
              </h3>
            </div>

            <div className="space-x-2 mb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                no keys needed
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                no setup needed
              </span>
            </div>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-6">
              100s of useful APIs and libraries like Google Search, Google Maps, Resend, all built in.
            </p>
            <div className="flex-1 flex items-end relative">
              <div className="w-full overflow-hidden relative pb-2">
                {/* Row 1 - Scroll Left */}
                <div
                  className="flex gap-4 whitespace-nowrap mb-3"
                  style={{
                    animation: 'scroll-left 25s linear infinite'
                  }}
                >
                  {[...Array(3)].flatMap((_, repeatIndex) =>
                    INTEGRATION_ICONS_ROW1.map((src, i) => (
                      <div key={`${repeatIndex}-${i}`} className="h-12 w-12 flex-shrink-0 rounded-full bg-white dark:bg-gray-300 shadow-md flex items-center justify-center">
                        <Image src={src} alt="integration icon" width={32} height={32} className="h-8 w-8 object-contain" />
                      </div>
                    ))
                  )}
                </div>

                {/* Row 2 - Scroll Right */}
                <div
                  className="flex gap-4 whitespace-nowrap"
                  style={{
                    animation: 'scroll-right 25s linear infinite'
                  }}
                >
                  {[...Array(3)].flatMap((_, repeatIndex) =>
                    INTEGRATION_ICONS_ROW2.map((src, i) => (
                      <div key={`${repeatIndex}-${i}`} className="h-12 w-12 flex-shrink-0 rounded-full bg-white dark:bg-gray-300 shadow-md flex items-center justify-center">
                        <Image src={src} alt="integration icon" width={32} height={32} className="h-8 w-8 object-contain" />
                      </div>
                    ))
                  )}
                </div>

                {/* Fade overlays */}
                <div className="absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-card to-transparent pointer-events-none" />
                <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-card to-transparent pointer-events-none" />
              </div>
            </div>
            <style jsx global>{`
              @keyframes scroll-left {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              @keyframes scroll-right {
                0% { transform: translateX(-50%); }
                100% { transform: translateX(0); }
              }
            `}</style>
          </BentoCard>

        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16 md:mt-24 top-[110px] relative">
          <p className="text-muted-foreground text-sm md:text-base mb-4">
            Ready to vibe code amazing native mobile and web apps?
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background font-medium hover:opacity-90 transition-opacity"
          >
            Start Building
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}

function BentoCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(
      "rounded-2xl md:rounded-3xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow",
      className
    )}>
      {children}
    </div>
  )
}

function ModelOption({
  icon,
  name,
  isActive,
  comingSoon,
  defa,
  latest,
}: {
  icon: React.ReactNode
  name: string
  isActive?: boolean
  comingSoon?: boolean
  latest?: boolean
  defa?: boolean
}) {
  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-3 rounded-xl transition-colors",
      isActive
        ? "bg-foreground/5 border border-foreground/10"
        : "bg-muted-foreground/5 border border-transparent"
    )}>
      <div className="flex items-center gap-3">
        {icon}
        <span className={cn(
          "font-medium",
          isActive ? "text-foreground" : "text-muted-foreground"
        )}>
          {name}
        </span>
      </div>
      {latest && (
        <span className="text-xs text-muted-foreground">optional</span>
      )}
      {defa && (
        <span className="text-xs text-muted-foreground">default</span>
      )}
    </div>
  )
}



function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
