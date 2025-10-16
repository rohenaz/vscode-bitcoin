import { Copy, Check, AlertTriangle, CheckCircle } from 'lucide-react'
import { useState } from 'react'

interface PanelHeaderProps {
  title: string
  subtitle?: string
  subtitleCopyable?: boolean
  validationStatus?: 'valid' | 'invalid' | null
  action?: {
    label: string
    onClick: () => void
  }
}

export function PanelHeader({ title, subtitle, subtitleCopyable, validationStatus, action }: PanelHeaderProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!subtitle) return
    try {
      await navigator.clipboard.writeText(subtitle)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Left side: Title and subtitle */}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && (
            <div className="mt-2 flex items-center gap-2">
              <div className="text-xs text-muted-foreground font-mono">
                <span className="opacity-60">TX:</span> {subtitle}
              </div>
              {subtitleCopyable && (
                <button
                  onClick={handleCopy}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                  title="Copy TXID"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-primary" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right side: Validation status and action */}
        <div className="flex flex-col items-end gap-2">
          {validationStatus === 'valid' && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs">
              <CheckCircle className="w-4 h-4" />
              <span>Valid Transaction</span>
            </div>
          )}
          {validationStatus === 'invalid' && (
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertTriangle className="w-4 h-4" />
              <span>Invalid Transaction</span>
            </div>
          )}
          {action && validationStatus && (
            <button
              onClick={action.onClick}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
