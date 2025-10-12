import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Copy, Check } from 'lucide-react'
import { getVscode } from '../vscode'

interface ReceiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payAddress: string
  ordAddress: string
}

export function ReceiveDialog({
  open,
  onOpenChange,
  payAddress,
  ordAddress,
}: ReceiveDialogProps) {
  const vscode = getVscode()
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'payment' | 'ordinals'>('payment')

  const currentAddress = activeTab === 'payment' ? payAddress : ordAddress

  const handleCopy = (address: string) => {
    vscode.postMessage({ type: 'copy', value: address })
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receive BSV</DialogTitle>
          <DialogDescription>
            Share this address to receive BSV payments or ordinals
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'payment' | 'ordinals')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="payment">Payment</TabsTrigger>
            <TabsTrigger value="ordinals">Ordinals</TabsTrigger>
          </TabsList>

          <TabsContent value="payment" className="space-y-4">
            <div className="flex flex-col items-center space-y-4">
              {/* QR Code */}
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG
                  value={payAddress}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Address Display */}
              <div className="w-full space-y-2">
                <Label htmlFor="payment-address" className="text-xs text-muted-foreground">
                  Payment Address
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="payment-address"
                    value={payAddress}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(payAddress)}
                  >
                    {copiedAddress === payAddress ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Use this address for receiving regular BSV payments
              </p>
            </div>
          </TabsContent>

          <TabsContent value="ordinals" className="space-y-4">
            <div className="flex flex-col items-center space-y-4">
              {/* QR Code */}
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG
                  value={ordAddress}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Address Display */}
              <div className="w-full space-y-2">
                <Label htmlFor="ordinals-address" className="text-xs text-muted-foreground">
                  Ordinals Address
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="ordinals-address"
                    value={ordAddress}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(ordAddress)}
                  >
                    {copiedAddress === ordAddress ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Use this address for receiving ordinals and NFTs
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => handleCopy(currentAddress)}>
            {copiedAddress === currentAddress ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Address
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
