"use client"

import { useState } from "react"
import Sidebar from "@/components/sidebar"
import Dashboard from "@/components/dashboard"
import ProductManagement from "@/components/product-management"
import WebhookConfig from "@/components/webhook-config"

export default function Home() {
  const [currentPage, setCurrentPage] = useState("dashboard")

  const renderPage = () => {
    switch (currentPage) {
      case "products":
        return <ProductManagement />
      case "webhooks":
        return <WebhookConfig />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="flex-1 overflow-auto">{renderPage()}</main>
    </div>
  )
}
