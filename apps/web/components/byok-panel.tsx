'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, X, KeyRound } from 'lucide-react'

const STORAGE_KEY = 'byok_anthropic_key'
const MOONSHOT_STORAGE_KEY = 'byok_moonshot_key'

interface ByokPanelProps {
  onClose: () => void
}

function KeySection({
  label,
  storageKey,
  placeholder,
}: {
  label: string
  storageKey: string
  placeholder?: string
}) {
  const [key, setKey] = useState('')
  const [savedKey, setSavedKey] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored) setSavedKey(stored)
  }, [storageKey])

  function handleSave() {
    if (!key.trim()) return
    localStorage.setItem(storageKey, key.trim())
    setSavedKey(key.trim())
    setKey('')
  }

  function handleRemove() {
    localStorage.removeItem(storageKey)
    setSavedKey(null)
  }

  if (savedKey) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Alert className="border-green-400/50 bg-green-50 dark:bg-green-900/20 justify-center">
          <AlertDescription className="text-green-700 dark:text-green-300 items-center flex flex-row">
            <CheckCircle2 className="h-4 w-4 text-green-600 mr-2 shrink-0" />
            Key is active
          </AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={handleRemove} className="w-full">
          <X className="h-4 w-4 mr-2" />
          Remove Key
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={storageKey}>{label}</Label>
      <Input
        id={storageKey}
        type="password"
        autoComplete="off"
        placeholder={placeholder}
        value={key}
        onChange={e => setKey(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
      />
      <Button onClick={handleSave} disabled={!key.trim()} size="sm" className="w-full">
        Save Key
      </Button>
    </div>
  )
}

export function ByokPanel({ onClose }: ByokPanelProps) {
  const [usage, setUsage] = useState<{ sessionsUsed: number; sessionLimit: number; hoursUsed: number; hoursLimit: number } | null>(null)
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false)

  useEffect(() => {
    setHasAnthropicKey(!!localStorage.getItem(STORAGE_KEY))
  }, [])

  useEffect(() => {
    if (!hasAnthropicKey) return
    fetch('/api/byok/usage')
      .then(r => r.json())
      .then(data => setUsage(data))
      .catch(() => {})
  }, [hasAnthropicKey])

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center gap-2 pt-2">
        <KeyRound className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Bring Your Own Key</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Add your API keys to use the service without a subscription. Keys are stored locally in your browser and never saved on our servers.
      </p>

      <div className="space-y-4">
        <KeySection
          label="Anthropic API Key"
          storageKey={STORAGE_KEY}
          placeholder="sk-ant-..."
        />

        <KeySection
          label="Moonshot API Key (Kimi K2)"
          storageKey={MOONSHOT_STORAGE_KEY}
          placeholder="sk-..."
        />
      </div>

      {usage && hasAnthropicKey && (
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-sm font-medium">Free Sandbox Usage</p>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Sessions used</span>
            <span>{usage.sessionsUsed} / {usage.sessionLimit}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${Math.min((usage.sessionsUsed / usage.sessionLimit) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {usage.hoursUsed}h / {usage.hoursLimit}h used ({usage.sessionLimit - usage.sessionsUsed} sessions remaining)
          </p>
        </div>
      )}
    </div>
  )
}
