# Bitcoin VS Code Extension

This extension provides convenient tools for working with Bitcoin (BSV) addresses, transactions, and keys using the modern `@bsv/sdk` library.

![](./images/decode_raw_tx.gif)

![](./images/address_from_private_key.gif)

![](./images/bmap_from_txid.gif)

## Features

### Address Operations
- Generate address from private key
- Generate address from public key
- Generate address from WIF
- Derive address from HD public key (xpub)
- Derive address from HD private key (xprv)

### Key Management
- Generate private key
- Generate public key from private key
- Generate WIF format key
- Generate HD public key (xpub)
- Generate HD private key (xprv)
- Derive HD public key from HD private key
- Generate mnemonic phrase
- Generate HD private key from mnemonic

### Script Operations
- Convert script to ASM format
- Parse and decode scripts
- Work with P2PKH scripts

### Transaction Operations
- Fetch transaction by ID (supports multiple formats):
  - Raw format
  - BOB format
  - BMAP format
  - JSON format
- Decode raw transactions
- Convert raw transaction to BOB format
- Convert raw transaction to TXO format

### UTXO Management
- Fetch UTXOs for any address

## Requirements

No special requirements. The extension includes all necessary dependencies.

## Installation

1. Install from VS Code marketplace
2. Or build from source:
   ```bash
   git clone https://github.com/rohenaz/vscode-bitcoin.git
   cd vscode-bitcoin
   bun install
   bun run build
   ```

## Development

### Build Commands
- `bun run build` - Build the extension
- `bun run dev` - Build in watch mode
- `bun run test` - Run test suite
- `bun run package` - Package for distribution

### Testing
Tests are written using Mocha with BDD style. Run tests with:
```bash
bun run test
```

## Dependencies

### Core Library
- [@bsv/sdk](https://github.com/bitcoin-sv/bsv-sdk) - Modern Bitcoin SV development kit

### Network Services
- [WhatsOnChain](https://whatsonchain.com) - API for UTXOs and transaction data

### Utility Libraries
- [Shapeshifter](https://github.com/libitx/shapeshifter.js) - Transaction format conversion

## Release Notes

### 0.1.0
- Major upgrade to build system and dependencies:
  - Migrated from webpack to Vite for improved build performance
  - Switched from `bsv` to `@bsv/sdk` for better TypeScript support and modern APIs
  - Added comprehensive test suite using Mocha
  - Improved error handling and type safety
  - Updated all dependencies to latest versions
  - Added proper TypeScript configurations
  - Improved development workflow with watch mode

### 0.0.15
- Added Script to ASM conversion

### 0.0.14
- Added Raw tx to TXO conversion
- Added Raw tx to BOB conversion

### 0.0.13
- Added Raw transaction decoder

## Contributing

1. Fork the repository
2. Create your feature branch
3. Write tests for your changes
4. Commit your changes
5. Push to the branch
6. Create a Pull Request

## License

[MIT License](LICENSE)

## Resources

- [BSV Academy](https://bitcoinsv.academy/)
- [Bitcoin SV](https://bitcoinsv.com/)
- [WhatsOnChain](https://whatsonchain.com)
- [BMAP](http://bmapjs.com)

**Enjoy!**
