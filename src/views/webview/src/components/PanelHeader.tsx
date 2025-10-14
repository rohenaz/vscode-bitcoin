interface PanelHeaderProps {
  title: string
  subtitle?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function PanelHeader({ title, subtitle, action }: PanelHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{title}</h1>
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1 rounded hover:bg-accent"
          >
            {action.label}
          </button>
        )}
      </div>
      {subtitle && (
        <div className="mt-2 text-xs text-muted-foreground font-mono truncate">
          <span className="opacity-60">TX:</span> {subtitle}
        </div>
      )}
    </div>
  )
}
