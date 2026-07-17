import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // three-mesh-bvh and three ship as ESM — no special optimizeDeps handling needed,
  // but we exclude them from pre-bundling churn during dev for faster HMR.
  optimizeDeps: {
    include: ['three', 'three-mesh-bvh', 'gsap']
  },
  build: {
    target: 'esnext',
    sourcemap: false
  }
});
