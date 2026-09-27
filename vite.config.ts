import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Web MIDI requereix "secure context". `localhost` ja ho és, així que
// el servidor de desenvolupament funciona directament sobre http://localhost.
//
// El `index.html` viu a `src/`, així que establim `root: 'src'` i redirigim
// la sortida de build a `dist/` (a l'arrel del projecte) per mantenir-ho net.
export default defineConfig({
  root: 'src',
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    host: true,
  },
});
