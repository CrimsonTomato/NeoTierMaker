import { defineConfig } from 'vite';

// We use a function form of defineConfig to get access to the 'command' variable.
// 'command' will be 'serve' for the dev server (npm run dev)
// 'command' will be 'build' for production builds (npm run build)
export default defineConfig(({ command }) => {
  const isProduction = command === 'build';

  return {
    // Tell Vite that the root of our app is inside the 'tierranker' folder
    root: 'tierranker',

    // This is the key:
    // - For production builds, use the full GitHub Pages path.
    // - For local development, use a simple root path '/'.
    base: isProduction ? '/NeoTierMaker/' : '/',

    build: {
      // Place the build output in a 'dist' folder at the project's root.
      // The path is relative to the `root` option, so '../dist' goes up
      // one level from 'tierranker'.
      outDir: '../dist',
      emptyOutDir: true,
    }
  };
});