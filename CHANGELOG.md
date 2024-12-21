# Change Log

## [Unreleased]

### Added
- Workspace management features:
  - Dedicated `.bitcoin` workspace for organizing files
  - Automatic content type detection
  - Folder organization by file type
  - Smart file naming using identifiers
- New command for content detection and conversion:
  - Support for base64-encoded data
  - Automatic detection of common formats (JPEG, PNG, JSON, XML)
  - Interactive content type selection when detection fails
  - Improved handling of data URLs with MIME types
  - Better support for hex and binary array inputs
- Configurable output preferences:
  - Clipboard output (default)
  - File dialog save
  - Workspace save with organization
- Transaction decoding and format conversion
- Address generation and validation
- Script operations and ASM conversion
- UTXO fetching and management
- BAP profile lookup
- Data conversion utilities
- Ordinals inscription fetching
- File workspace management
- Command organization structure
- Comprehensive test suite

### Changed
- Simplified output configuration with single preference setting
- Improved file naming strategy to avoid sensitive information
- Enhanced content type detection with user prompts
- Improved decodeFile command:
  - More efficient handling of base64, hex, and binary array inputs
  - Better MIME type handling from data URLs
  - Smarter format detection and conversion
  - Cleaner code using spread operator for optional parameters
- Simplified code by using existing utility functions
- Enhanced error messages for better user feedback
- Standardized command structure and testing patterns

### Fixed
- Command registration and visibility issues
- File naming sanitization
- Content type detection reliability
- Fixed decodeFile command:
  - Correct handling of MIME types from data URLs
  - Proper optional parameter handling in API calls
  - Improved error handling in data format detection
  - Fixed test assertions for optional parameters
- Fixed optional parameter handling in API calls
- Improved error handling in data format detection

### Security
- Added input validation for all commands
- Improved type safety across the codebase
- Added checks for empty or invalid inputs
- Standardized error handling patterns

## [0.1.0] - 2024-01-26

### Changed
- Major upgrade to build system and dependencies:
  - Migrated from webpack to Vite for improved build performance
  - Switched from `bsv` to `@bsv/sdk` for better TypeScript support and modern APIs
  - Replaced Shapeshifter with bpu-ts for transaction parsing
  - Updated all dependencies to latest versions
- Set VS Code engine version to 1.93.0 for improved compatibility
- Optimized bundle size through better dependency management
- Enhanced output management system
- Improved file naming for better organization
- Better handling of private data in filenames

### Added
- New workspace file management system:
  - Organized `.bitcoin` workspace folder
  - Automatic file categorization
  - Smart file naming with timestamps
  - Content type detection for binary data
- Configurable output settings for all commands:
  - Option to copy output to clipboard (default)
  - Option to open output in new text file
  - Option to save files to workspace
- Content type detection and conversion:
  - Auto-detect image formats
  - Convert base64 to binary files
  - Support for JPEG, PNG, GIF
  - Custom MIME type support
- Workspace configuration options:
  - Configurable workspace path
  - Content type detection toggle
  - Folder organization toggle
- New "Convert" command for smart data format conversion:
  - Automatically detects input format (hex, base64, binary array)
  - Converts between hex, base64, and binary array formats
  - Supports bidirectional conversion between all formats
  - Handles edge cases where input could be valid in multiple formats
- New utility functions from @bsv/sdk:
  - `toHex`: Convert data to hexadecimal format
  - `toArray`: Convert data to binary array format
  - `toBase64`: Convert data to base64 format
  - `fromHex`: Convert from hexadecimal format
  - `fromBase64`: Convert from base64 format
  - `fromBinary`: Convert from binary array format
- Comprehensive test suite using Bun's test runner
- BMAP support for protocol parsing
- Biome for code formatting and linting
- Better test setup with mocked VS Code API
- Source maps support in build process
- Comprehensive development guide
- Testing documentation
- Improved API documentation

### Improved
- Format detection logic for data conversions
- Error handling for invalid input formats
- Error handling and type safety
- TypeScript configurations
- Development workflow with watch mode
- VS Code launch and task configurations
- Installation and build instructions

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