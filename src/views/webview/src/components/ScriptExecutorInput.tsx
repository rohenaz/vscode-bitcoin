import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SpendParams } from '../types/scriptExecution'

interface ScriptExecutorInputProps {
  onExecute: (params: SpendParams) => void
  initialUnlockingScript?: string
}

export function ScriptExecutorInput({ onExecute, initialUnlockingScript = '' }: ScriptExecutorInputProps) {
  // Simple mode: just scripts
  const [unlockingScript, setUnlockingScript] = useState(initialUnlockingScript)
  const [lockingScript, setLockingScript] = useState('')

  // Advanced mode: full transaction context
  const [sourceTXID, setSourceTXID] = useState('')
  const [sourceOutputIndex, setSourceOutputIndex] = useState('0')
  const [sourceSatoshis, setSourceSatoshis] = useState('1000')

  const handleSimpleExecute = () => {
    if (!unlockingScript.trim() || !lockingScript.trim()) {
      return
    }

    const params: SpendParams = {
      sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
      sourceOutputIndex: 0,
      sourceSatoshis: 1000,
      lockingScript: lockingScript.trim(),
      transactionVersion: 1,
      otherInputs: [],
      outputs: [],
      unlockingScript: unlockingScript.trim(),
      inputSequence: 0xffffffff,
      inputIndex: 0,
      lockTime: 0,
    }

    onExecute(params)
  }

  const handleAdvancedExecute = () => {
    if (!sourceTXID.trim() || !unlockingScript.trim() || !lockingScript.trim()) {
      return
    }

    const params: SpendParams = {
      sourceTXID: sourceTXID.trim(),
      sourceOutputIndex: parseInt(sourceOutputIndex) || 0,
      sourceSatoshis: parseInt(sourceSatoshis) || 1000,
      lockingScript: lockingScript.trim(),
      transactionVersion: 1,
      otherInputs: [],
      outputs: [],
      unlockingScript: unlockingScript.trim(),
      inputSequence: 0xffffffff,
      inputIndex: 0,
      lockTime: 0,
    }

    onExecute(params)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Script Parameters</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="simple" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="simple">Simple</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="simple" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unlocking">Unlocking Script (hex)</Label>
              <Textarea
                id="unlocking"
                placeholder="e.g. 304402..."
                value={unlockingScript}
                onChange={(e) => setUnlockingScript(e.target.value)}
                className="font-mono text-xs"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="locking">Locking Script (hex)</Label>
              <Textarea
                id="locking"
                placeholder="e.g. 76a914...88ac"
                value={lockingScript}
                onChange={(e) => setLockingScript(e.target.value)}
                className="font-mono text-xs"
                rows={3}
              />
            </div>

            <Button
              onClick={handleSimpleExecute}
              disabled={!unlockingScript.trim() || !lockingScript.trim()}
              className="w-full"
            >
              Visualize Execution
            </Button>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="txid">Source TXID</Label>
              <Input
                id="txid"
                placeholder="Transaction ID"
                value={sourceTXID}
                onChange={(e) => setSourceTXID(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="outputIndex">Output Index</Label>
                <Input
                  id="outputIndex"
                  type="number"
                  placeholder="0"
                  value={sourceOutputIndex}
                  onChange={(e) => setSourceOutputIndex(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="satoshis">Satoshis</Label>
                <Input
                  id="satoshis"
                  type="number"
                  placeholder="1000"
                  value={sourceSatoshis}
                  onChange={(e) => setSourceSatoshis(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unlocking-adv">Unlocking Script (hex)</Label>
              <Textarea
                id="unlocking-adv"
                placeholder="e.g. 304402..."
                value={unlockingScript}
                onChange={(e) => setUnlockingScript(e.target.value)}
                className="font-mono text-xs"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="locking-adv">Locking Script (hex)</Label>
              <Textarea
                id="locking-adv"
                placeholder="e.g. 76a914...88ac"
                value={lockingScript}
                onChange={(e) => setLockingScript(e.target.value)}
                className="font-mono text-xs"
                rows={3}
              />
            </div>

            <Button
              onClick={handleAdvancedExecute}
              disabled={!sourceTXID.trim() || !unlockingScript.trim() || !lockingScript.trim()}
              className="w-full"
            >
              Visualize Execution
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
