import { defineConfig } from "vite";
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "three-vendor": ["three"],
          "scene-vendor": ["@react-three/fiber", "@react-three/drei"],
        },
      },
    },
  },
});
