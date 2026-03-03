"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PromptCard } from "@/components/ui-prompts/prompt-card"

interface PromptData {
  id: string
  slug: string
  title: string
  description: string
  thumbnailUrl: string
  tags: string[]
  viewCount: number
  featured: boolean
  remixUrl: string | null
  createdAt: string
}

interface ApiResponse {
  prompts: PromptData[]
  total: number
  page: number
  limit: number
  totalPages: number
  tags: string[]
}

export function PromptGallery() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [activeTag, setActiveTag] = useState(searchParams.get("tag") || "")
  const [sort, setSort] = useState<"latest" | "popular">(
    (searchParams.get("sort") as "latest" | "popular") || "latest"
  )
  const [page, setPage] = useState(
    parseInt(searchParams.get("page") || "1", 10)
  )
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateUrl = useCallback(
    (params: {
      search?: string
      tag?: string
      sort?: string
      page?: number
    }) => {
      const newParams = new URLSearchParams()
      const s = params.search ?? search
      const t = params.tag ?? activeTag
      const so = params.sort ?? sort
      const p = params.page ?? page

      if (s) newParams.set("search", s)
      if (t) newParams.set("tag", t)
      if (so !== "latest") newParams.set("sort", so)
      if (p > 1) newParams.set("page", String(p))

      const qs = newParams.toString()
      router.replace(`/ui-prompts${qs ? `?${qs}` : ""}`, { scroll: false })
    },
    [router, search, activeTag, sort, page]
  )

  const fetchPrompts = useCallback(
    async (params: {
      search: string
      tag: string
      sort: string
      page: number
    }) => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        if (params.search) qs.set("search", params.search)
        if (params.tag) qs.set("tag", params.tag)
        qs.set("sort", params.sort)
        qs.set("page", String(params.page))

        const res = await fetch(`/api/ui-prompts?${qs.toString()}`)
        if (!res.ok) throw new Error("Failed to fetch")
        const json: ApiResponse = await res.json()
        setData(json)
      } catch (error) {
        console.error("Error fetching prompts:", error)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Fetch on mount and when sort/tag/page change
  useEffect(() => {
    fetchPrompts({ search, tag: activeTag, sort, page })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTag, sort, page])

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setPage(1)
      updateUrl({ search: value, page: 1 })
      fetchPrompts({ search: value, tag: activeTag, sort, page: 1 })
    }, 300)
  }

  const handleTagChange = (tag: string) => {
    const newTag = tag === "All" ? "" : tag
    setActiveTag(newTag)
    setPage(1)
    updateUrl({ tag: newTag, page: 1 })
  }

  const handleSortChange = (newSort: "latest" | "popular") => {
    setSort(newSort)
    setPage(1)
    updateUrl({ sort: newSort, page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    updateUrl({ page: newPage })
  }

  return (
    <div className="space-y-8">
      {/* Search Bar */}
      <div className="relative max-w-[500px] mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search prompts..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Sort Buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant={sort === "latest" ? "default" : "outline"}
          size="sm"
          onClick={() => handleSortChange("latest")}
        >
          Latest
        </Button>
        <Button
          variant={sort === "popular" ? "default" : "outline"}
          size="sm"
          onClick={() => handleSortChange("popular")}
        >
          Most Popular
        </Button>
      </div>

      {/* Tag Pills */}
      {data?.tags && data.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleTagChange("All")}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              activeTag === ""
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            All
          </button>
          {data.tags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagChange(tag)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                activeTag === tag
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        /* Loading Skeleton */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4 animate-pulse"
            >
              <div className="flex justify-center mb-4">
                <div className="w-[200px] h-[360px] rounded-2xl bg-muted" />
              </div>
              <div className="h-5 bg-muted rounded w-3/4 mb-2" />
              <div className="h-4 bg-muted rounded w-full mb-1" />
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="flex gap-2 mt-3">
                <div className="h-5 w-14 bg-muted rounded-full" />
                <div className="h-5 w-14 bg-muted rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : data && data.prompts.length > 0 ? (
        /* Prompt Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data.prompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              slug={prompt.slug}
              title={prompt.title}
              description={prompt.description}
              thumbnailUrl={prompt.thumbnailUrl}
              tags={prompt.tags}
              featured={prompt.featured}
              viewCount={prompt.viewCount}
              remixUrl={prompt.remixUrl}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground text-lg mb-2">No prompts found</p>
          <p className="text-muted-foreground/60 text-sm">
            Try adjusting your search or filters.
          </p>
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
