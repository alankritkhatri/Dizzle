"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, Plus, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { API_BASE_URL } from "../lib/api"

interface ApiProduct {
  id: number
  sku: string
  name: string
  price_cents?: number | null
  description?: string | null
  active: boolean
}

interface ApiListResponse {
  total: number
  page: number
  per_page: number
  items: ApiProduct[]
}

export default function ProductManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterActive, setFilterActive] = useState<boolean | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [editingId, setEditingId] = useState<number | null>(null)
  const itemsPerPage = 50
  const [items, setItems] = useState<ApiProduct[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<number | null>(null)

  const fetchProducts = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL(`${API_BASE_URL}/products`)
      if (searchTerm) url.searchParams.set("q", searchTerm)
      if (filterActive !== null) url.searchParams.set("active", String(filterActive))
      url.searchParams.set("page", String(currentPage))
      url.searchParams.set("per_page", String(itemsPerPage))
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(await res.text())
      const data: ApiListResponse = await res.json()
      setItems(data.items)
      setTotal(data.total)
    } catch (e: any) {
      setError(e?.message || "Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterActive, currentPage])

  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage))
  const paginatedProducts = items

  const onBulkDelete = async () => {
    if (!confirm("Are you sure? This cannot be undone.")) return
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/products?confirm=true`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
      await fetchProducts()
    } catch (e: any) {
      alert(e?.message || "Failed to delete")
    } finally {
      setLoading(false)
    }
  }

  const onDeleteProduct = async (id: number) => {
    if (!confirm("Delete this product?")) return
    try {
      setPendingId(id)
      const res = await fetch(`${API_BASE_URL}/products/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
      await fetchProducts()
    } catch (e: any) {
      alert(e?.message || "Failed to delete")
    } finally {
      setPendingId(null)
    }
  }

  const onEditProduct = (product: ApiProduct) => {
    const sku = prompt("SKU:", product.sku)
    if (!sku) return
    const name = prompt("Name:", product.name)
    if (!name) return
    const priceStr = prompt("Price (cents):", String(product.price_cents || 0))
    const price_cents = priceStr ? parseInt(priceStr) : 0
    const description = prompt("Description:", product.description || "") || ""
    const activeStr = prompt("Active (true/false):", String(product.active))
    const active = activeStr === "true"

    fetch(`${API_BASE_URL}/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, name, description, price_cents, active })
    })
      .then(res => {
        if (!res.ok) throw new Error("Update failed")
        return fetchProducts()
      })
      .catch(e => alert(e.message))
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground mt-2">Manage all imported products</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
          <Plus size={20} />
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search size={20} className="absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by SKU or name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full bg-[#0f0f0f] border border-border rounded-lg pl-10 pr-4 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={filterActive === null ? "" : filterActive ? "active" : "inactive"}
          onChange={(e) => {
            if (e.target.value === "") setFilterActive(null)
            else setFilterActive(e.target.value === "active")
            setCurrentPage(1)
          }}
          className="bg-[#0f0f0f] border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button disabled={loading} onClick={onBulkDelete} className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          Delete All
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-[#0f0f0f] border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">SKU</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">Price</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">Quantity</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-muted-foreground">Loading...</td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-destructive">{error}</td>
                </tr>
              )}
              {!loading && !error && paginatedProducts.map((product) => (
                <tr key={product.id} className="border-b border-border hover:bg-[#1a1a1a] transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{product.sku}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{product.name}</td>
                  <td className="px-6 py-4 text-sm text-foreground">${((product.price_cents || 0) / 100).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-foreground">-</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${product.active ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                        }`}
                    >
                      {product.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button onClick={() => onEditProduct(product)} className="p-2 hover:bg-[#2a2a2a] rounded transition-colors text-muted-foreground hover:text-foreground">
                        <Edit size={18} />
                      </button>
                      <button disabled={pendingId === product.id} onClick={() => onDeleteProduct(product.id)} className="p-2 hover:bg-destructive/10 rounded transition-colors text-destructive disabled:opacity-50 disabled:cursor-not-allowed">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !error && paginatedProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No products found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-[#1a1a1a]">
          <p className="text-sm text-muted-foreground">
            Showing {paginatedProducts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{" "}
            {Math.min(currentPage * itemsPerPage, total)} of {total} products
          </p>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="p-2 border border-border rounded hover:bg-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded text-sm ${currentPage === page
                      ? "bg-primary text-primary-foreground"
                      : "border border-border hover:bg-[#2a2a2a]"
                    }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              className="p-2 border border-border rounded hover:bg-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
