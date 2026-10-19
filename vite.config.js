import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// The base path of the deployment:
//   - '/' in local development and in a preview of the build
//   - '/<repository-name>/' in GitHub Pages, where the site lives in a subfolder
// It is set with the VITE_BASE environment variable, so forking or renaming the
// repository does not require touching this file.
const base = process.env.VITE_BASE || '/'

// primeicons ships the very same font in four formats (eot, ttf, woff and svg),
// which adds about 400 kB to the build. Only the woff is kept: it is supported
// by every browser that matters and it is the smallest of the four.
function trimPrimeiconsFonts() {
  return {
    name: 'trim-primeicons-fonts',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0]
      if (!file.endsWith('primeicons.css')) return null
      const trimmed = code.replace(
        /@font-face\s*\{[^}]*\}/,
        `@font-face {
    font-family: 'primeicons';
    font-display: block;
    src: url('./fonts/primeicons.woff') format('woff');
    font-weight: normal;
    font-style: normal;
}`
      )
      return { code: trimmed, map: null }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base,
  server: {
    port: 31653
  },
  plugins: [vue(), trimPrimeiconsFonts()]
})
