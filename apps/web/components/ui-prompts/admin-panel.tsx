"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
  Pencil,
  Trash2,
  Plus,
  Upload,
  X,
  Eye,
  Star,
  Loader2,
} from "lucide-react"

interface UiPrompt {
  id: string
  slug: string
  title: string
  description: string
  prompt: string
  thumbnailUrl: string
  screenshotUrls: string[]
  videoPreviewUrl: string | null
  remixUrl: string | null
  tags: string[]
  viewCount: number
  featured: boolean
  createdAt: string
  updatedAt: string
}

interface FormData {
  title: string
  slug: string
  description: string
  prompt: string
  thumbnailUrl: string
  screenshotUrls: string[]
  videoPreviewUrl: string
  remixUrl: string
  tags: string
  featured: boolean
}

const emptyForm: FormData = {
  title: "",
  slug: "",
  description: "",
  prompt: "",
  thumbnailUrl: "",
  screenshotUrls: [],
  videoPreviewUrl: "",
  remixUrl: "",
  tags: "",
  featured: false,
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export function AdminPanel() {
  const [prompts, setPrompts] = useState<UiPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [allTags, setAllTags] = useState<string[]>([])

  const fetchPrompts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/ui-prompts?limit=100")
      const data = await res.json()
      setAllTags(data.tags || [])
      // Fetch full details for each prompt to get the prompt text
      const detailed = await Promise.all(
        data.prompts.map(async (p: UiPrompt) => {
          const detailRes = await fetch(`/api/ui-prompts/${p.slug}`)
          const detailData = await detailRes.json()
          return detailData.prompt
        })
      )
      setPrompts(detailed)
    } catch {
      toast.error("Failed to load prompts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "thumbnailUrl" | "screenshotUrls" | "videoPreviewUrl"
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new window.FormData()
      formData.append("file", file)

      const res = await fetch("/api/ui-prompts/upload", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Upload failed")
      }

      const data = await res.json()

      if (field === "thumbnailUrl") {
        setForm((prev) => ({ ...prev, thumbnailUrl: data.url }))
      } else if (field === "videoPreviewUrl") {
        setForm((prev) => ({ ...prev, videoPreviewUrl: data.url }))
      } else {
        setForm((prev) => ({
          ...prev,
          screenshotUrls: [...prev.screenshotUrls, data.url],
        }))
      }
      toast.success("File uploaded")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const removeScreenshot = (index: number) => {
    setForm((prev) => ({
      ...prev,
      screenshotUrls: prev.screenshotUrls.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      title: form.title,
      slug: form.slug,
      description: form.description,
      prompt: form.prompt,
      thumbnailUrl: form.thumbnailUrl,
      screenshotUrls: form.screenshotUrls,
      videoPreviewUrl: form.videoPreviewUrl || undefined,
      remixUrl: form.remixUrl || undefined,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      featured: form.featured,
    }

    try {
      if (editingSlug) {
        const res = await fetch(`/api/ui-prompts/${editingSlug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Update failed")
        }
        toast.success("Prompt updated")
      } else {
        const res = await fetch("/api/ui-prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Create failed")
        }
        toast.success("Prompt created")
      }

      setForm(emptyForm)
      setEditingSlug(null)
      setShowForm(false)
      fetchPrompts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (prompt: UiPrompt) => {
    setForm({
      title: prompt.title,
      slug: prompt.slug,
      description: prompt.description,
      prompt: prompt.prompt || "",
      thumbnailUrl: prompt.thumbnailUrl,
      screenshotUrls: prompt.screenshotUrls || [],
      videoPreviewUrl: prompt.videoPreviewUrl || "",
      remixUrl: prompt.remixUrl || "",
      tags: (prompt.tags || []).join(", "),
      featured: prompt.featured,
    })
    setEditingSlug(prompt.slug)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDelete = async (slug: string) => {
    try {
      const res = await fetch(`/api/ui-prompts/${slug}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Delete failed")
      }
      toast.success("Prompt deleted")
      fetchPrompts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    }
  }

  const handleCancel = () => {
    setForm(emptyForm)
    setEditingSlug(null)
    setShowForm(false)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            UI Prompts Admin
          </h1>
          <p className="text-muted-foreground">
            Manage the UI prompt gallery
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Prompt
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingSlug ? "Edit Prompt" : "Create New Prompt"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value
                    setForm((prev) => ({
                      ...prev,
                      title,
                      slug: editingSlug ? prev.slug : slugify(title),
                    }))
                  }}
                  placeholder="My Cool Design"
                  required
                />
              </div>

              {/* Slug */}
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder="my-cool-design"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="A short description of the prompt..."
                rows={2}
              />
            </div>

            {/* Prompt Text */}
            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt Text</Label>
              <Textarea
                id="prompt"
                value={form.prompt}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, prompt: e.target.value }))
                }
                placeholder="The AI prompt that generates this UI..."
                rows={6}
                required
                className="font-mono text-sm"
              />
            </div>

            {/* Thumbnail Upload */}
            <div className="space-y-2">
              <Label>Thumbnail</Label>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-accent transition-colors">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">
                      {uploading ? "Uploading..." : "Upload Image"}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUpload(e, "thumbnailUrl")}
                    disabled={uploading}
                  />
                </label>
                {form.thumbnailUrl && (
                  <div className="flex items-center gap-2">
                    <img
                      src={form.thumbnailUrl}
                      alt="Thumbnail preview"
                      className="h-16 w-16 rounded-md object-cover"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, thumbnailUrl: "" }))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {!form.thumbnailUrl && (
                <Input
                  value={form.thumbnailUrl}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      thumbnailUrl: e.target.value,
                    }))
                  }
                  placeholder="Or paste image URL directly..."
                  className="mt-2"
                />
              )}
            </div>

            {/* Additional Screenshots */}
            <div className="space-y-2">
              <Label>Additional Screenshots</Label>
              <div className="flex flex-wrap gap-2">
                {form.screenshotUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={url}
                      alt={`Screenshot ${i + 1}`}
                      className="h-16 w-16 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeScreenshot(i)}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="cursor-pointer">
                  <div className="h-16 w-16 rounded-md border-2 border-dashed border-border flex items-center justify-center hover:border-primary transition-colors">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUpload(e, "screenshotUrls")}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            {/* Video Preview Upload */}
            <div className="space-y-2">
              <Label>Video Preview</Label>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-accent transition-colors">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">
                      {uploading ? "Uploading..." : "Upload Video"}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    className="hidden"
                    onChange={(e) => handleUpload(e, "videoPreviewUrl")}
                    disabled={uploading}
                  />
                </label>
                {form.videoPreviewUrl && (
                  <div className="flex items-center gap-2">
                    <video
                      src={form.videoPreviewUrl}
                      className="h-16 rounded-md"
                      muted
                    />
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {form.videoPreviewUrl.split("/").pop()}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, videoPreviewUrl: "" }))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Remix URL */}
            <div className="space-y-2">
              <Label htmlFor="remixUrl">Remix URL</Label>
              <Input
                id="remixUrl"
                value={form.remixUrl}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, remixUrl: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              {/* Selected tags */}
              <div className="flex flex-wrap gap-1.5">
                {form.tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive/20 gap-1"
                      onClick={() => {
                        const current = form.tags
                          .split(",")
                          .map((t) => t.trim())
                          .filter((t) => t && t !== tag)
                        setForm((prev) => ({
                          ...prev,
                          tags: current.join(", "),
                        }))
                      }}
                    >
                      {tag}
                      <X className="h-3 w-3" />
                    </Badge>
                  ))}
              </div>
              {/* Existing tags to pick from */}
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allTags
                    .filter(
                      (tag) =>
                        !form.tags
                          .split(",")
                          .map((t) => t.trim())
                          .includes(tag)
                    )
                    .map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => {
                          const current = form.tags
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean)
                          setForm((prev) => ({
                            ...prev,
                            tags: [...current, tag].join(", "),
                          }))
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                </div>
              )}
              {/* Input for new tags */}
              <Input
                id="tags"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const val = (e.target as HTMLInputElement).value.trim()
                    if (!val) return
                    const current = form.tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                    if (!current.includes(val)) {
                      setForm((prev) => ({
                        ...prev,
                        tags: [...current, val].join(", "),
                      }))
                    }
                    ;(e.target as HTMLInputElement).value = ""
                  }
                }}
                placeholder="Type a new tag and press Enter..."
              />
            </div>

            {/* Featured Toggle */}
            <div className="flex items-center gap-3">
              <Switch
                id="featured"
                checked={form.featured}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, featured: checked }))
                }
              />
              <Label htmlFor="featured">Featured</Label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving || uploading}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingSlug ? "Update Prompt" : "Create Prompt"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Prompts Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-left p-3 font-medium">Slug</th>
                <th className="text-left p-3 font-medium">Tags</th>
                <th className="text-center p-3 font-medium">Featured</th>
                <th className="text-center p-3 font-medium">Views</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={6} className="p-3">
                      <div className="h-5 bg-muted rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : prompts.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-muted-foreground"
                  >
                    No prompts yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                prompts.map((prompt) => (
                  <tr
                    key={prompt.id}
                    className="border-b border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-3 font-medium max-w-[200px] truncate">
                      {prompt.title}
                    </td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">
                      {prompt.slug}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(prompt.tags || []).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {prompt.featured && (
                        <Star className="h-4 w-4 text-yellow-500 mx-auto fill-yellow-500" />
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {prompt.viewCount}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(prompt)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete prompt</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &quot;{prompt.title}&quot;? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(prompt.slug)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
