# Change Log

## [Unreleased]

## [v0.1.0-beta] - 2025-01-15

### Added
- Key Vault functionality:
  - Secure key storage with encryption
  - Color-coded key organization
  - Search and filter capabilities
  - One-click operations
- Welcome screen with quick access to features
- Rich syntax highlighting:
  - Bitcoin opcodes with hover descriptions
  - P2PKH script detection and address derivation
  - Bitcoin addresses with WhatsOnChain links
  - Transaction IDs with explorer links
- Workspace management:
  - Dedicated `.bitcoin` workspace directory
  - Automatic file categorization by type
  - Smart file naming with timestamps
  - Content type detection for binary data
  - Configurable workspace path
  - Automatic `.gitignore` management
- Advanced data conversion:
  - Format auto-detection (hex, base64, binary, UTF-8)
  - Support for common formats (JPEG, PNG, JSON, XML)
  - Interactive content type selection
  - Improved data URL handling
  - Bidirectional conversion between formats
  - Edge case handling for ambiguous formats
- Core Bitcoin operations:
  - Transaction decoding and format conversion
  - Address generation and validation
  - Script operations and ASM conversion
  - UTXO fetching and management
  - BAP profile lookup
  - Ordinals inscription fetching
- Output configuration:
  - Clipboard output (default)
  - File dialog save
  - Workspace auto-save with organization
- Development tools:
  - Comprehensive test suite with Bun
  - BMAP protocol parsing support
  - Biome for code formatting
  - Source maps support
  - VS Code API mocks
  - Development guide
  - API documentation

### Changed
- Complete build system overhaul:
  - Migrated from webpack to Vite
  - Added Biome for linting and formatting
  - Improved TypeScript configurations
  - Added source maps support
  - Optimized bundle size
- Major dependency upgrades:
  - Switched from `bsv` to `@bsv/sdk` for modern TypeScript support
  - Replaced Shapeshifter with `bpu-ts` for transaction parsing
  - Added `bmapjs` for protocol parsing
  - Updated all dependencies to latest versions
- Enhanced development workflow:
  - Improved watch mode with faster rebuilds
  - Better VS Code launch configurations
  - Streamlined test setup with mocked VS Code API
- Improved file operations:
  - Better file naming strategy for sensitive data
  - Enhanced content type detection
  - Smarter format detection and conversion
  - Simplified output configuration
- Code quality improvements:
  - Enhanced error messages
  - Standardized command structure
  - Better type safety
  - Cleaner API design

### Fixed
- Command registration and visibility issues
- File naming sanitization
- Content type detection reliability
- Data handling improvements:
  - MIME type handling from data URLs
  - Optional parameter handling
  - Format detection edge cases
  - Test assertions

### Security
- Added input validation for all commands
- Improved type safety across the codebase
- Added checks for empty or invalid inputs
- Standardized error handling patterns

### Removed
- TXO format conversion functionality (replaced by improved transaction decoding)

## [0.0.15] - 2024-12-01

### Added
- Script to ASM conversion feature

## [0.0.14] - 2024-11-15

### Added
- Raw tx to TXO conversion
- Raw tx to BOB conversion

## [0.0.13] - 2024-11-01

### Added
- Raw transaction decoder

[Unreleased]: https://github.com/rohenaz/vscode-bitcoin/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/rohenaz/vscode-bitcoin/compare/v0.0.15...v0.1.0
[0.0.15]: https://github.com/rohenaz/vscode-bitcoin/compare/v0.0.14...v0.0.15
[0.0.14]: https://github.com/rohenaz/vscode-bitcoin/compare/v0.0.13...v0.0.14
[0.0.13]: https://github.com/rohenaz/vscode-bitcoin/releases/tag/v0.0.13