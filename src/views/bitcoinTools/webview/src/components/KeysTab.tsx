import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Item, ItemActions, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { KeyRound, Unlock, Vault, Shield } from 'lucide-react'
import { getVscode } from '../vscode'

interface KeysTabProps {
  openItems: string[]
  onOpenChange: (items: string[]) => void
}

interface VaultStats {
  totalKeys: number
  keyTypes: Record<string, number>
  hasEncryptionKey: boolean
  hasFundingKey: boolean
  hasOrdinalsKey: boolean
  isLocked: boolean
}

export default function KeysTab({ openItems, onOpenChange }: KeysTabProps) {
  const vscode = getVscode()
  const [stats, setStats] = useState<VaultStats | null>(null)

  useEffect(() => {
    // Request vault stats
    vscode.postMessage({ type: 'vault:getStats' })

    // Listen for stats updates
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data
      if (type === 'vault:stats') {
        setStats(data)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const execute = (command: string) => {
    vscode.postMessage({ command })
  }

  const handleExport = () => {
    vscode.postMessage({ type: 'vault:export' })
  }

  const handleImport = () => {
    vscode.postMessage({ type: 'vault:import' })
  }

  return (
    <div className="space-y-4">
      {/* Stats Card */}
      <Card className="border-l-0 border-r-0">
        <CardHeader>
          <CardTitle className="text-xs flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Key Vault
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.isLocked ? (
            <div className="text-center py-4">
              <Vault className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">Vault is locked</p>
              <Button onClick={() => execute('bitcoin.showKeyVault')} className="w-full">
                <Vault className="h-4 w-4 mr-2" />
                Open Key Vault
              </Button>
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.totalKeys}</div>
                  <div className="text-xs text-muted-foreground">Total Keys</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {stats.hasFundingKey ? '✓' : '○'}
                  </div>
                  <div className="text-xs text-muted-foreground">Funding</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.hasOrdinalsKey ? '✓' : '○'}
                  </div>
                  <div className="text-xs text-muted-foreground">Ordinals</div>
                </div>
              </div>
              <Button onClick={() => execute('bitcoin.showKeyVault')} className="w-full" size="sm">
                <Vault className="h-4 w-4 mr-2" />
                Open Key Vault
              </Button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accordion Sections */}
      <Accordion type="multiple" className="w-full" value={openItems} onValueChange={onOpenChange}>
      <AccordionItem value="generate">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <KeyRound className="h-3 w-3" />
            Generate
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Private Key</ItemTitle>
                <ItemDescription>Generate a new private key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generatePrivateKey')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Public Key</ItemTitle>
                <ItemDescription>Generate a new public key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generatePublicKey')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>WIF (Mainnet)</ItemTitle>
                <ItemDescription>Generate mainnet WIF key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateWIF')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>WIF (Testnet)</ItemTitle>
                <ItemDescription>Generate testnet WIF key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateTestnetWIF')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>WIF Vanity (Mainnet)</ItemTitle>
                <ItemDescription>Generate vanity mainnet WIF</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateWIFVanity')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>WIF Vanity (Testnet)</ItemTitle>
                <ItemDescription>Generate vanity testnet WIF</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateTestnetWIFVanity')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Extended Private Key</ItemTitle>
                <ItemDescription>Generate HD extended private key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateHDPrivateKey')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Extended Public Key</ItemTitle>
                <ItemDescription>Generate HD extended public key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateHDPublicKey')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Mnemonic</ItemTitle>
                <ItemDescription>Generate BIP39 mnemonic phrase</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateMnemonic')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="derive">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Unlock className="h-3 w-3" />
            Derive
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Public from Private</ItemTitle>
                <ItemDescription>Derive public key from private key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.publicKeyFromPrivateKey')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Public from WIF</ItemTitle>
                <ItemDescription>Derive public key from WIF</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.publicKeyFromWIF')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>xPub from xPriv</ItemTitle>
                <ItemDescription>Derive extended public from extended private</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.xPubFromxPriv')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>xPriv from Mnemonic</ItemTitle>
                <ItemDescription>Derive extended private key from mnemonic</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.extendedPrivateKeyFromMnemonic')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="vault">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Vault className="h-3 w-3" />
            Vault
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Open Key Vault</ItemTitle>
                <ItemDescription>View and manage your keys</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.showKeyVault')}>
                  Open
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Export Vault Backup</ItemTitle>
                <ItemDescription>Save encrypted vault backup</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  Export
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Import Vault Backup</ItemTitle>
                <ItemDescription>Restore vault from backup file</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={handleImport}>
                  Import
                </Button>
              </ItemActions>
            </Item>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
    </div>
  )
}
