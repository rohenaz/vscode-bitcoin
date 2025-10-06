import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getVscode } from '../vscode'
import type { KeyType } from '../types'

interface AddKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddKeyDialog({ open, onOpenChange }: AddKeyDialogProps) {
  const vscode = getVscode()
  const [keyType, setKeyType] = useState<KeyType>('wif')
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [vanityPrefix, setVanityPrefix] = useState('')
  const [setAsWallet, setSetAsWallet] = useState(false)
  const [setAsOrdinals, setSetAsOrdinals] = useState(false)
  const [generating, setGenerating] = useState(false)

  const isVanity = keyType === 'vanity' || keyType === 'vanity-testnet'

  const handleGenerate = () => {
    if (isVanity) {
      setGenerating(true)
    }
    vscode.postMessage({ command: 'generateRandomKey', type: keyType })
  }

  const handleSubmit = () => {
    if (!isVanity && !value.trim()) {
      alert('Key Value is required!')
      return
    }

    if (isVanity && !value.trim()) {
      alert('Generate the vanity key before adding.')
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
      setAsWallet,
      setAsOrdinals,
    })

    // Reset and close
    setLabel('')
    setValue('')
    setVanityPrefix('')
    setSetAsWallet(false)
    setSetAsOrdinals(false)
    setKeyType('wif')
    setGenerating(false)
    onOpenChange(false)
  }

  // Listen for generated key
  useState(() => {
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
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Key</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="keyType">Key Type</Label>
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

          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Optional label"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Key Value</Label>
            <Input
              id="value"
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isVanity}
            />
          </div>

          {isVanity && (
            <div className="space-y-2">
              <Label htmlFor="vanityPrefix">Desired Prefix</Label>
              <Input
                id="vanityPrefix"
                value={vanityPrefix}
                onChange={(e) => setVanityPrefix(e.target.value)}
                maxLength={5}
                placeholder="Prefix (1-5 base58 chars)"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Advanced Options</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={setAsWallet}
                  onChange={(e) => setSetAsWallet(e.target.checked)}
                  className="cursor-pointer"
                />
                <span className="text-sm">Set as Wallet Key</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={setAsOrdinals}
                  onChange={(e) => setSetAsOrdinals(e.target.checked)}
                  className="cursor-pointer"
                />
                <span className="text-sm">Set as Ordinals Key</span>
              </label>
            </div>
          </div>

          <div className="flex justify-between">
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
              <Button onClick={handleSubmit}>
                Add Key
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
