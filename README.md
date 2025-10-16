# Bitcoin VS Code Extension

A comprehensive Bitcoin development toolkit for VS Code, powered by the modern `@bsv/sdk` library.

![](https://raw.githubusercontent.com/rohenaz/vscode-bitcoin/refs/heads/v0.1.0-beta/images/decode_raw_tx.gif)

![](https://raw.githubusercontent.com/rohenaz/vscode-bitcoin/refs/heads/v0.1.0-beta/images/address_from_private_key.gif)

![](https://raw.githubusercontent.com/rohenaz/vscode-bitcoin/refs/heads/v0.1.0-beta/images/bmap_from_txid.gif)

## Features

### Key Management
- Generate and manage private/public keys
- WIF key support
- HD key creation and derivation (xpub/xpriv)
- Mnemonic phrase generation
- Secure vault with encrypted storage
- Color-coded key organization
- One-click key operations

![Key Vault](https://raw.githubusercontent.com/rohenaz/vscode-bitcoin/refs/heads/master/images/key_vault.png)

### Address Operations
- Generate addresses from any key format  
- HD address derivation  
- UTXO management  
- Built-in WhatsOnChain explorer  
- BAP profile lookup  

### Script Operations
- Script to ASM conversion  
- P2PKH script support  
- Rich syntax highlighting:  
  - Opcodes with hover tips  
  - P2PKH scripts with address derivation  
  - Address and TXID links to explorers  

![](https://raw.githubusercontent.com/rohenaz/vscode-bitcoin/refs/heads/v0.1.0-beta/images/p2pkh_tooltip.png)

### Transaction Operations
- Fetch and decode transactions
- Multiple output formats: raw, BOB, BMAP, JSON

![Transaction Decoder](https://raw.githubusercontent.com/rohenaz/vscode-bitcoin/refs/heads/master/images/transaction_decoder.png)

### Script Debugger
- Step-by-step script execution visualization
- Breakpoint support
- Stack inspection at each step
- Context transitions between unlocking and locking scripts
- Interactive stepping controls

![Script Debugger](https://raw.githubusercontent.com/rohenaz/vscode-bitcoin/refs/heads/master/images/script_debugger.png)

### Data Conversion
- Advanced converter with:  
  - Format auto-detection  
  - Live preview  
  - Clipboard copying  
  - Input validation  
  - Themed interface  
- Supports hex, Base64, binary, UTF-8  

![Data Conversion Tool](https://raw.githubusercontent.com/rohenaz/vscode-bitcoin/refs/heads/v0.1.0-beta/images/convert_data.png)

### Ordinals & Inscriptions
- Fetch and display inscriptions  
- Parse inscription metadata  
- Support for various content types  

### Security
- Encrypted key storage  
- Secure clipboard operations  
- Protected workspace  
- Auto-managed `.gitignore`  

### Workspace Management
Extension creates a `.bitcoin` directory:

.bitcoin/
├─ addresses/      # Generated addresses
├─ conversions/    # Format conversion results
├─ keys/           # Generated keys (no private data)
├─ media/          # Converted images/binary data
├─ scripts/        # Script operations output
├─ transactions/   # Transaction data
├─ encrypted/      # Encrypted files
└─ utxos/          # UTXO lists

## Usage

### Command Palette
Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and type "Bitcoin" to see all extension commands.

### Key Operations
- `bitcoin.generatePrivateKey`  
- `bitcoin.generatePublicKey`  
- `bitcoin.generateWIF`  
- `bitcoin.generateMnemonic`  
- `bitcoin.generateHDPrivateKey`  
- `bitcoin.generateHDPublicKey`  
- `bitcoin.showKeyVault`  

### Address Commands
- `bitcoin.addressFromPrivateKey`  
- `bitcoin.addressFromPublicKey`  
- `bitcoin.addressFromWIF`  
- `bitcoin.addressFromHDPrivateKey`  
- `bitcoin.addressFromHDPublicKey`  
- `bitcoin.getUtxosForAddress`  
- `bitcoin.exploreAddress`  

### Script Commands
- `bitcoin.asmFromScript`  
- `bitcoin.debugSelection`  
- `bitcoin.decodeFile`  

### Transaction Commands
- `bitcoin.decodeRawTx`  
- `bitcoin.rawTxToBob`  
- `bitcoin.getTx`  

### Data Conversion
- `bitcoin.convertData`  
- `bitcoin.convertToHex`  
- `bitcoin.convertToBase64`  
- `bitcoin.convertToBinary`  
- `bitcoin.decodeHex`  
- `bitcoin.decodeBase64`  

### Encryption
Important: Generate at least one key first. The first generated key becomes the default encryption key. You can change it in the key vault.

- `bitcoin.encrypt`  
- `bitcoin.decrypt`  

### Metadata & Inscriptions
- `bitcoin.lookupBapProfile`  
- `bitcoin.fetchOrdinalsInscription`  

## Configuration

### Settings
```json
{
  "bitcoin.workspace.path": ".bitcoin",
  "bitcoin.workspace.detectContentType": true,
  "bitcoin.workspace.organizeFolders": true,
  "bitcoin.outputPreference": "clipboard",
  "bitcoin.bapIndexerUrl": "https://api.sigmaidentity.com/api/v1",
  "bitcoin.keyVault.autoStore": true
}
```

### Output Options
- Clipboard: Copy to clipboard (default)
- File: Save via file dialog
- Workspace: Automatically store in .bitcoin

### Key Vault Options
- `bitcoin.keyVault.autoStore`: When enabled (default), automatically stores generated keys in the vault. When disabled, keys are only displayed but not stored.

## Development

### Build Commands

```bash
bun run build     # Build the extension
bun run dev       # Build in watch mode
bun run test      # Run tests
bun run package   # Package for distribution
bun run clean     # Clean build artifacts
bun run lint      # Run linter
bun run format    # Format code
```

### Testing
Tests use Bun's test runner with BDD style:
```bash
bun test
```

## Dependencies

### Core Libraries
- [@bsv/sdk](https://github.com/bitcoin-sv/bsv-sdk) - Bitcoin SV development kit
- [bpu-ts](https://github.com/rohenaz/bpu-ts) - Bitcoin transaction parser
- [bmapjs](https://github.com/rohenaz/bmapjs) - Data protocol parser
- [bsv-bap](https://github.com/bitcoinschema/bap) - Bitcoin Attestation Protocol (Identities)

### External Services
- [WhatsOnChain](https://whatsonchain.com) - Bitcoin blockchain explorer
- [BAP Identities](https://bap.sigmaidentity.com) - Bitcoin Attestation Profile (Identities)


## Contributing
1. Fork
2. Create a feature branch
3. Add tests
4. Commit changes
5. Push
6. Open a Pull Request

## License

MIT License

## Resources
- BSV Academy
- Bitcoin SV
- WhatsOnChain
- BMAP
- BAP Identities

## Programmatic Usage

The extension provides commands that can be called programmatically from other extensions:

### sendTransaction

Send a Bitcoin transaction using the funding key from the Key Vault.

```typescript
interface SendTx {
  satoshis: number;  // Amount in satoshis
  script: string;    // Locking script in hex format
}

interface SendTxResponse {
  txid: string;      // Transaction ID
  hex: string;       // Raw transaction hex
}

// Call the command
const result = await vscode.commands.executeCommand('bitcoin.sendTransaction', {
  outputs: Output[],                                    // Array of outputs
  scriptEncoding?: 'hex' | 'base64' | 'asm'            // Optional script encoding (default: 'base64')
}): Promise<SendTxResponse>
```

Requirements:
- A funding key must be set in the Key Vault
- Sufficient funds must be available at the funding key's address

The command will:
1. Use the funding key to create inputs
2. Add all specified outputs
3. Calculate and add change output if needed
4. Sign all inputs
5. Broadcast the transaction

### signOpReturnData

Sign OP_RETURN data using the identity key from the Key Vault.

```typescript
interface SignOpReturnDataParams {
  data: number[][];  // Array of byte arrays to sign
}

interface SignOpReturnDataResponse {
  data: number[][];  // Signed data (includes BAP ID address and signature)
  type: 'signatures';
  name: 'signature';
}

// Call the command
const result = await vscode.commands.executeCommand('bitcoin.signOpReturnData', {
  data: number[][]   // Data to sign
}): Promise<SignOpReturnDataResponse>
```

Requirements:
- An identity key must be set in the Key Vault
- Data must be provided as an array of number arrays

The command will:
1. Use the identity key to create a BAP ID
2. Sign the data using AIP (Author Identity Protocol)
3. Return the signed data as an array containing [bapIdAddress, signature]

**Enjoy!**

