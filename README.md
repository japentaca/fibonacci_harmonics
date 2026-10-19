# Fibonacci Harmonics

**Explore the mathematics of sound.**

Fibonacci Harmonics is a browser synthesizer that builds a harmonic series out of the
Fibonacci sequence. Pick a fundamental, choose how many partials you want, and the app
turns the Fibonacci numbers into a stack of oscillators you can hear, modulate and
record.

**Live demo:** https://japentaca.github.io/fibonacci_harmonics/

---

## Features

- **Harmonics generator** — a series of partials derived from the Fibonacci numbers,
  with a fundamental, a count of partials and an offset that shifts the starting partial.
- **Three mapping modes** — `Fibonacci`, `Harmonic` and `Legacy (additive)`.
- **Nyquist guard** — partials that would fall above the Nyquist frequency are dropped
  automatically, and the UI tells you how many were removed.
- **20 oscillator types** — `sine`, `sawtooth`, `triangle` and `square`, plus the
  extended variants with their own partials (`sine2` … `square5`).
- **Stereo panning** — the fundamental stays in the centre and the rest of the
  partials are spread symmetrically to the left and to the right.
- **Three LFOs** — one for the fundamental, one for the count of partials and one for
  the offset, each with its own waveform, speed and range.
- **Arpeggiator** — `up`, `down`, `up-down` and `random` patterns with an adjustable
  tempo, an ADSR envelope and a stereo spread.
- **Ping-pong delay** — a stereo delay with send, time and feedback.
- **Spectrum analyser** — a live FFT of the master output on a logarithmic scale,
  with the strongest peaks labelled with their frequency.
- **Built-in presets** — six of them, plus the option to load the state of a shared link.
- **Shareable links** — the whole state travels in the URL hash, so a sound can be sent
  to anyone with a link.
- **Export to WAV** — renders the current sound to a 16-bit PCM file that you can use
  anywhere.
- **Keyboard shortcuts** — with an in-app help panel.

## Tech Stack

- [Vue](https://vuejs.org/) 3 (Composition API, no TypeScript)
- [Vite](https://vite.dev/) 7
- [Tone.js](https://tonejs.github.io/) 15
- [PrimeVue](https://primevue.org/) 3, [PrimeFlex](https://primevue.org/primeflex/) and
  [PrimeIcons](https://primeicons.org/)
- [ESLint](https://eslint.org/) 10 with `eslint-plugin-vue` (flat config)
- Node.js built-in test runner (`node --test`)

## Getting Started

### Prerequisites

- Node.js 20.19 or newer (the minimum required by ESLint 10)

### Install

```bash
npm install
```

### Develop

```bash
npm run dev
```

The development server listens on <http://localhost:31653>.

### Build

```bash
npm run build
```

The production build is written to `dist/`.

### Preview the production build

```bash
npm run preview
```

### Test

```bash
npm test
```

The test suite runs with the Node.js built-in test runner and covers the pure modules:
the harmonic series math, the presets and the shareable links, the WAV encoder, the
offline export and the keyboard shortcuts.

### Lint

```bash
npm run lint        # check the code
npm run lint:fix    # check the code and apply the fixes that are safe
```

## How it works

### The harmonic series

The first oscillator always plays the fundamental. Every other oscillator plays a
partial, and the **offset** decides which partial is the first one: with an offset of
`o`, the partial at position `i` is the partial number `p = i + o`.

The three mapping modes turn that partial number `p` into a frequency:

| Mode | Frequency of the partial `p` | Series with `f = 440 Hz`, count `3`, offset `2` |
| --- | --- | --- |
| `Fibonacci` | `f × fib(p + 2)` | `440`, `2200`, `3520` Hz |
| `Harmonic` | `f × (p + 1)` | `440`, `1760`, `2200` Hz |
| `Legacy (additive)` | `f + fib(p)` | `440`, `442`, `443` Hz |

With those values the partial numbers are `p = 3` and `p = 4`, and the Fibonacci
numbers are `fib(5) = 5` and `fib(6) = 8`, hence `440 × 5 = 2200` and `440 × 8 = 3520`
in the Fibonacci mode.

The `Legacy (additive)` mode is the original behaviour of the app: the Fibonacci
numbers are *added* to the fundamental, so the result is a close cluster of
frequencies instead of a wide series.

### The Nyquist guard

A digital audio file cannot hold frequencies above half of its sample rate, the
**Nyquist frequency** (22 050 Hz at 44.1 kHz). A partial that goes over that limit is
not a very high note, it is an alias: it folds back into the audible range and sounds
wrong.

To avoid that, the app only lets the partials grow up to **95 % of the Nyquist
frequency** (20 947.5 Hz at 44.1 kHz). Every partial above that limit is dropped from
the tail of the series, and the counter under `Count` shows how many were removed
(`3 / 5`, `2 above Nyquist`). The count of partials you asked for is always kept in
the state, so raising the fundamental brings the dropped partials back.

## The three LFOs

Every LFO has a **switch**, a **waveform**, a **speed** and a **range**.

| Waveform | Shape |
| --- | --- |
| `Sine` | Smooth, the most musical one |
| `Triangle` | Like the sine, but with straight edges |
| `Square` | Two levels, sharp and rhythmic |
| `Sawtooth` | A ramp from the minimum to the maximum |
| `Inverse Sawtooth` | The same ramp, upside down |

- **Speed** goes from `0.01 Hz` to `5 Hz` (one cycle every 100 s down to one cycle
  every 0.2 s). The slider is exponential, so the low frequencies are precise.
- The **fundamental LFO is native**: it is a `Tone.LFO` that modulates the detune of
  every oscillator in **cents**, so the whole series moves as one block. Its range is
  written in hertz in the UI (for example `220` – `660` Hz) and converted to cents
  relative to the current fundamental with `1200 × log₂(f / fundamental)`.
- The **count LFO** and the **offset LFO** are control rate (every 33 ms): they write
  the number of partials and the offset directly, which is why the count moves in
  whole numbers and the offset glides continuously.

The waveform of each LFO is drawn in a small canvas with a cursor that follows the
real phase of the audio clock.

## The arpeggiator

The arpeggiator plays the partials one by one instead of all together. It has its own
set of eight oscillators with an ADSR envelope, spread across the stereo field, and it
mutes the main oscillators while it is running.

- **Patterns**: `Up`, `Down`, `Up-Down` and `Random`.
- **Tempo**: the time between two notes, from `50 ms` to `500 ms`.
- The partial that is playing right now is highlighted in the strip of tags at the
  bottom of the screen.

## The ping-pong delay

A stereo delay where every repetition bounces from one side to the other.

- **Send**: how much of the master bus goes into the delay (`0` – `100 %`).
- **Time**: the delay of every repetition (`0.05` – `1 s`).
- **Feedback**: how much of the output comes back into the delay (`0` – `90 %`).

The wet signal is taken from the master bus and goes through the limiter, so it can
never feed back past full scale.

## Presets and sharing

The **Load preset** dropdown has six built-in presets — `Warm Pad`, `Legacy Cluster`,
`Fundamental Drift`, `Bright Shimmer`, `Slow Swell` and `Random Machine` — and one more
entry, `Load from URL`, that applies the state stored in the address bar.

The **Copy link** button serialises the whole state (fundamental, count, offset,
mapping mode, oscillator, volume, delay, arpeggiator and the three LFOs), encodes it
with base64url and writes it in the hash of the URL:

```
https://japentaca.github.io/fibonacci_harmonics/#s=<encoded state>
```

The state is applied as soon as the app is loaded, so the link is enough to reproduce
the sound. The **Reset** button clears the hash and goes back to the default state.

## Export to WAV

The **Export WAV** button renders the current sound offline and downloads it as a
stereo 16-bit PCM file named `fibonacci-harmonics-<preset or session>-<date>.wav`.

The render includes the harmonic series, the oscillator type, the volume, the stereo
panning and the ping-pong delay, with a short fade in and fade out so the file never
starts or ends with a click.

The render is **static**, so it does **not** include:

- the **arpeggiator**, because the export renders a held chord, not a sequence;
- the **LFOs**, because the export renders a frozen snapshot of the series.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Start the audio engine, or toggle the arpeggiator once it is running |
| `Esc` | Close the help panel, or panic: release every note |
| `1` – `4` | Arpeggiator pattern: up, down, up-down, random |
| `M` | Mute and unmute the output |
| `L` | Switch the three LFOs on and off |
| `?` / `H` | Show or hide the help panel |

The shortcuts are ignored while you are typing in a form control or while a button has
the focus, so they never get in the way of the normal navigation.

## Project structure

```
.
├─ index.html              # App entry, meta tags and Open Graph (built by Vite)
├─ eslint.config.js        # Flat config of ESLint
├─ vite.config.js          # Vite config, the base path and the primeicons trim
├─ public/
│  ├─ favicon.svg
│  └─ landing-hero.svg
├─ src/
│  ├─ main.js              # Vue bootstrapping and the theme imports
│  ├─ App.vue              # Root component
│  ├─ style.css            # Global styles, focus ring and reduced motion
│  ├─ presets.js           # Built-in presets, state serialisation and hash links
│  ├─ presets.test.js
│  ├─ audio/
│  │  ├─ constants.js      # Shared constants
│  │  ├─ fibonacci.js      # Pure math of the harmonic series
│  │  ├─ fibonacci.test.js
│  │  ├─ wav.js            # 16-bit PCM WAV encoder
│  │  ├─ wav.test.js
│  │  ├─ exportWav.js      # Offline render and download
│  │  ├─ exportWav.test.js
│  │  ├─ useSynth.js       # Oscillators, panning, master chain and limiter
│  │  ├─ useDelay.js       # Ping-pong delay
│  │  ├─ useLfo.js         # The three LFOs
│  │  ├─ useArpeggiator.js # The arpeggiator
│  │  ├─ useKeyboard.js    # Keyboard shortcuts
│  │  └─ useKeyboard.test.js
│  └─ components/
│     ├─ Fibonacci.vue     # Core UI and audio logic
│     ├─ LfoControl.vue    # LFO panel and waveform canvas
│     └─ SpectrumView.vue  # Spectrum analyser canvas
└─ .github/workflows/
   ├─ ci.yml               # Lint, test and build on every push and pull request
   └─ deploy.yml           # Build and publish to GitHub Pages
```

The modules under `src/audio/` that are pure (`fibonacci.js`, `wav.js`, `constants.js`)
and the whole `src/presets.js` do not import Vue nor Tone.js, so they can be tested in
isolation with `node --test`.

## Deployment

The site is published to **GitHub Pages** by the workflow
`.github/workflows/deploy.yml`, which runs on every push to `main`:

1. Check out the repository
2. Set up Node.js 20 with the npm cache
3. Install the dependencies (`npm ci`)
4. Run the tests (`npm test`)
5. Build the app (`npm run build`) with `VITE_BASE=/<repository-name>/`
6. Upload the `dist` folder and publish it

The base path of the build is **not** hardcoded. `vite.config.js` reads it from the
`VITE_BASE` environment variable and falls back to `/`:

```js
base: process.env.VITE_BASE || '/'
```

In GitHub Pages the workflow sets `VITE_BASE` to the name of the repository, so
forking or renaming the repository does not break the deployment. Locally, `npm run
dev` and `npm run preview` serve the app at the root of the server.

### Other ways to publish

- `main / docs`: set `build.outDir = 'docs'`, commit `docs/` and point Pages to
  `main / docs`.
- `gh-pages` branch: build locally or with Actions and publish `dist` to that branch.

## Troubleshooting

- **404 to `/src/main.js`**: Pages is serving the source files instead of the built
  site. Make sure the `Source` of Pages is `GitHub Actions` and that the deploy
  workflow is green.
- **No sound**: browsers only allow audio after a user gesture. Click
  `Start Audio Engine` before expecting any output.
- **A partial disappears**: it went over the Nyquist limit. Lower the fundamental or
  the count of partials.

## License

MIT License. See [LICENSE](LICENSE) for the details.

Copyright (c) 2022 Javier Ntaca
