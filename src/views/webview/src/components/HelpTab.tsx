import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { BookOpen, Code, Key, Wallet, Settings, Lightbulb } from 'lucide-react'

export default function HelpTab() {
  return (
    <div className="space-y-4">
      <Card className="border-l-0 border-r-0">
        <CardHeader>
          <CardTitle className="text-xs flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Help & Documentation
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <p className="text-muted-foreground">
            Bitcoin Tools provides a comprehensive suite of Bitcoin development utilities directly in VS Code.
          </p>
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={['getting-started', 'features']}>
        <AccordionItem value="getting-started">
          <AccordionTrigger className="text-xs">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Getting Started
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-xs space-y-3">
            <div>
              <h4 className="font-semibold mb-1">1. Set Up Your Key Vault</h4>
              <p className="text-muted-foreground">
                Navigate to the Keys tab and open the Key Vault. Create a secure password to protect your keys.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">2. Add Keys</h4>
              <p className="text-muted-foreground">
                Generate new keys or import existing ones. Set funding and ordinals keys for wallet functionality.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">3. Use the Wallet</h4>
              <p className="text-muted-foreground">
                Once you have a funding key set, the Wallet tab will display your balance, UTXOs, and allow you to send transactions.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="features">
          <AccordionTrigger className="text-xs">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Key Features
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-xs space-y-3">
            <div>
              <h4 className="font-semibold mb-1 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" /> Key Management
              </h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
                <li>Generate HD keys, WIF keys, mnemonic phrases</li>
                <li>Derive child keys using BIP32 and Type-42 derivation</li>
                <li>Set specialized keys (funding, ordinals, identity, encryption)</li>
                <li>Export and import encrypted vault backups</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-1 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> Wallet Features
              </h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
                <li>View balance and UTXOs</li>
                <li>Send BSV transactions with fee estimation</li>
                <li>Manage 1Sat Ordinals and BSV-20 tokens</li>
                <li>Transfer ordinals and tokens</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-1 flex items-center gap-1.5">
                <Code className="h-3.5 w-3.5" /> Developer Tools
              </h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
                <li>Decode and inspect transactions with detailed visualization</li>
                <li>Execute and step through Bitcoin scripts</li>
                <li>Convert between hex, base64, WIF, addresses</li>
                <li>Generate addresses from keys and scripts</li>
                <li>Query blockchain data (transactions, UTXOs, balances)</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="script-highlighting">
          <AccordionTrigger className="text-xs">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Script Syntax Highlighting
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-xs space-y-3">
            <div>
              <h4 className="font-semibold mb-1">OPCODE Highlighting</h4>
              <p className="text-muted-foreground mb-2">
                This extension provides syntax highlighting for Bitcoin Script opcodes and common patterns in your code files.
              </p>
              <h5 className="font-medium mb-1">Configuration</h5>
              <p className="text-muted-foreground mb-2">
                Open VS Code Settings (Cmd+, or Ctrl+,) and search for "bitcoin" to configure highlighting options:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">bitcoin.enableOpcodeHighlighting</code> - Enable/disable OPCODE syntax highlighting</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">bitcoin.highlightPatterns</code> - Customize which patterns to highlight</li>
              </ul>
              <h5 className="font-medium mb-1 mt-3">Supported Patterns</h5>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
                <li>Bitcoin Script opcodes (OP_DUP, OP_HASH160, etc.)</li>
                <li>P2PKH patterns</li>
                <li>P2PK patterns</li>
                <li>OP_RETURN data outputs</li>
                <li>Common script templates</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="commands">
          <AccordionTrigger className="text-xs">Command Palette</AccordionTrigger>
          <AccordionContent className="text-xs space-y-2">
            <p className="text-muted-foreground mb-2">
              Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux) and type "Bitcoin" to see all available commands:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
              <li><code className="bg-muted px-1 py-0.5 rounded text-xs">Bitcoin: Show Key Vault</code> - Open the key management interface</li>
              <li><code className="bg-muted px-1 py-0.5 rounded text-xs">Bitcoin: Decode Raw Transaction</code> - Decode transaction hex to JSON/BOB/BMAP</li>
              <li><code className="bg-muted px-1 py-0.5 rounded text-xs">Bitcoin: Convert Data</code> - Convert between hex, base64, binary</li>
              <li><code className="bg-muted px-1 py-0.5 rounded text-xs">Bitcoin: Open Conversion Tool</code> - Open data conversion panel</li>
              <li><code className="bg-muted px-1 py-0.5 rounded text-xs">Bitcoin: Open Bitcoin Settings</code> - Access extension settings</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="security">
          <AccordionTrigger className="text-xs">Security Best Practices</AccordionTrigger>
          <AccordionContent className="text-xs space-y-3">
            <div>
              <h4 className="font-semibold mb-1">Vault Security</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
                <li>Use a strong, unique password for your vault</li>
                <li>Regularly export encrypted backups</li>
                <li>Store backups in a secure location</li>
                <li>Never share your vault password or backup files</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Key Management</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
                <li>Use separate keys for different purposes (funding, ordinals, identity)</li>
                <li>Test with small amounts first</li>
                <li>Keep mnemonic phrases offline and secure</li>
                <li>Verify addresses before sending transactions</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="resources">
          <AccordionTrigger className="text-xs">Resources & Links</AccordionTrigger>
          <AccordionContent className="text-xs space-y-2">
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
              <li>
                <a href="https://docs.bsvblockchain.org/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  BSV Blockchain Documentation
                </a>
              </li>
              <li>
                <a href="https://github.com/bitcoin-sv/ts-sdk" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  BSV TypeScript SDK
                </a>
              </li>
              <li>
                <a href="https://whatsonchain.com/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  WhatsOnChain Block Explorer
                </a>
              </li>
              <li>
                <a href="https://docs.1satordinals.com/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  1Sat Ordinals Documentation
                </a>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
