import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getVscode } from '../vscode'
import type { KeyType } from '../types'

interface AddKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddKeyDialog({ open, onOpenChange }: AddKeyDialogProps) {
  const vscode = getVscode()
  const [activeTab, setActiveTab] = useState<'generate' | 'import' | 'shares'>('generate')
  const [keyType, setKeyType] = useState<KeyType>('wif')
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [vanityPrefix, setVanityPrefix] = useState('')
  const [designations, setDesignations] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)

  // Shares state
  const [sharesLabel, setSharesLabel] = useState('Combined Key')
  const [sharesInput, setSharesInput] = useState('')

  const isVanity = keyType === 'vanity' || keyType === 'vanity-testnet'

  // Handle paste detection - switch to import tab
  useEffect(() => {
    if (!open) return

    const handlePaste = (e: ClipboardEvent) => {
      const pastedText = e.clipboardData?.getData('text')?.trim()
      if (pastedText && pastedText.length > 10 && activeTab === 'generate') {
        setActiveTab('import')
        setValue(pastedText)
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [open, activeTab])

  // Listen for generated key
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data
      if (msg.command === 'populateGeneratedKey') {
        setValue(msg.value)
        if (msg.finalType) {
          setKeyType(msg.finalType)
        }
      }
      if (msg.command === 'vanityGenerationCompleted') {
        setGenerating(false)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleGenerate = () => {
    if (isVanity) {
      if (!vanityPrefix.trim()) {
        alert('Prefix is required for vanity keys.')
        return
      }
      setGenerating(true)
    }

    // Send vanityPrefix to backend to avoid double-prompt
    vscode.postMessage({
      command: 'generateRandomKey',
      type: keyType,
      vanityPrefix: isVanity ? vanityPrefix : undefined
    })
  }

  const handleSubmit = () => {
    if (!value.trim()) {
      alert('Key Value is required!')
      return
    }

    if (isVanity && !vanityPrefix.trim()) {
      alert('Prefix is required for vanity keys.')
      return
    }

    let metadata: Record<string, string> = {}
    let typeToSend = keyType

    if (keyType === 'wif-testnet') {
      typeToSend = 'wif'
      metadata = { network: 'testnet' }
    }

    if (isVanity) {
      typeToSend = 'wif'
      const prefix = vanityPrefix.toLowerCase().replace(/[^123456789abcdefghijkmnopqrstuvwxyz]/g, '')
      metadata = {
        vanityPrefix: prefix,
        network: keyType === 'vanity' ? 'mainnet' : 'testnet',
      }
    }

    vscode.postMessage({
      command: 'submitAddKey',
      type: typeToSend,
      value: value.trim(),
      label: label.trim() || 'Imported Key',
      metadata,
      setAsEncryption: designations.includes('encryption'),
      setAsWallet: designations.includes('wallet'),
      setAsOrdinals: designations.includes('ordinals'),
      setAsIdentity: designations.includes('identity'),
    })

    // Reset and close
    resetForm()
    onOpenChange(false)
  }

  const handleSharesSubmit = () => {
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
      label: sharesLabel.trim() || 'Combined Key',
    })

    // Reset and close
    resetForm()
    onOpenChange(false)
  }

  const resetForm = () => {
    setLabel('')
    setValue('')
    setVanityPrefix('')
    setDesignations([])
    setKeyType('wif')
    setGenerating(false)
    setSharesLabel('Combined Key')
    setSharesInput('')
    setActiveTab('generate')
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm()
      onOpenChange(open)
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Key</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'generate' | 'import' | 'shares')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="shares">Shares</TabsTrigger>
          </TabsList>

          {/* GENERATE TAB */}
          <TabsContent value="generate" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gen-keyType">Key Type</Label>
              <Select value={keyType} onValueChange={(v) => setKeyType(v as KeyType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wif">Private Key (WIF)</SelectItem>
                  <SelectItem value="wif-testnet">Private Key (WIF - Testnet)</SelectItem>
                  <SelectItem value="vanity">Vanity Address</SelectItem>
                  <SelectItem value="vanity-testnet">Vanity Address (Testnet)</SelectItem>
                  <SelectItem value="hdprivate">HD Private (xprv)</SelectItem>
                  <SelectItem value="mnemonic">Mnemonic (BIP39 phrase)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isVanity && (
              <div className="space-y-2">
                <Label htmlFor="gen-vanityPrefix">Desired Prefix</Label>
                <Input
                  id="gen-vanityPrefix"
                  value={vanityPrefix}
                  onChange={(e) => setVanityPrefix(e.target.value)}
                  maxLength={5}
                  placeholder="Prefix (1-5 base58 chars)"
                  autoFocus
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="gen-label">Label (Optional)</Label>
              <Input
                id="gen-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., My Wallet Key"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Key Designations (Optional)</Label>
              <ToggleGroup
                type="multiple"
                variant="outline"
                value={designations}
                onValueChange={setDesignations}
                className="justify-start"
              >
                <ToggleGroupItem value="encryption" className="data-[state=on]:bg-chart-5/20 data-[state=on]:text-chart-5">
                  ENC
                </ToggleGroupItem>
                <ToggleGroupItem value="wallet" className="data-[state=on]:bg-chart-3/20 data-[state=on]:text-chart-3">
                  WLT
                </ToggleGroupItem>
                <ToggleGroupItem value="ordinals" className="data-[state=on]:bg-chart-1/20 data-[state=on]:text-chart-1">
                  ORD
                </ToggleGroupItem>
                <ToggleGroupItem value="identity" className="data-[state=on]:bg-chart-2/20 data-[state=on]:text-chart-2">
                  ID
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {value && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Generated Key</Label>
                  <div className="p-3 bg-muted rounded font-mono text-xs break-all">
                    {value}
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button
                variant="secondary"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? 'Generating...' : isVanity ? 'Generate Vanity' : 'Generate'}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                {value && (
                  <Button onClick={handleSubmit}>
                    Add Key
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          {/* IMPORT TAB */}
          <TabsContent value="import" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-keyType">Key Type</Label>
              <Select value={keyType} onValueChange={(v) => setKeyType(v as KeyType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wif">Private Key (WIF)</SelectItem>
                  <SelectItem value="wif-testnet">Private Key (WIF - Testnet)</SelectItem>
                  <SelectItem value="hdprivate">HD Private (xprv)</SelectItem>
                  <SelectItem value="mnemonic">Mnemonic (BIP39 phrase)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-label">Label (Optional)</Label>
              <Input
                id="import-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., My Wallet Key"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Key Designations (Optional)</Label>
              <ToggleGroup
                type="multiple"
                variant="outline"
                value={designations}
                onValueChange={setDesignations}
                className="justify-start"
              >
                <ToggleGroupItem value="encryption" className="data-[state=on]:bg-chart-5/20 data-[state=on]:text-chart-5">
                  ENC
                </ToggleGroupItem>
                <ToggleGroupItem value="wallet" className="data-[state=on]:bg-chart-3/20 data-[state=on]:text-chart-3">
                  WLT
                </ToggleGroupItem>
                <ToggleGroupItem value="ordinals" className="data-[state=on]:bg-chart-1/20 data-[state=on]:text-chart-1">
                  ORD
                </ToggleGroupItem>
                <ToggleGroupItem value="identity" className="data-[state=on]:bg-chart-2/20 data-[state=on]:text-chart-2">
                  ID
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="import-value">Key Value</Label>
              <Input
                id="import-value"
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Paste your key here"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                Add Key
              </Button>
            </div>
          </TabsContent>

          {/* SHARES TAB */}
          <TabsContent value="shares" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shares-label">Label</Label>
              <Input
                id="shares-label"
                value={sharesLabel}
                onChange={(e) => setSharesLabel(e.target.value)}
                placeholder="Enter a label for the combined key"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shares-input">Key Shares (one per line)</Label>
              <Textarea
                id="shares-input"
                value={sharesInput}
                onChange={(e) => setSharesInput(e.target.value)}
                placeholder="Paste your key shares here, one per line"
                className="min-h-[150px] font-mono text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSharesSubmit}>
                Combine Shares
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
