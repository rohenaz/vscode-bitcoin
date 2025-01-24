# Bitcoin VS Code Extension

A comprehensive Bitcoin development toolkit for VS Code, powered by the modern `@bsv/sdk` library.

![](https://raw.githubusercontent.com/rohenaz/vscode-bitcoin/refs/heads/master/images/decode_raw_tx.gif)

![](https://raw.githubusercontent.com/rohenaz/vscode-bitcoin/refs/heads/master/images/address_from_private_key.gif)

![](https://raw.githubusercontent.com/rohenaz/vscode-bitcoin/refs/heads/master/images/bmap_from_txid.gif)

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

![](https://raw.githubusercontent.com/rohenaz/vscode-bitcoin/refs/heads/master/images/p2pkh_tooltip.png)

### Transaction Operations
- Fetch and decode transactions  
- Multiple output formats: raw, BOB, BMAP, JSON  

### Data Conversion
- Advanced converter with:  
  - Format auto-detection  
  - Live preview  
  - Clipboard copying  
  - Input validation  
  - Themed interface  
- Supports hex, Base64, binary, UTF-8  

![Data Conversion Tool](https://raw.githubusercontent.com/rohenaz/vscode-bitcoin/refs/heads/master/images/convert_data.png)

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
- [@bsv/sdk](https://github.com/bitcoin-sv/bsv-sdk) - Modern Bitcoin SV development kit
- [bpu-ts](https://github.com/rohenaz/bpu-ts) - Bitcoin Protocol Parser in TypeScript
- [bmapjs](https://github.com/rohenaz/bmapjs) - Bitcoin Metadata Application Protocol
- [bsv-bap](https://github.com/bitcoinschema/bap) - Bitcoin Attestation Profile (Identities)

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

**Enjoy!**

