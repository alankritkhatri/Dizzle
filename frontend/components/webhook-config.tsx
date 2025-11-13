"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, CheckCircle, AlertCircle, Zap } from "lucide-react"
import { API_BASE_URL } from "../lib/api"

interface Webhook {
  id: number
  url: string
  event: string
  enabled: boolean
  created_at: string
}

interface WebhookGroup {
  id: number
  url: string
  events: string[]
  enabled: boolean
}

export default function WebhookConfig() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formUrl, setFormUrl] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])

  const fetchWebhooks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/webhooks`)
      const data = await res.json()
      setWebhooks(data)
    } catch {}
  }

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const groupedWebhooks = webhooks.reduce((acc, w) => {
    const existing = acc.find(g => g.url === w.url)
    if (existing) {
      existing.events.push(w.event)
      if (!w.enabled) existing.enabled = false
    } else {
      acc.push({ id: w.id, url: w.url, events: [w.event], enabled: w.enabled })
    }
    return acc
  }, [] as WebhookGroup[])

  const toggleWebhook = async (url: string) => {
    const group = webhooks.filter(w => w.url === url)
    const newEnabled = !group[0]?.enabled
    await Promise.all(group.map(w =>
      fetch(`${API_BASE_URL}/webhooks/${w.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newEnabled })
      })
    ))
    fetchWebhooks()
  }

  const deleteWebhook = async (url: string) => {
    if (!confirm("Delete this webhook?")) return
    const group = webhooks.filter(w => w.url === url)
    await Promise.all(group.map(w => fetch(`${API_BASE_URL}/webhooks/${w.id}`, { method: "DELETE" })))
    fetchWebhooks()
  }

  const testWebhook = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/webhooks/${id}/test`, { method: "POST" })
      const data = await res.json()
      alert(data.success ? `Success: ${data.status}` : `Failed: ${data.error || data.status}`)
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    }
  }

  const createWebhook = async () => {
    if (!formUrl || selectedEvents.length === 0) {
      alert("Please enter URL and select events")
      return
    }
    try {
      await fetch(`${API_BASE_URL}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: formUrl, events: selectedEvents, enabled: true })
      })
      setFormUrl("")
      setSelectedEvents([])
      setShowForm(false)
      fetchWebhooks()
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    }
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

      {showForm && (
        <div className="bg-[#0f0f0f] border border-border rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Create New Webhook</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Webhook URL</label>
              <input
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://api.example.com/webhook"
                className="w-full bg-[#0f0f0f] border border-border rounded-lg px-4 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Events</label>
              <div className="space-y-2">
                {["product.created", "product.updated", "product.deleted", "import.completed"].map((event) => (
                  <label key={event} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEvents([...selectedEvents, event])
                        } else {
                          setSelectedEvents(selectedEvents.filter(ev => ev !== event))
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-foreground">{event}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createWebhook} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg hover:bg-primary/90 transition-colors">
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

      <div className="space-y-4">
        {groupedWebhooks.map((group) => (
          <div
            key={group.id}
            className="bg-[#0f0f0f] border border-border rounded-lg p-6 hover:border-border/80 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="bg-secondary/10 p-2 rounded">
                    <Zap className="text-secondary" size={20} />
                  </div>
                  <div>
                    <p className="font-mono text-sm text-foreground break-all">{group.url}</p>
                    <p className="text-xs text-muted-foreground mt-1">{group.events.join(", ")}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => deleteWebhook(group.url)} className="p-2 hover:bg-destructive/10 rounded transition-colors text-destructive">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleWebhook(group.url)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      group.enabled ? "bg-primary" : "bg-[#1a1a1a]"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        group.enabled ? "right-1" : "left-1"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-foreground">{group.enabled ? "Enabled" : "Disabled"}</span>
                </div>
              </div>

              <div>
                <button onClick={() => testWebhook(group.id)} className="w-full text-sm py-2 border border-border rounded hover:bg-[#1a1a1a] transition-colors text-muted-foreground hover:text-foreground">
                  Send Test Webhook
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {groupedWebhooks.length === 0 && (
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
