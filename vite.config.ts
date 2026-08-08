import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    port: 8080,
    hmr: {
      overlay: false,
    },
    headers: {
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; frame-ancestors 'none'; form-action 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co ws: http://localhost:* https://*.lovable.app https://*.lovableproject.com;",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy":
        "accelerometer=(), autoplay=(), camera=(), display-capture=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), xr-spatial-tracking=()",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  },
  plugins: [react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Modern browsers only — smaller polyfills, faster parse.
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split heavy vendor libs so unauth landing users don't pay for
        // charts/OCR bundles, and route caches stay warm across releases.
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return;
          if (id.includes("tesseract.js")) return "vendor-ocr";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("react-dom") || id.includes("scheduler") || /[\\/]react[\\/]/.test(id)) return "vendor-react";
        },
      },
    },
  },
}));
