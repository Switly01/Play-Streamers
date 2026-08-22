import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 4178,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
