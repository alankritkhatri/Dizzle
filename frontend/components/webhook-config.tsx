"use client"

import { useState } from "react"
import { Plus, Edit, Trash2, CheckCircle, AlertCircle, Zap } from "lucide-react"

interface Webhook {
  id: number
  url: string
  events: string[]
  enabled: boolean
  lastTriggered?: string
  lastStatus?: "success" | "failed"
}

const mockWebhooks: Webhook[] = [
  {
    id: 1,
    url: "https://api.example.com/webhooks/products",
    events: ["product.created", "product.updated"],
    enabled: true,
    lastTriggered: "2 hours ago",
    lastStatus: "success",
  },
  {
    id: 2,
    url: "https://api.example.com/webhooks/inventory",
    events: ["inventory.changed"],
    enabled: true,
    lastTriggered: "1 minute ago",
    lastStatus: "success",
  },
  {
    id: 3,
    url: "https://notifications.example.com/import",
    events: ["import.completed"],
    enabled: false,
    lastTriggered: "3 days ago",
    lastStatus: "failed",
  },
]

export default function WebhookConfig() {
  const [webhooks, setWebhooks] = useState(mockWebhooks)
  const [showForm, setShowForm] = useState(false)

  const toggleWebhook = (id: number) => {
    setWebhooks(webhooks.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)))
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Webhooks</h1>
          <p className="text-muted-foreground mt-2">Configure and manage webhook endpoints</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={20} />
          Add Webhook
        </button>
      </div>

      {/* Add Webhook Form */}
      {showForm && (
        <div className="bg-[#0f0f0f] border border-border rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Create New Webhook</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Webhook URL</label>
              <input
                type="url"
                placeholder="https://api.example.com/webhook"
                className="w-full bg-[#0f0f0f] border border-border rounded-lg px-4 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Events</label>
              <div className="space-y-2">
                {["product.created", "product.updated", "product.deleted", "import.completed"].map((event) => (
                  <label key={event} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm text-foreground">{event}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg hover:bg-primary/90 transition-colors">
                Create Webhook
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-border py-2 rounded-lg hover:bg-[#1a1a1a] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhooks List */}
      <div className="space-y-4">
        {webhooks.map((webhook) => (
          <div
            key={webhook.id}
            className="bg-[#0f0f0f] border border-border rounded-lg p-6 hover:border-border/80 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="bg-secondary/10 p-2 rounded">
                    <Zap className="text-secondary" size={20} />
                  </div>
                  <div>
                    <p className="font-mono text-sm text-foreground break-all">{webhook.url}</p>
                    <p className="text-xs text-muted-foreground mt-1">{webhook.events.join(", ")}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-[#1a1a1a] rounded transition-colors text-muted-foreground hover:text-foreground">
                  <Edit size={18} />
                </button>
                <button className="p-2 hover:bg-destructive/10 rounded transition-colors text-destructive">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleWebhook(webhook.id)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      webhook.enabled ? "bg-primary" : "bg-[#1a1a1a]"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        webhook.enabled ? "right-1" : "left-1"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-foreground">{webhook.enabled ? "Enabled" : "Disabled"}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Last Triggered</p>
                <p className="text-sm text-foreground">{webhook.lastTriggered || "-"}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Last Status</p>
                <div className="flex items-center gap-2">
                  {webhook.lastStatus === "success" ? (
                    <>
                      <CheckCircle size={16} className="text-primary" />
                      <span className="text-sm text-primary">Success</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} className="text-destructive" />
                      <span className="text-sm text-destructive">Failed</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button className="mt-4 w-full text-sm py-2 border border-border rounded hover:bg-[#1a1a1a] transition-colors text-muted-foreground hover:text-foreground">
              Send Test Webhook
            </button>
          </div>
        ))}
      </div>

      {webhooks.length === 0 && (
        <div className="text-center py-12 bg-[#0f0f0f] border border-border rounded-lg">
          <p className="text-muted-foreground mb-4">No webhooks configured yet</p>
          <button onClick={() => setShowForm(true)} className="text-primary hover:text-primary/80">
            Create your first webhook
          </button>
        </div>
      )}
    </div>
  )
}
