import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Badge } from '@/components/ui/badge'
import { getVscode } from '../vscode'
import type { KeyType } from '../types'
import { PrivateKey, Mnemonic, HD } from '@bsv/sdk'

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
  const canHaveDesignations = keyType === 'wif' || keyType === 'vanity'

  // Auto-detect key type from value
  const detectKeyType = (val: string): KeyType => {
    if (!val.trim()) return 'wif'

    try {
      // Check if it's a mnemonic (BIP39 phrase)
      if (val.includes(' ')) {
        const words = val.trim().split(/\s+/)
        if (words.length >= 12 && words.length <= 24) {
          return 'mnemonic'
        }
      }

      // Check if it's HD key (xprv/xpub)
      if (val.startsWith('xprv') || val.startsWith('tprv')) {
        return 'hdprivate'
      }

      // Check if it's WIF (starts with 5, K, L for mainnet, or c, 9 for testnet)
      if (val.length >= 51 && val.length <= 52) {
        if (val.startsWith('5') || val.startsWith('K') || val.startsWith('L')) {
          return 'wif'
        }
        if (val.startsWith('c') || val.startsWith('9')) {
          return 'wif-testnet'
        }
      }

      return 'wif'
    } catch (e) {
      return 'wif'
    }
  }

  // Handle paste detection - switch to import tab
  useEffect(() => {
    if (!open) return

    const handlePaste = (e: ClipboardEvent) => {
      const pastedText = e.clipboardData?.getData('text')?.trim()
      if (pastedText && pastedText.length > 10 && activeTab === 'generate') {
        setActiveTab('import')
        setValue(pastedText)
        setKeyType(detectKeyType(pastedText))
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [open, activeTab])

  // Auto-detect type when value changes in import tab
  useEffect(() => {
    if (activeTab === 'import' && value) {
      const detectedType = detectKeyType(value)
      setKeyType(detectedType)

      // Clear designations if the detected type can't have them
      if (detectedType !== 'wif' && detectedType !== 'vanity') {
        setDesignations([])
      }
    }
  }, [value, activeTab])

  // Clear designations when key type changes to incompatible type
  useEffect(() => {
    if (!canHaveDesignations && designations.length > 0) {
      setDesignations([])
    }
  }, [keyType, canHaveDesignations])

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

  const deriveAddress = (keyValue: string, type: KeyType): string | null => {
    try {
      if (type === 'wif' || type === 'vanity') {
        const pk = PrivateKey.fromWif(keyValue)
        return pk.toAddress('mainnet')
      }
      if (type === 'wif-testnet' || type === 'vanity-testnet') {
        const pk = PrivateKey.fromWif(keyValue)
        return pk.toAddress('testnet')
      }
      if (type === 'mnemonic') {
        const mn = Mnemonic.fromString(keyValue)
        const hd = HD.fromSeed(mn.toSeed())
        if (hd.privKey) {
          const pk = PrivateKey.fromHex(hd.privKey.toString())
          return pk.toAddress('mainnet')
        }
      }
      if (type === 'hdprivate') {
        const hd = HD.fromString(keyValue)
        if (hd.privKey) {
          const pk = PrivateKey.fromHex(hd.privKey.toString())
          return pk.toAddress('mainnet')
        }
      }
    } catch (e) {
      console.error('Failed to derive address:', e)
    }
    return null
  }

  const generatedAddress = value ? deriveAddress(value, keyType) : null

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
      <DialogContent>
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
            <Field>
              <FieldLabel htmlFor="gen-keyType">Key Type</FieldLabel>
              <Select value={keyType} onValueChange={(v) => setKeyType(v as KeyType)}>
                <SelectTrigger id="gen-keyType">
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
            </Field>

            {isVanity && (
              <Field>
                <FieldLabel htmlFor="gen-vanityPrefix">Desired Prefix</FieldLabel>
                <Input
                  id="gen-vanityPrefix"
                  value={vanityPrefix}
                  onChange={(e) => setVanityPrefix(e.target.value)}
                  maxLength={5}
                  placeholder="Prefix (1-5 base58 chars)"
                  autoFocus
                />
                <FieldDescription>Enter 1-5 base58 characters (excluding 0, O, I, l)</FieldDescription>
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="gen-label">Label (Optional)</FieldLabel>
              <Input
                id="gen-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., My Wallet Key"
              />
            </Field>

            <Separator />

            <Field>
              <FieldLabel>Key Designations (Optional)</FieldLabel>
              <ToggleGroup
                type="multiple"
                variant="outline"
                value={designations}
                onValueChange={setDesignations}
                className="justify-start"
                disabled={!canHaveDesignations}
              >
                <ToggleGroupItem value="encryption" className="data-[state=on]:bg-chart-5/20 data-[state=on]:text-chart-5" disabled={!canHaveDesignations}>
                  ENC
                </ToggleGroupItem>
                <ToggleGroupItem value="wallet" className="data-[state=on]:bg-chart-3/20 data-[state=on]:text-chart-3" disabled={!canHaveDesignations}>
                  WLT
                </ToggleGroupItem>
                <ToggleGroupItem value="ordinals" className="data-[state=on]:bg-chart-1/20 data-[state-on]:text-chart-1" disabled={!canHaveDesignations}>
                  ORD
                </ToggleGroupItem>
                <ToggleGroupItem value="identity" className="data-[state=on]:bg-chart-2/20 data-[state=on]:text-chart-2" disabled={!canHaveDesignations}>
                  ID
                </ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                {canHaveDesignations
                  ? 'Mark this key as encryption, wallet, ordinals, or identity'
                  : 'Key designations are only available for mainnet WIF keys'
                }
              </FieldDescription>
            </Field>

            {value && (
              <>
                <Separator />
                <Field>
                  <FieldLabel>Generated Key</FieldLabel>
                  <div className="p-3 bg-muted rounded font-mono text-xs break-all">
                    {value}
                  </div>
                </Field>
                {generatedAddress && (
                  <Field>
                    <FieldLabel>Address</FieldLabel>
                    <div className="p-3 bg-muted rounded font-mono text-xs break-all">
                      {generatedAddress}
                    </div>
                  </Field>
                )}
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <div className="flex gap-2">
                {!value ? (
                  <Button
                    onClick={handleGenerate}
                    disabled={generating}
                  >
                    {generating ? 'Generating...' : isVanity ? 'Generate Vanity' : 'Generate'}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      onClick={handleGenerate}
                      disabled={generating}
                    >
                      Regenerate
                    </Button>
                    <Button onClick={handleSubmit}>
                      Add Key
                    </Button>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          {/* IMPORT TAB */}
          <TabsContent value="import" className="space-y-4">
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="import-value">Key Value</FieldLabel>
                {value && (
                  <Badge variant="outline" className="ml-2">
                    {keyType === 'wif' && 'WIF'}
                    {keyType === 'wif-testnet' && 'WIF Testnet'}
                    {keyType === 'hdprivate' && 'HD Private'}
                    {keyType === 'mnemonic' && 'Mnemonic'}
                  </Badge>
                )}
              </div>
              <Textarea
                id="import-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Paste your WIF, xprv, or mnemonic phrase here"
                autoFocus
                className="min-h-[80px] font-mono text-xs"
              />
              <FieldDescription>
                {value
                  ? 'Type detected automatically from the pasted content'
                  : 'Paste your WIF private key, HD extended key (xprv), or BIP39 mnemonic phrase'
                }
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="import-label">Label (Optional)</FieldLabel>
              <Input
                id="import-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., My Wallet Key"
              />
            </Field>

            <Separator />

            <Field>
              <FieldLabel>Key Designations (Optional)</FieldLabel>
              <ToggleGroup
                type="multiple"
                variant="outline"
                value={designations}
                onValueChange={setDesignations}
                className="justify-start"
                disabled={!canHaveDesignations}
              >
                <ToggleGroupItem value="encryption" className="data-[state=on]:bg-chart-5/20 data-[state=on]:text-chart-5" disabled={!canHaveDesignations}>
                  ENC
                </ToggleGroupItem>
                <ToggleGroupItem value="wallet" className="data-[state=on]:bg-chart-3/20 data-[state=on]:text-chart-3" disabled={!canHaveDesignations}>
                  WLT
                </ToggleGroupItem>
                <ToggleGroupItem value="ordinals" className="data-[state=on]:bg-chart-1/20 data-[state=on]:text-chart-1" disabled={!canHaveDesignations}>
                  ORD
                </ToggleGroupItem>
                <ToggleGroupItem value="identity" className="data-[state=on]:bg-chart-2/20 data-[state=on]:text-chart-2" disabled={!canHaveDesignations}>
                  ID
                </ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                {canHaveDesignations
                  ? 'Mark this key as encryption, wallet, ordinals, or identity'
                  : 'Key designations are only available for mainnet WIF keys'
                }
              </FieldDescription>
            </Field>

            <div className="flex justify-between pt-2">
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
            <Field>
              <FieldLabel htmlFor="shares-label">Label</FieldLabel>
              <Input
                id="shares-label"
                value={sharesLabel}
                onChange={(e) => setSharesLabel(e.target.value)}
                placeholder="Enter a label for the combined key"
              />
              <FieldDescription>Name for the reconstructed key</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="shares-input">Key Shares</FieldLabel>
              <Textarea
                id="shares-input"
                value={sharesInput}
                onChange={(e) => setSharesInput(e.target.value)}
                placeholder="Paste your key shares here, one per line"
                className="min-h-[150px] font-mono text-xs"
              />
              <FieldDescription>Paste your Shamir secret shares, one per line. Lines starting with # will be ignored. At least 2 shares required.</FieldDescription>
            </Field>

            <div className="flex justify-between pt-2">
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
