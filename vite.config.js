import { defineConfig } from 'vite';

export default defineConfig({
  // 1. Set the project root to the 'tierranker' subdirectory
  // Vite will now look for index.html in /tierranker/index.html
  root: 'tierranker',

  // 2. Set the base URL for the deployed site.
  // This MUST match the final URL structure: /<repo-name>/<subdirectory>/
  base: '/NeoTierMaker/tierranker/',

  build: {
    // 3. Set the output directory to be 'dist' at the repository's root.
    // The path is relative to the `root` option, so '../dist' places it
    // one level up from 'tierranker', which is the repo root.
    outDir: '../dist',
    // Optional: Empty the output directory before building
    emptyOutDir: true,
  }
});