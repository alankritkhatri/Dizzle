"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { TrendingUp, FileCheck, AlertCircle, Upload, CheckCircle, Loader, RefreshCcw } from "lucide-react"
import { API_BASE_URL } from "../lib/api"

type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error"

interface ImportJob {
  id: number
  status: string
  processed_rows: number
  total_rows: number
  percent: number
  original_filename?: string
  error?: string
}

export default function Dashboard() {
  // Stats state
  const [stats, setStats] = useState({ total_products: 0, recent_uploads: 0, active_webhooks: 0 })

  // Upload state
  const [status, setStatus] = useState<UploadStatus>("idle")
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [statusText, setStatusText] = useState("")

  // Import jobs state
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)

  // Fetch stats on mount
  useEffect(() => {
    fetchStats()
    fetchJobs()
    const interval = setInterval(() => {
      fetchJobs()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Refetch stats after successful upload
  useEffect(() => {
    if (status === "success") {
      setTimeout(() => {
        fetchStats()
      }, 1000)
    }
  }, [status])

  const fetchStats = () => {
    fetch(`${API_BASE_URL}/stats`)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(() => {})
  }

  const fetchJobs = async () => {
    setLoadingJobs(true)
    try {
      const res = await fetch(`${API_BASE_URL}/import-jobs?limit=5`)
      if (!res.ok) return
      const data = await res.json()
      // Handle both {jobs: [...]} or direct array
      const list: ImportJob[] = Array.isArray(data) ? data : data.jobs || []
      setJobs(list)
    } catch {
      // ignore errors
    } finally {
      setLoadingJobs(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
      setStatus("uploading")
      setErrorMessage("")
      try {
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch(`${API_BASE_URL}/upload-csv`, { method: "POST", body: fd })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }))
          throw new Error(err.detail || "Upload failed")
        }
        const { job_id } = await res.json()
        setStatus("processing")
        setStatusText(`Job ${job_id} started`)
        // Open WebSocket for progress
        const api = new URL(API_BASE_URL)
        const wsProto = api.protocol === "https:" ? "wss" : "ws"
        const wsHost = api.host
        const ws = new WebSocket(`${wsProto}://${wsHost}/ws/import-progress/${job_id}`)
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data)
            const processed = msg.processed || 0
            const total = msg.total || 0
            const pct = total ? Math.floor((processed / total) * 100) : 0
            setProgress(pct)
            setStatusText(msg.message || msg.status || "")
            if (msg.status === "complete") {
              ws.close()
              setStatus("success")
            } else if (msg.status === "failed") {
              ws.close()
              setErrorMessage(msg.message || "Import failed")
              setStatus("error")
            }
          } catch { }
        }
        ws.onerror = () => {
          // keep UI usable even if ws fails
          setStatusText("Tracking progress...")
        }
      } catch (err: any) {
        setErrorMessage(err?.message || "Upload failed")
        setStatus("error")
      }
    }
  }

  const handleRetry = () => {
    setStatus("idle")
    setProgress(0)
    setFileName("")
    setErrorMessage("")
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Overview and quick import for your product system</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#0f0f0f] border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Total Products</p>
              <p className="text-3xl font-bold text-foreground mt-2">{stats.total_products.toLocaleString()}</p>
            </div>
            <div className="bg-primary/10 p-3 rounded-lg">
              <TrendingUp className="text-primary" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-[#0f0f0f] border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Recent Uploads</p>
              <p className="text-3xl font-bold text-foreground mt-2">{stats.recent_uploads}</p>
            </div>
            <div className="bg-secondary/10 p-3 rounded-lg">
              <FileCheck className="text-secondary" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-[#0f0f0f] border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Active Webhooks</p>
              <p className="text-3xl font-bold text-foreground mt-2">{stats.active_webhooks}</p>
            </div>
            <div className="bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="text-destructive" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Import Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-4">Quick Import</h2>

        <div className="max-w-3xl">
          {/* Upload Area */}
          {status === "idle" && (
            <label className="block bg-[#0f0f0f] border-2 border-dashed border-border rounded-lg p-12 cursor-pointer hover:border-primary/50 transition-colors">
              <div className="flex flex-col items-center gap-4">
                <div className="bg-primary/10 p-4 rounded-lg">
                  <Upload className="text-primary" size={32} />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-foreground">Drag and drop your CSV file</p>
                  <p className="text-muted-foreground text-sm mt-1">or click to browse</p>
                </div>
                <p className="text-xs text-muted-foreground">Maximum 5GB • CSV format • Up to 500,000 records</p>
              </div>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </label>
          )}

          {/* Uploading State */}
          {(status === "uploading" || status === "processing") && (
            <div className="bg-[#0f0f0f] border border-border rounded-lg p-8">
              <div className="flex items-center gap-4 mb-6">
                <Loader className="text-secondary animate-spin" size={24} />
                <div>
                  <p className="font-medium text-foreground">{fileName}</p>
                  <p className="text-sm text-muted-foreground">{statusText || "Processing upload..."}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Parsing CSV</span>
                    <span className="text-sm font-medium text-foreground">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1 mt-6 pt-4 border-t border-border">
                  <p>• Validating records</p>
                  <p>• Checking for duplicates</p>
                  <p>• Processing SKU matching</p>
                </div>
              </div>
            </div>
          )}

          {/* Success State */}
          {status === "success" && (
            <div className="bg-[#0f0f0f] border border-primary/30 rounded-lg p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <CheckCircle className="text-primary" size={32} />
                </div>
                <div>
                  <p className="font-medium text-foreground text-lg">{fileName}</p>
                  <p className="text-sm text-primary">Import completed successfully</p>
                </div>
              </div>
              <div className="bg-primary/5 rounded-lg p-4 mt-4">
                <p className="text-sm text-foreground">
                  Products have been imported and processed. Check the stats above for updated counts.
                </p>
              </div>
              <button
                onClick={handleRetry}
                className="mt-6 w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Upload Another File
              </button>
            </div>
          )}

          {/* Error State */}
          {status === "error" && (
            <div className="bg-[#0f0f0f] border border-destructive/30 rounded-lg p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="text-destructive" size={32} />
                </div>
                <div>
                  <p className="font-medium text-foreground text-lg">Upload failed</p>
                  <p className="text-sm text-destructive">{errorMessage || "An error occurred"}</p>
                </div>
              </div>
              <button
                onClick={handleRetry}
                className="mt-6 w-full bg-destructive text-destructive-foreground py-3 rounded-lg font-medium hover:bg-destructive/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* CSV Format Guide */}
          <div className="mt-6 bg-[#0f0f0f] border border-border rounded-lg p-6">
            <h3 className="font-medium text-foreground mb-4">CSV Format Requirements</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="text-primary font-medium">Required columns:</span> sku, name, price, description
              </p>
              <p>
                <span className="text-primary font-medium">Optional columns:</span> quantity, category, active
              </p>
              <p>
                <span className="text-primary font-medium">SKU handling:</span> Case-insensitive, duplicates are
                overwritten
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Import Jobs */}
      <div className="mb-8 bg-[#0f0f0f] border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Recent Imports</h2>
          <button
            onClick={fetchJobs}
            className="flex items-center gap-2 text-xs px-3 py-1 border border-border rounded hover:bg-[#1a1a1a]"
          >
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>
        {loadingJobs && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!loadingJobs && jobs.length === 0 && (
          <p className="text-sm text-muted-foreground">No import jobs yet.</p>
        )}
        <div className="space-y-4">
          {jobs.map(job => (
            <div key={job.id} className="border border-border rounded p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-medium text-foreground">Job #{job.id} {job.original_filename && (
                  <span className="text-muted-foreground">({job.original_filename})</span>
                )}</div>
                <div
                  className={`text-xs px-2 py-1 rounded ${job.status === 'complete' ? 'bg-primary/10 text-primary' : job.status === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-secondary/10 text-secondary'}`}
                >
                  {job.status}
                </div>
              </div>
              <div className="w-full bg-[#1a1a1a] h-2 rounded overflow-hidden mb-2">
                <div
                  className={`h-full transition-all duration-500 ${job.status === 'failed' ? 'bg-destructive' : 'bg-primary'}`}
                  style={{ width: `${job.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{job.processed_rows}/{job.total_rows} rows</span>
                <span>{job.percent}%</span>
              </div>
              {job.error && <p className="text-xs text-destructive">{job.error}</p>}
              {job.status === 'failed' && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    await fetch(`${API_BASE_URL}/import-jobs/${job.id}/retry`, { method: 'POST' })
                    fetchJobs()
                  }}
                  className="mt-2"
                >
                  <button
                    type="submit"
                    className="text-xs px-2 py-1 border border-destructive text-destructive rounded hover:bg-destructive/10"
                  >
                    Retry
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Getting Started Guide */}
      <div className="bg-[#0f0f0f] border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">Getting Started</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="bg-primary/20 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
              1
            </div>
            <div>
              <p className="font-medium text-foreground">Upload a CSV file</p>
              <p className="text-sm text-muted-foreground">
                Use the Quick Import section above to upload your product CSV file with up to 500,000 records
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-primary/20 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
              2
            </div>
            <div>
              <p className="font-medium text-foreground">Monitor progress</p>
              <p className="text-sm text-muted-foreground">
                Track the import status with real-time progress indicators and WebSocket updates
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-primary/20 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
              3
            </div>
            <div>
              <p className="font-medium text-foreground">Manage your products</p>
              <p className="text-sm text-muted-foreground">
                View, edit, filter, and delete products from the Products page
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
