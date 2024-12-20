# Welcome to Bitcoin VS Code Extension

This guide will help you get started with the Bitcoin VS Code extension for working with Bitcoin (BSV) functionality.

## Getting Started

1. Install the extension from VS Code marketplace or build from source
2. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Type "Bitcoin:" to see all available commands

## Features Overview

### Working with Keys

Generate various types of keys:
```typescript
// Generate a private key
Command: "Bitcoin: Generate Private Key"

// Generate a public key
Command: "Bitcoin: Generate Public Key"

// Generate WIF format
Command: "Bitcoin: Generate WIF"

// Generate HD keys
Command: "Bitcoin: Generate Extended Public Key"
Command: "Bitcoin: Generate Extended Private Key"
```

### Address Generation

Create addresses from different key formats:
```typescript
// From private key
Command: "Bitcoin: Address From Private Key"

// From public key
Command: "Bitcoin: Address from Public Key"

// From WIF
Command: "Bitcoin: Address from WIF"

// From HD keys
Command: "Bitcoin: Address From Extended Public Key"
Command: "Bitcoin: Address From Extended Private Key"
```

### Transaction Operations

Work with transactions in various formats:
```typescript
// Fetch transaction
Command: "Bitcoin: Fetch a Tx by Transaction ID"
// Supports: raw, BOB, BMAP, and JSON formats

// Decode transactions
Command: "Bitcoin: Decode Raw Transaction"
Command: "Bitcoin: Raw Tx to Bob"
Command: "Bitcoin: Raw Tx to Txo"
```

### Script Operations

Work with Bitcoin scripts:
```typescript
// Convert script to ASM
Command: "Bitcoin: ASM from Script"
```

### UTXO Management

```typescript
// Get UTXOs for an address
Command: "Bitcoin: Get UTXOs for Address"
```

## Development

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Open in VS Code:
   ```bash
   code .
   ```

### Build and Test
- Build: `bun run build`
- Watch Mode: `bun run dev`
- Run Tests: `bun run test`

### Making Changes
1. The main extension code is in `src/extension.ts`
2. Tests are in `src/test/suite/extension.test.ts`
3. Build with `bun run build` before testing changes

### Debugging
1. Press F5 to start debugging
2. Set breakpoints in your code
3. Use the Debug Console to see output
4. Use the Command Palette in the new window to test commands

## Extension Settings

Currently, no additional settings are required. All functionality is available through commands.

## Troubleshooting

1. Make sure you have the latest version of VS Code
2. Check the Output panel for any error messages
3. Ensure you're using the latest version of `@bsv/sdk`
4. For network operations, check your internet connection

## Resources

- [Extension API Documentation](https://code.visualstudio.com/api)
- [BSV SDK Documentation](https://github.com/bitcoin-sv/bsv-sdk)
- [WhatsOnChain API](https://developers.whatsonchain.com/)

## Contributing

See the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on contributing to this extension.

## Support

If you encounter any issues, please file them on the [GitHub repository](https://github.com/rohenaz/vscode-bitcoin/issues).
