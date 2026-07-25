"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FilmSlateIcon,
  HouseIcon,
  ImagesIcon,
  GearSixIcon,
  FlowArrowIcon,
  ScrollIcon,
  TextAlignLeftIcon,
  ImageSquareIcon,
  VideoCameraIcon,
  TagIcon,
  ListIcon,
  XIcon,
} from "@phosphor-icons/react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { AGENTS } from "@/lib/agents/registry"

const AGENT_ICONS: Record<string, React.ComponentType<{ className?: string; weight?: "bold" | "fill" }>> = {
  "storyboard-generator": ScrollIcon,
  "image-prompt-extractor": TextAlignLeftIcon,
  "image-generator": ImageSquareIcon,
  "video-prompt-extractor": VideoCameraIcon,
  "post-processing": TagIcon,
}

const WORKSPACE_LINKS = [
  { href: "/", label: "Overview", icon: HouseIcon },
  { href: "/pipeline", label: "Pipeline", icon: FlowArrowIcon },
  { href: "/gallery", label: "Gallery", icon: ImagesIcon },
  { href: "/settings", label: "Settings", icon: GearSixIcon },
]

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string; weight?: "bold" | "fill" }>
  active: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" weight={active ? "fill" : "bold"} />
      <span className="truncate">{label}</span>
    </Link>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <FilmSlateIcon className="size-4" weight="fill" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">MoneyPrinter</p>
          <p className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">Studio</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
        <div className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
            Workspace
          </p>
          {WORKSPACE_LINKS.map((link) => (
            <NavLink
              key={link.href}
              {...link}
              active={link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
            Agents
          </p>
          {AGENTS.map((agent) => {
            const Icon = AGENT_ICONS[agent.id] ?? ScrollIcon
            const href = `/agents/${agent.id}`
            return (
              <NavLink
                key={agent.id}
                href={href}
                label={agent.name}
                icon={Icon}
                active={pathname.startsWith(href)}
                onNavigate={onNavigate}
              />
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b bg-sidebar px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FilmSlateIcon className="size-3.5" weight="fill" />
          </div>
          <span className="text-sm font-semibold tracking-tight">MoneyPrinter Studio</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent"
        >
          {mobileOpen ? <XIcon className="size-5" weight="bold" /> : <ListIcon className="size-5" weight="bold" />}
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-b bg-sidebar md:hidden">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-sidebar md:block">
        <div className="sticky top-0 h-svh">
          <SidebarContent />
        </div>
      </aside>
    </>
  )
}
