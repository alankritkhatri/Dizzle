"use client"

import type React from "react"

import { useState } from "react"
import { Upload, CheckCircle, AlertCircle, Loader } from "lucide-react"

type UploadStatus = "idle" | "uploading" | "success" | "error"

export default function FileUpload() {
  const [status, setStatus] = useState<UploadStatus>("idle")
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
      setStatus("uploading")
      setErrorMessage("")

      // Simulate upload progress
      let currentProgress = 0
      const interval = setInterval(() => {
        currentProgress += Math.random() * 30
        if (currentProgress > 95) {
          currentProgress = 95
        }
        setProgress(Math.min(currentProgress, 100))

        if (currentProgress >= 95) {
          clearInterval(interval)
          setTimeout(() => {
            setProgress(100)
            setStatus("success")
          }, 500)
        }
      }, 300)
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
        <h1 className="text-4xl font-bold text-foreground">Import Products</h1>
        <p className="text-muted-foreground mt-2">Upload a CSV file with up to 500,000 product records</p>
      </div>

      <div className="max-w-2xl">
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
              <p className="text-xs text-muted-foreground">Maximum 500MB • CSV format</p>
            </div>
            <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          </label>
        )}

        {/* Uploading State */}
        {status === "uploading" && (
          <div className="bg-[#0f0f0f] border border-border rounded-lg p-8">
            <div className="flex items-center gap-4 mb-6">
              <Loader className="text-secondary animate-spin" size={24} />
              <div>
                <p className="font-medium text-foreground">{fileName}</p>
                <p className="text-sm text-muted-foreground">Processing upload...</p>
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
                <span className="font-semibold text-primary">247,582 products</span> imported •{" "}
                <span className="font-semibold text-primary">1,284 duplicates</span> overwritten
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
        <div className="mt-8 bg-[#0f0f0f] border border-border rounded-lg p-6">
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
  )
}
