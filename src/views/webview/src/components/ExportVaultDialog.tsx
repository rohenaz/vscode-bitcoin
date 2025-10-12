import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Download, Loader2 } from 'lucide-react'
import { getVscode } from '../vscode'

interface ExportVaultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExportVaultDialog({ open, onOpenChange }: ExportVaultDialogProps) {
  const vscode = getVscode()
  const [password, setPassword] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = () => {
    if (!password.trim()) {
      setError('Password is required')
      return
    }

    setIsExporting(true)
    setError(null)

    // Send export request with password confirmation
    vscode.postMessage({
      type: 'vault:export',
      data: { password: password.trim() }
    })
  }

  const handleClose = () => {
    setPassword('')
    setError(null)
    setIsExporting(false)
    onOpenChange(false)
  }

  // Listen for export results
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data

      if (message.type === 'vault:export:error') {
        setIsExporting(false)
        setError(message.data.error || 'Export failed')
      } else if (message.type === 'vault:export:success') {
        setIsExporting(false)
        handleClose()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Vault Backup</DialogTitle>
          <DialogDescription>
            Confirm your vault password to export an encrypted backup of all your keys.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200">
              <p className="font-semibold mb-1">Important Security Information</p>
              <p>This backup will contain all your private keys encrypted with your vault password. Keep it secure and never share it.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Vault Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your vault password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isExporting) {
                  handleExport()
                }
              }}
              disabled={isExporting}
              autoFocus
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || !password.trim()}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Backup
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
