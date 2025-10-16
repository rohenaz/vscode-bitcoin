# Change Log

## [Unreleased]

## [v0.1.5] - 2025-10-15

### Changed
- **Organization Migration**:
  - Migrated extension publisher from `Satchmo` to `opl`
  - Moved repository from `rohenaz/vscode-bitcoin` to `b-open-io/vscode-bitcoin`
  - Updated all repository references in documentation and codebase
  - This marks the beginning of development under the OPL (Open Programming Library) organization

### Notes
- **Important**: Due to publisher change, this creates a new extension listing on VS Code Marketplace
- Extension ID changed from `Satchmo.bitcoin` to `opl.bitcoin`
- Users will need to uninstall the old extension and install the new one manually
- Previous versions (0.0.x - 0.1.4) remain available under the original publisher

## [v0.1.4] - 2025-10-15

### Added
- **Script Parsing Utilities**:
  - Created `scriptParser.ts` utility module with shared script parsing functions
  - Added `getOpcodeName()` function for unified opcode name lookup across codebase
  - Added `buildAsmFromChunks()` function for proper OP_RETURN script ASM generation
  - Exported utilities from `utils/index.ts` for easy access throughout extension
- **BAP Service Enhancements**:
  - Added public `exportIds()` method to BapService for safe access to BAP exported IDs
  - Improved master key identity management with proper ID export functionality

### Changed
- **OP_RETURN Script Parsing**:
  - Fixed OP_RETURN scripts to display individual pushdatas instead of merged hex blob
  - Transaction decoder now correctly shows `OP_0 OP_RETURN <hex1> <hex2> <hex3>` format
  - Separate window transaction decoder now uses shared OP_RETURN parsing logic
  - All script types (P2PKH, OP_RETURN, etc.) now display correct opcode names
- **Code Organization**:
  - Unified opcode name lookup logic across ScriptDebugger and transaction decoders
  - Removed duplicate `getOpcodeName` implementations
  - Improved code maintainability with single source of truth for script parsing

### Fixed
- **Transaction Decoder**:
  - Fixed OP_RETURN scripts showing as single blob instead of separate pushdatas
  - Fixed opcode display showing `OP_118` instead of `OP_DUP`, `OP_169` instead of `OP_HASH160`, etc.
  - Fixed "buildAsmFromChunks is not defined" error in separate transaction decoder window
  - Fixed P2PKH and other script types displaying correctly alongside OP_RETURN fixes
- **BAP Identity Discovery**:
  - Fixed accessing private `bap` property by using new public `exportIds()` method
  - Improved vault metadata updates with discovered identities
- **Build Process**:
  - Removed redundant dynamic imports that were causing build warnings
  - Added missing static imports for `P2PKH` and `fetchPayUtxos`
  - Eliminated "module is dynamically imported but also statically imported" warnings
- **TypeScript Errors**:
  - Fixed VaultBackup interface usage (removed non-existent `keyCount` property)
  - Added proper `scheme` field to vault backups
  - Fixed vault import warnings to show backup scheme instead of key count

## [v0.1.3] - 2025-01-17

### Added
- **BAP Identity Management**:
  - Full BAP (Bitcoin Attestation Protocol) identity integration
  - Support for both BAP Master keys (can create multiple identities) and BAP Member keys (single identity)
  - Identity discovery feature to find existing on-chain identities
  - Identity creation workflow for Master keys
  - Profile viewer with avatar display and detailed identity information
  - Integration with api.sigmaidentity.com (BSocial Overlay) for on-chain profile lookup
  - Support for ordfs.network Bitcoin file gateway for profile images
- **Draft Profile Management**:
  - Local draft storage for profile edits before publishing to blockchain
  - Profile edit panel with form for editing identity fields (name, description, paymail, URL, images)
  - Draft badge display in identity list for identities with unsaved changes
  - Profile storage service (`profileStorage.ts`) for managing drafts with change detection
  - Automatic draft restoration when editing the same profile again
  - Draft clearing after successful profile publication
- **Profile Publishing with BAP ALIAS**:
  - Full BAP ALIAS transaction creation with proper OP_RETURN formatting
  - Schema.org Person/Organization JSON formatting for identity data
  - AIP signature integration for attestation verification
  - Complete transaction building with UTXO selection and change outputs
  - Proper input specification with `sourceSatoshis` and `lockingScript` for signing
  - Integration with `fetchPayUtxos` for reliable UTXO fetching
  - Progress notifications during profile publishing workflow
- **Auto-Broadcast Setting Enforcement**:
  - Consistent auto-broadcast setting respect across ALL transaction types
  - Profile publishing checks auto-broadcast (defaults to OFF)
  - Token transfers check auto-broadcast setting
  - NFT minting checks auto-broadcast setting
  - BSV21 token deployment checks auto-broadcast setting
  - Send BSV already respects auto-broadcast setting
  - When OFF: Transactions load into Transaction Decoder for review
  - Transaction Decoder includes broadcast button and script debugger
  - User can review transaction details before manually broadcasting
- **Profile Display Enhancements**:
  - Profile viewer panel with social posts from BMAP API (bmap-api-production.up.railway.app)
  - Relative timestamp formatting ("just now", "2 hours ago", "3 days ago")
  - Auto-linkification of URLs in post content
  - Basic markdown formatting support (bold, italic, inline code)
  - Posts section with proper error handling and loading states
  - Profile and banner image display with normalization
  - Address history display with transaction details
- **Identity List Progressive Loading**:
  - Progressive identity enrichment with individual loading spinners
  - Avatars and display names update as profiles load
  - Draft status indicators for identities with local changes
  - Unsaved changes badges when drafts differ from on-chain data
  - Proper enrichment after identity creation
  - Loading states for each identity item during resolution
- **BAP Backup Import**:
  - Legacy BAP backup format support (xprv-based with BIP32 derivation)
  - Type 42 backup format support (WIF-based)
  - Automatic identity name extraction from backup files
  - Proper parent/child key hierarchy (mnemonic → xprv → identities)
  - Visual BAP badges on keys showing Master/Member status
  - Identity key display in Key Vault
- **Identity Tab UI**:
  - New dedicated Identity tab in Bitcoin Tools panel
  - Accordion-based layout matching app design patterns
  - Item component usage for identity list with hover actions
  - Three-dot dropdown menu for actions (Edit Profile, Publish to Chain)
  - Avatar component with fallback for profile images
  - Empty states for various scenarios (no key, no identities)
  - Create identity form for Master keys
  - Profile details viewer with all identity metadata
  - Member key info panel for read-only identities
  - Clickable identity items to view full profile
- **BRC-100 Integration Research**:
  - Comprehensive research document (`/docs/BRC100_INTEGRATION_RESEARCH.md`)
  - Technical overview of BRC-100 and Babbage framework
  - Detailed BAP vs BRC-100 comparison tables
  - Three integration options with pros/cons analysis
  - Implementation requirements documentation
  - Recommendation: Do not pursue integration currently due to complexity and lack of user demand
  - Key resources documented for future reference (ts-sdk, Babbage SDK, etc.)

### Changed
- **Key Vault Enhancements**:
  - Added BAP metadata badges showing identity count
  - Identity key tooltip showing first identity name and public key
  - BAP action button for keys with BAP data
  - Improved key import flow with identity name extraction
- **Image Handling**:
  - Created imageUtils.ts for consistent URL normalization
  - Support for multiple Bitcoin image URL formats (b://, ord://, relative paths, txid_vout)
  - Proper Content Security Policy for ordfs.network images
  - Image normalization in both webview and separate profile windows
- **BAP Service Architecture**:
  - Proper distinction between Master and Member key initialization
  - Support for both hdprivate (xprv) and wif key types
  - Correct BAP importIds() with encrypted parameter handling
  - Local identity caching and management
  - API endpoint integration with proper error handling
  - Added `createAliasTransaction()` method for BAP ALIAS transaction creation
- **BMAP API Integration**:
  - Centralized BMAP API base URL in constants (`BMAP_API_BASE_URL`)
  - Configurable endpoint for future production domain migration
  - Social posts endpoint integration (`/social/post/address/:address`)
  - Proper data structure handling for post timestamps and content
- **Transaction Building**:
  - Standardized transaction building across all operations
  - Proper UTXO input specification with `sourceSatoshis` and `lockingScript`
  - Consistent use of `fetchPayUtxos` for UTXO fetching
  - Complete input details for BSV SDK signing requirements

### Fixed
- **BAP Identity Loading**:
  - Added missing await on async initializeWithKey() calls
  - Fixed "Invalid checksum" error by removing incorrect encrypted: false parameter
  - Fixed "ID cannot be imported" error by using xprv directly for legacy backups
  - Corrected API property access (identityKey property vs getIdentityKey() method)
  - Fixed API endpoint paths (added missing /api prefix)
- **Key Import Issues**:
  - Proper xprv storage as hdprivate type instead of deriving WIF
  - Correct parent/child hierarchy (mnemonic parent, xprv child)
  - Identity name now extracted and used as key label
  - BAP initialization based on key type (hdprivate vs wif)
- **Profile Display**:
  - Fixed avatar images not loading in separate profile window
  - Added normalizeImageUrl() function to bapPanel.ts
  - Proper CSP configuration for image loading
  - Image URL conversion from relative to absolute ordfs.network URLs
  - Fixed posts showing "Unknown date" by checking `timestamp` field first (milliseconds) before `blk.t` (seconds)
  - Fixed CSP blocking inline scripts by adding `script-src 'unsafe-inline'`
  - Fixed posts 404 error by using correct endpoint `/social/post/address/:address`
  - Fixed post data parsing (B is array, txid is _id field)
- **Identity Enrichment**:
  - Fixed identity list not updating with profile data after creating new identity
  - Now triggers full `handleGetIdentities()` enrichment after identity creation
  - Progressive loading properly updates avatars, names, and draft status
  - Draft profiles display correctly even without on-chain data
- **Transaction Signing**:
  - Fixed "sourceSatoshis or sourceTransaction required" error in profile publishing
  - Added `sourceSatoshis` field to all transaction inputs for proper signing
  - Added `lockingScript` field from fetched UTXOs for complete input specification
  - Proper UTXO script handling from `fetchPayUtxos` hex encoding
- **Draft Management**:
  - Fixed drafts not showing in profile view after saving
  - Profile viewer now checks draft data first before on-chain data
  - Empty profile structure created for draft-only identities
  - Proper draft/on-chain data merging in profile viewer

## [v0.1.2] - 2025-01-16

### Added
- Script Debugger improvements:
  - Linear script highlighting across unlocking and locking scripts
  - Fixed step counting to show correct progress (e.g., 7/7 instead of 8/7)
  - Initial instruction highlighting in ready state
  - Improved context handling during script transitions
- Transaction management:
  - Transaction deletion feature in decode history
  - Enhanced transaction caching with input/output metadata
  - Improved transaction decoding from JungleBus and WhatOnChain
- Token functionality:
  - NFT and BSV21 token minting support
  - Enhanced token transfer interface with improved type safety

### Changed
- Script Debugger refactoring:
  - Simplified absolute index tracking for script execution
  - Removed complex +1/-1 offset calculations
  - Consolidated script boundary logic into helper functions
- Wallet state management improvements:
  - Better clarity and performance in state handling
  - Streamlined code with removal of unused methods
- UI enhancements:
  - Improved dropdown menu interaction in decode history
  - Better component organization and structure

### Fixed
- Script Debugger highlighting issues during context transitions
- Transaction metadata not updating for cached transactions
- Debug Script button opening wrong panel
- Step counter showing incorrect total steps

## [v0.1.1] - 2025-01-15

### Added
- Wallet functionality:
  - Full wallet integration with key management
  - Ordinals key selection and management
  - Support for multiple backup types for imports
- Key Vault enhancements:
  - Designated keys panel for better key management
  - Improved key generation dialogs with validation
  - Enhanced UI components with better organization
- Script execution:
  - Improved script execution handling
  - Better transaction decoder and script editor

### Changed
- Updated bitcoin-backup dependency to version 0.0.3
- Refactored KeyVault webview to use proper TypeScript files
- Major UI updates across all components
- Enhanced wallet state management and UI interactions

### Fixed
- .vscodeignore to properly include keyVault webview dist files
- Script editor and transaction decoder UI issues

## [v0.1.0] - 2025-01-15

### Added
- Pre-release version with all beta features
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
- Version numbering to follow VS Code pre-release convention
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
  - Content type detection
  - Smarter format detection and conversion
  - Simplified output configuration
- Code quality improvements:
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

[Unreleased]: https://github.com/b-open-io/vscode-bitcoin/compare/v0.1.5...HEAD
[v0.1.5]: https://github.com/b-open-io/vscode-bitcoin/compare/v0.1.4...v0.1.5
[v0.1.4]: https://github.com/b-open-io/vscode-bitcoin/compare/v0.1.3...v0.1.4
[v0.1.3]: https://github.com/b-open-io/vscode-bitcoin/compare/v0.1.2...v0.1.3
[v0.1.2]: https://github.com/b-open-io/vscode-bitcoin/compare/v0.1.1...v0.1.2
[v0.1.1]: https://github.com/b-open-io/vscode-bitcoin/compare/v0.1.0...v0.1.1
[v0.1.0]: https://github.com/b-open-io/vscode-bitcoin/compare/v0.0.15...v0.1.0
[0.0.15]: https://github.com/b-open-io/vscode-bitcoin/compare/v0.0.14...v0.0.15
[0.0.14]: https://github.com/b-open-io/vscode-bitcoin/compare/v0.0.13...v0.0.14
[0.0.13]: https://github.com/b-open-io/vscode-bitcoin/releases/tag/v0.0.13