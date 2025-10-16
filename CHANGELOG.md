# Changelog

## [Unreleased]

### Fixed
- **🎉 SPV Database Persistence** - Replaced fake-indexeddb with indexeddbshim
  - SPV sync now persists between VS Code restarts
  - Uses SQLite3 for disk storage in VS Code's global storage directory
  - Balance shows immediately from cache on restart
  - Only syncs new blocks since last session (~seconds instead of ~minutes)
  - No more 5-10 minute full resync on every restart!

### Added
- Real-time balance updates during SPV sync (updates every 5 seconds)
- InscriptionIndexer for ordinals/NFTs tracking in SPV store
- Granular sync progress in VS Code status bar (bottom of IDE)
- Immediate balance refresh when sync starts (shows cached data)

### Changed
- SPV database location: VS Code extension global storage
- Database files: SQLite3 format (persistent)

## Previous Versions
See git history for older changes.
