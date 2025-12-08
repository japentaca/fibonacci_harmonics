# Fibonacci Harmonics

Interactive web app to explore harmonics generated from the Fibonacci sequence using a chosen fundamental frequency. Built with Vue 3 and Vite, it uses Tone.js for real‑time audio synthesis and PrimeVue for the UI.

## Live Demo

Visit: https://japentaca.github.io/fibonacci_harmonics/

## Features

- Real‑time audio engine powered by `tone`
- Harmonics generator derived from Fibonacci numbers
- Adjustable controls: `Fundamental`, `Count`, `Multiplier`, `Offset`, and `Volume`
- Multiple oscillator types: `sine`, `sawtooth`, `triangle`, `square` (and extended variants)
- Stereo panning across harmonics for spacious sound
- Arpeggiator with patterns: `up`, `down`, `updown`, `random`, adjustable tempo and envelope
- Modern UI with `primevue`, `primeflex`, and `primeicons`

## Tech Stack

- `vue` (3.x)
- `vite` (7.x)
- `tone`
- `primevue`, `primeflex`, `primeicons`
- `chart.js` (installed; available for future visualization)

## Getting Started

### Prerequisites

- Node.js 20+ recommended

### Install

```bash
npm install
```

### Develop

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Deployment (GitHub Pages)

This repository includes a GitHub Actions workflow that automatically builds and deploys the site on every push to `main`.

1. In your GitHub repository, go to `Settings → Pages` and set `Source` to `GitHub Actions`.
2. Push to `main`. The workflow (`.github/workflows/deploy.yml`) will:
   - Check out the repo
   - Install dependencies (`npm ci`)
   - Build (`npm run build`)
   - Publish the `dist` output to GitHub Pages

Important: Vite is already configured for a project page with `base: '/fibonacci_harmonics/'` in `vite.config.js`. If you fork or rename the repository, update `base` accordingly to match `/<your-repo-name>/`.

### Alternative Branch/Folders (optional)

- `main / docs`: set `build.outDir = 'docs'`, commit `docs/`, and set Pages to deploy from `main / docs`.
- `gh-pages` branch: build locally or via Actions and publish `dist` to the `gh-pages` branch.

## Usage

- Click `Start Audio Engine` to unlock the audio context (required by browsers).
- Adjust `Fundamental`, `Count`, `Multiplier`, and `Offset` to shape the harmonic series.
- Choose an oscillator type to change timbre.
- Use `Volume` to set overall loudness (mapped to dB for smoother control).
- Toggle the `Arpeggiator` and pick a pattern; adjust `Tempo` for playback speed.

## Project Structure

```
.
├─ index.html            # App entry (built by Vite)
├─ vite.config.js        # Vite config with base path
├─ src/
│  ├─ main.js            # Vue bootstrapping
│  ├─ App.vue            # Root component
│  ├─ style.css          # Global styles
│  └─ components/
│     └─ Fibonacci.vue   # Core UI + audio logic
└─ .github/workflows/deploy.yml  # Pages deploy via Actions
```

## Configuration Notes

- `vite.config.js` sets `base: '/fibonacci_harmonics/'` so built assets resolve correctly under `https://<user>.github.io/fibonacci_harmonics/`.
- If you change the repository name or publish under a different path, update `base` to match.

## Troubleshooting

- 404 to `/src/main.js`: This means Pages is serving source files instead of the built site. Ensure Pages `Source` is `GitHub Actions` and that the deploy workflow is succeeding.
- No sound on load: Browsers require a user gesture to start audio. Click `Start Audio Engine` before expecting output.

## License

MIT License. See `LICENSE` for details.
