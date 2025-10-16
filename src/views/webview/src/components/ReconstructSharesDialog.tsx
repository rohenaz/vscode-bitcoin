import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getVscode } from '../vscode'

interface ReconstructSharesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReconstructSharesDialog({ open, onOpenChange }: ReconstructSharesDialogProps) {
  const vscode = getVscode()
  const [label, setLabel] = useState('Combined Key')
  const [sharesInput, setSharesInput] = useState('')

  const handleSubmit = () => {
    const shares = sharesInput
      .split(/\r?\n|\r/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('#'))

    if (shares.length < 2) {
      vscode.postMessage({
        command: 'showError',
        text: 'At least 2 key shares are required',
      })
      return
    }

    vscode.postMessage({
      command: 'reconstructFromKeyShares',
      shares,
      label: label.trim() || 'Combined Key',
    })

    // Reset and close
    setLabel('Combined Key')
    setSharesInput('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Combine Key Shares</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sharesLabel">Label</Label>
            <Input
              id="sharesLabel"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter a label for the combined key"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sharesInput">Key Shares (one per line)</Label>
            <Textarea
              id="sharesInput"
              value={sharesInput}
              onChange={(e) => setSharesInput(e.target.value)}
              placeholder="Paste your key shares here, one per line"
              className="min-h-[150px] font-mono text-xs"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Combine
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
