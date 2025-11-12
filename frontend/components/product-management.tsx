"use client"

import { useState, useMemo } from "react"
import { Search, Plus, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react"

interface Product {
  id: number
  sku: string
  name: string
  price: number
  quantity: number
  active: boolean
}

const mockProducts: Product[] = [
  { id: 1, sku: "PROD-001", name: "Wireless Headphones", price: 79.99, quantity: 145, active: true },
  { id: 2, sku: "PROD-002", name: "USB-C Cable", price: 12.99, quantity: 892, active: true },
  { id: 3, sku: "PROD-003", name: "Phone Case", price: 24.99, quantity: 0, active: false },
  { id: 4, sku: "PROD-004", name: "Screen Protector", price: 9.99, quantity: 2145, active: true },
  { id: 5, sku: "PROD-005", name: "Charging Stand", price: 34.99, quantity: 67, active: true },
  { id: 6, sku: "PROD-006", name: "Keyboard", price: 89.99, quantity: 34, active: false },
]

export default function ProductManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterActive, setFilterActive] = useState<boolean | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [editingId, setEditingId] = useState<number | null>(null)
  const itemsPerPage = 5

  const filteredProducts = useMemo(() => {
    return mockProducts.filter((product) => {
      const matchesSearch =
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesActive = filterActive === null || product.active === filterActive
      return matchesSearch && matchesActive
    })
  }, [searchTerm, filterActive])

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

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
        <button className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg hover:bg-destructive/90 transition-colors">
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
              {paginatedProducts.map((product) => (
                <tr key={product.id} className="border-b border-border hover:bg-[#1a1a1a] transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{product.sku}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{product.name}</td>
                  <td className="px-6 py-4 text-sm text-foreground">${product.price.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{product.quantity}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        product.active ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {product.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-[#2a2a2a] rounded transition-colors text-muted-foreground hover:text-foreground">
                        <Edit size={18} />
                      </button>
                      <button className="p-2 hover:bg-destructive/10 rounded transition-colors text-destructive">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-[#1a1a1a]">
          <p className="text-sm text-muted-foreground">
            Showing {paginatedProducts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} products
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
                  className={`px-3 py-1 rounded text-sm ${
                    currentPage === page
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
