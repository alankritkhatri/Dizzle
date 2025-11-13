"use client"

import { Package, Webhook, LayoutDashboard } from "lucide-react"

interface SidebarProps {
  currentPage: string
  setCurrentPage: (page: string) => void
}

export default function Sidebar({ currentPage, setCurrentPage }: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "products", label: "Products", icon: Package },
    { id: "webhooks", label: "Webhooks", icon: Webhook },
  ]

  return (
    <aside className="w-64 bg-[#0f0f0f] border-r border-border p-6 flex flex-col">
      <div className="mb-12">
        <h1 className="text-2xl font-bold text-primary">Dizzle</h1>
        <p className="text-muted-foreground text-sm mt-1">Product Importer</p>
      </div>

      <nav className="space-y-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-[#1a1a1a] hover:text-foreground"
              }`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="pt-6 border-t border-border">
        <p className="text-xs text-muted-foreground">v1.0.0</p>
      </div>
    </aside>
  )
}
