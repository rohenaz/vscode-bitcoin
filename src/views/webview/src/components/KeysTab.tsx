import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions, ItemSeparator, ItemGroup } from '@/components/ui/item'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { KeyRound, Shield, Plus, Download, FileKey, Upload } from 'lucide-react'
import { getVscode } from '../vscode'
import { useVault } from '../contexts/VaultContext'
import { ExportVaultDialog } from './ExportVaultDialog'

export default function KeysTab() {
  const vscode = getVscode()
  const { vaultState } = useVault()
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  const execute = (command: string) => {
    vscode.postMessage({ command })
  }

  const handleExportBackup = () => {
    setExportDialogOpen(true)
  }

  const handleImportBackup = () => {
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
          {vaultState.isLocked ? (
            <Empty className="py-4 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Shield className="h-5 w-5" />
                </EmptyMedia>
                <EmptyTitle className="text-sm">Vault Locked</EmptyTitle>
                <EmptyDescription className="text-xs">
                  Unlock vault to see key statuses
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              <div className="text-center">
                <div className="text-xl font-bold">{vaultState.totalKeys}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-chart-3">
                  {vaultState.hasFundingKey ? '✓' : '○'}
                </div>
                <div className="text-xs text-muted-foreground">Funding</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-chart-1">
                  {vaultState.hasOrdinalsKey ? '✓' : '○'}
                </div>
                <div className="text-xs text-muted-foreground">Ordinals</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-chart-2">
                  {vaultState.hasIdentityKey ? '✓' : '○'}
                </div>
                <div className="text-xs text-muted-foreground">Identity</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-chart-5">
                  {vaultState.hasEncryptionKey ? '✓' : '○'}
                </div>
                <div className="text-xs text-muted-foreground">Encryption</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <ItemGroup>
        <Item variant="outline" size="sm">
          <ItemMedia variant="icon">
            <KeyRound className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{vaultState.isLocked ? 'Unlock Vault' : 'Open Key Vault'}</ItemTitle>
            <ItemDescription>View and manage all your keys</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button onClick={() => execute('bitcoin.showKeyVault')} size="sm">
              {vaultState.isLocked ? 'Unlock' : 'Open'}
            </Button>
          </ItemActions>
        </Item>

        <ItemSeparator />

        <Item variant="outline" size="sm">
          <ItemMedia variant="icon">
            <Plus className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Add Key</ItemTitle>
            <ItemDescription>Generate or paste in a new key</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button onClick={() => execute('bitcoin.showKeyVaultAndAddKey')} size="sm" disabled={vaultState.isLocked}>
              Add
            </Button>
          </ItemActions>
        </Item>

        <ItemSeparator />

        <Item variant="outline" size="sm">
          <ItemMedia variant="icon">
            <Upload className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Import Key</ItemTitle>
            <ItemDescription>Import key from backup file</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button onClick={() => execute('bitcoin.showKeyVaultAndImport')} size="sm" variant="secondary" disabled={vaultState.isLocked}>
              Import
            </Button>
          </ItemActions>
        </Item>

        <ItemSeparator />

        <Item variant="outline" size="sm">
          <ItemMedia variant="icon">
            <Download className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Export Vault Backup</ItemTitle>
            <ItemDescription>Save encrypted backup of all keys</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button onClick={handleExportBackup} size="sm" variant="secondary" disabled={vaultState.isLocked}>
              Export
            </Button>
          </ItemActions>
        </Item>

        <ItemSeparator />

        <Item variant="outline" size="sm">
          <ItemMedia variant="icon">
            <FileKey className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Import Vault Backup</ItemTitle>
            <ItemDescription>Restore keys from encrypted backup file</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button onClick={handleImportBackup} size="sm" variant="secondary" disabled={vaultState.isLocked}>
              Import
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>

      {/* Dialogs */}
      <ExportVaultDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} />
    </div>
  )
}
