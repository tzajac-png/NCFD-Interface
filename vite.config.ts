import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Proxies CSV export so “Anyone with the link can view” works without browser CORS blocks. */
const gdocProxy = {
  "/gdoc-csv": {
    target: "https://docs.google.com",
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/gdoc-csv/, ""),
  },
} as const;

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-dom")) return "vendor-react-dom";
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("/react/")) return "vendor-react";
        },
      },
    },
  },
  server: {
    proxy: { ...gdocProxy },
  },
  preview: {
    proxy: { ...gdocProxy },
  },
});
