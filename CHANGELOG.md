# Changelog

All notable changes to BBGotchi will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-08

### Added
- **Home Screen**: New home screen with New Game and Load Game buttons
- **Save System**: 3 save slots with auto-save functionality
  - Save slot selection for new and existing games
  - Per-slot save info display (pet name, level, last save time)
  - Delete individual save slots
- **Home Navigation**: Home button in game header to return to home screen
- **Return to Home**: Option in Settings to go back to home screen

### Changed
- **Memory Match Lives**: Now varies by difficulty
  - Easy: 6 lives (was 3)
  - Medium: 8 lives (was 3)
  - Hard: 10 lives (was 3)
- Difficulty selection now displays lives per difficulty level

### Fixed
- Fixed Vite importmap conflict that prevented app from loading
- Added missing `MEMORY_MATCH_LIVES` constant
- Added TypeScript declarations for image imports

### Technical
- Added `vite-env.d.ts` for proper TypeScript image module declarations
- Created `services/saveState.ts` for save management
- Created `components/HomeScreen.tsx` for home screen UI

---

## [Unreleased]

### Added
- (Track new features here)

### Changed
- (Track changes here)

### Fixed
- (Track bug fixes here)

### Removed
- (Track removed features here)
