# Bitcoin Extension Quick Start Guide

## Features

### Basic Operations
* Generate Bitcoin keys and addresses
* Convert between different data formats
* Work with transactions and scripts
* Fetch blockchain data

### Workspace Management
The extension creates a `.bitcoin` workspace in your project to organize Bitcoin-related files:

* **Location**: `.bitcoin` directory in your workspace root
* **Organization**: Files are automatically sorted into subfolders by type
* **Naming**: Files use appropriate identifiers (e.g., transaction IDs)

### Content Detection
Convert and save various types of content:

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Bitcoin: Detect and Convert Content"
3. Enter your base64-encoded data
4. The extension will:
   * Detect the content type automatically
   * Prompt for type selection if needed
   * Save the file with appropriate extension

### Output Options
Configure how command results are handled:

1. Open VS Code settings
2. Search for "Bitcoin"
3. Choose your preferred output method:
   * **Clipboard**: Copy to clipboard (default)
   * **File**: Save via file dialog
   * **Workspace**: Auto-save to `.bitcoin` workspace

## Configuration

### Workspace Settings
```json
{
  "bitcoin.workspace.path": ".bitcoin",
  "bitcoin.workspace.detectContentType": true,
  "bitcoin.workspace.organizeFolders": true,
  "bitcoin.outputPreference": "clipboard"
}
```

## Development

### Building the Extension
* Run `bun install` to install dependencies
* Run `bun run build` to compile
* Press `F5` to run in debug mode

### Testing
* Run `bun test` to execute test suite
* Tests are located in `src/test`

### Making Changes
1. Modify source files in `src/`
2. Run `bun run build` to compile
3. Press `F5` to test changes
4. Use `bun test` to verify functionality

## Troubleshooting

### Common Issues
* **Command not found**: Ensure extension is activated
* **Save failed**: Check workspace permissions
* **Content detection failed**: Try specifying type manually

### Getting Help
* Check the [README](README.md) for detailed documentation
* File issues on GitHub for bugs
* Contact maintainers for support

## Resources
* [Extension API](https://code.visualstudio.com/api)
* [Bitcoin Documentation](https://developer.bitcoin.org/)
* [BSV SDK Documentation](https://github.com/bitcoin-sv/bsv-sdk)
