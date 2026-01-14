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
- **Memory Terrarium**: Transform your memories into a living terrarium!
  - Add memories with optional photos (stored as base64)
  - Each memory unlocks a new terrarium item
  - Every 5th memory unlocks a bonus creature/special item
  - 3 layers (back/middle/front) with free placement
  - Edit mode for arranging items
  - 30+ unlockable items across plants, decorations, creatures, and specials
- **Gallery View**: Photo gallery unlocks at 25 memories
  - Grid view of all photo memories
  - Tap to view full memory details
- **Feature Unlocks**:
  - Gallery at 25 memories
  - Throwback feature at 50 memories (coming soon)
- **Game Room**: New mini-game hub for playing games with your pets
  - Select any pet to play with
  - Pet-specific AI difficulty (Stitch hardest, Duckson easiest)
  - **Pong**: Classic paddle game vs AI
    - First to 5 points wins
    - Entry: 2 diamonds, Win: 25 diamonds
  - **Match-3 (Gem Match)**: Time-limited gem matching
    - 60 seconds to score as high as possible
    - Entry: 1 diamond, Win: 15-40 diamonds based on score
- **Bond System**: New pet stat that increases through gameplay
  - Bond meter (0-100) shown on pet selection
  - Increases when playing games with pets
  - Pong win: +5 bond, Match-3 completion: +3 bond
- **High Score Tracking**: Added for Pong and Match-3 games

### Technical
- Added `MemoryEntry` interface for structured memory storage
- Added `TerrariumItem` and `PlacedItem` interfaces for terrarium
- Added `terrarium` and `totalMemoryCount` to GameState
- Created `components/MemoryForm.tsx` - Memory entry with photo upload
- Created `components/Terrarium.tsx` - Main terrarium view with layers
- Created `components/UnlockModal.tsx` - Item unlock celebration
- Created `components/Gallery.tsx` - Photo gallery view
- Created `services/terrariumAssets.ts` - Placeholder asset generator
- Added `TERRARIUM_ITEMS` config (30+ items with unlock progression)
- Added `FEATURE_UNLOCKS` config for milestone features
- Added `bond` property to PetState type
- Added `pong` and `match3` to highScores tracking
- Created `components/GameRoom.tsx` - Main game room container
- Created `components/games/PongGame.tsx` - Canvas-based pong game
- Created `components/games/Match3Game.tsx` - Gem matching puzzle
- Added `PET_AI_DIFFICULTY` config for per-pet difficulty scaling
- Added `GAME_ROOM_CONFIG` for game parameters
