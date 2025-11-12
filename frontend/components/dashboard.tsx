"use client"

import { TrendingUp, FileCheck, AlertCircle } from "lucide-react"

export default function Dashboard() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Overview of your product import system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0f0f0f] border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Total Products</p>
              <p className="text-3xl font-bold text-foreground mt-2">0</p>
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
              <p className="text-3xl font-bold text-foreground mt-2">0</p>
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
              <p className="text-3xl font-bold text-foreground mt-2">0</p>
            </div>
            <div className="bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="text-destructive" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-[#0f0f0f] border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">Getting Started</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="bg-primary/20 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
              1
            </div>
            <div>
              <p className="font-medium text-foreground">Upload a CSV file</p>
              <p className="text-sm text-muted-foreground">
                Go to Import CSV and upload your product CSV file with up to 500,000 records
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
                Track the import status with real-time progress indicators
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
