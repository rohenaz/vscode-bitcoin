import { useState, useEffect, useCallback } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Sparkles, Upload, X } from 'lucide-react'
import { getVscode } from '../vscode'

interface MintNftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ordAddress: string  // Used in dialog but not in component logic
}

type MintState = 'idle' | 'minting' | 'success' | 'error'

export function MintNftDialog({
  open,
  onOpenChange
}: MintNftDialogProps) {
  const vscode = getVscode()

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isImage, setIsImage] = useState(false)

  // Metadata state
  const [metadataEnabled, setMetadataEnabled] = useState(false)
  const [metadataKey, setMetadataKey] = useState('')
  const [metadataValue, setMetadataValue] = useState('')
  const [metadata, setMetadata] = useState<Record<string, string>>({})

  // Mint state
  const [mintState, setMintState] = useState<MintState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txid, setTxid] = useState('')

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedFile(null)
      setPreview(null)
      setIsImage(false)
      setMetadataEnabled(false)
      setMetadataKey('')
      setMetadataValue('')
      setMetadata({})
      setMintState('idle')
      setError(null)
      setTxid('')
    }
  }, [open])

  // Handle file selection
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFile(file)

    // Check if it's an image for preview
    const isImageType = file.type.startsWith('image/')
    setIsImage(isImageType)

    // Create preview for images
    if (isImageType) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setPreview(null)
    }
  }, [])

  // Add metadata field
  const handleAddMetadata = useCallback(() => {
    if (!metadataKey.trim() || !metadataValue.trim()) return
    setMetadata(prev => ({ ...prev, [metadataKey]: metadataValue }))
    setMetadataKey('')
    setMetadataValue('')
  }, [metadataKey, metadataValue])

  // Remove metadata field
  const handleRemoveMetadata = useCallback((key: string) => {
    setMetadata(prev => {
      const newMetadata = { ...prev }
      delete newMetadata[key]
      return newMetadata
    })
  }, [])

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const canMint = selectedFile !== null

  // Mint NFT
  const handleMint = async () => {
    if (!canMint || !selectedFile) return

    setMintState('minting')
    setError(null)

    // Read file as base64
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64Data = (reader.result as string).split(',')[1]
      vscode.postMessage({
        type: 'wallet:mintNft',
        data: {
          fileData: base64Data,
          contentType: selectedFile.type || 'application/octet-stream',
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined
        }
      })
    }
    reader.readAsDataURL(selectedFile)
  }

  // Listen for responses from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data

      switch (type) {
        case 'wallet:mintNft:success':
          setTxid(data.txid)
          setMintState('success')
          // Close after a brief delay to show success state
          setTimeout(() => {
            onOpenChange(false)
          }, 2000)
          break

        case 'wallet:mintNft:error':
          setError(data.error)
          setMintState('error')
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Mint NFT
            </DialogTitle>
            {mintState === 'minting' && <Badge variant="default">Minting</Badge>}
            {mintState === 'success' && <Badge variant="default" className="bg-green-600">Success</Badge>}
            {mintState === 'error' && <Badge variant="destructive">Failed</Badge>}
          </div>
          <DialogDescription>
            Inscribe any file as an NFT ordinal on the blockchain
          </DialogDescription>
        </DialogHeader>

        {mintState === 'idle' && (
          <div className="space-y-4">
            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
              {selectedFile && (
                <div className="text-xs text-muted-foreground">
                  {selectedFile.name} • {formatFileSize(selectedFile.size)}
                </div>
              )}
            </div>

            {/* Preview */}
            {preview && isImage && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="border rounded-md p-2 bg-muted/50">
                  <img src={preview} alt="Preview" className="max-w-full h-auto max-h-48 mx-auto rounded" />
                </div>
              </div>
            )}

            {!preview && selectedFile && !isImage && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 text-xs">
                <Upload className="h-4 w-4" />
                <span>File ready to mint</span>
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Metadata (Optional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMetadataEnabled(!metadataEnabled)}
                  className="h-6 text-xs"
                >
                  {metadataEnabled ? 'Hide' : 'Add Metadata'}
                </Button>
              </div>

              {metadataEnabled && (
                <div className="space-y-2">
                  {/* Existing metadata */}
                  {Object.entries(metadata).length > 0 && (
                    <div className="space-y-1">
                      {Object.entries(metadata).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 p-2 rounded bg-muted text-xs">
                          <span className="font-medium">{key}:</span>
                          <span className="flex-1">{value}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMetadata(key)}
                            className="h-5 w-5 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new metadata */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Key"
                      value={metadataKey}
                      onChange={(e) => setMetadataKey(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={metadataValue}
                      onChange={(e) => setMetadataValue(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleAddMetadata}
                      disabled={!metadataKey.trim() || !metadataValue.trim()}
                      size="sm"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {mintState === 'minting' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Minting your NFT...</p>
          </div>
        )}

        {mintState === 'success' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium mb-2">NFT Minted Successfully!</p>
            {txid && (
              <p className="text-xs text-muted-foreground font-mono">{txid.slice(0, 16)}...</p>
            )}
          </div>
        )}

        {mintState === 'error' && error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {mintState === 'idle' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleMint} disabled={!canMint}>
                Mint
              </Button>
            </>
          )}

          {(mintState === 'success' || mintState === 'error') && (
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
