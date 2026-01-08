# BBGotchi

A virtual pet (Tamagotchi-style) web application built with React, TypeScript, and Vite. Raise your digital pets, play mini-games, and create memories together.

## Features

### Core Gameplay
- **Multiple Pets**: Choose from 6 unique pet characters (Sharkwow, Squirtle, Stitch, Duckson, Dickson, Sealy)
- **Pet Stats**: Manage hunger, happiness, and energy levels
- **Leveling System**: Earn EXP and level up your pets (max level 10)
- **Evolution**: Pets evolve at level 5 (Teenager) and level 10 (Adult)
- **Custom Avatars**: Upload custom images for your pets

### Mini-Games
- **Family Trivia**: Answer questions to earn diamonds
- **Memory Match**: Card matching game with 3 difficulty levels
  - Easy: 4x4 grid, 8 pairs, 6 lives
  - Medium: 6x6 grid, 18 pairs, 8 lives
  - Hard: 8x8 grid, 32 pairs, 10 lives

### Economy
- **Diamond Currency**: Earn through games, spend in the shop
- **Shop System**: Buy food, treats, toys, and EXP boosters

### Progress & Memories
- **Save System**: 3 save slots with auto-save
- **Trophy Collection**: Unlock trophies for milestones
- **Memory Journal**: Record special moments with your pets

## Getting Started

### Prerequisites
- Node.js (v18+)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ken/bbgotchi.git
cd bbgotchi
```

2. Install dependencies:
```bash
npm install
```

3. (Optional) Set up Gemini API for AI features:
   - Create a `.env.local` file
   - Add your API key: `GEMINI_API_KEY=your_key_here`

4. Start the development server:
```bash
npm run dev
```

5. Open http://localhost:3000 in your browser

## Tech Stack

- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **AI Integration**: Google Gemini API (optional)

## Project Structure

```
bbgotchi/
├── assets/           # Images and game assets
│   ├── avatars/      # Pet avatar images
│   └── memory-match/ # Memory game card images
├── components/       # React components
├── services/         # Business logic (save state, AI)
├── App.tsx          # Main application
├── constants.ts     # Game configuration
├── types.ts         # TypeScript definitions
└── index.tsx        # Entry point
```

## License

MIT

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.
