// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite on web runs SQLite as WebAssembly; Metro has to treat the
// .wasm file as an asset or the web bundle fails to resolve it.
config.resolver.assetExts.push("wasm");

// SharedArrayBuffer (needed by the wasm build) requires cross-origin isolation.
// That policy also blocks cross-origin images that don't send
// Cross-Origin-Resource-Policy, which Supabase Storage doesn't — so photos
// pulled from another phone come through this origin instead. Vercel does the
// same rewrite in production (vercel.json); this keeps dev honest, or the bug
// only ever shows up after a deploy.
const BUCKET_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/plant-photos/`;

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  if (req.url?.startsWith("/plant-photos/")) {
    const target = BUCKET_URL + req.url.slice("/plant-photos/".length);
    fetch(target)
      .then(async (upstream) => {
        res.statusCode = upstream.status;
        res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
        res.end(Buffer.from(await upstream.arrayBuffer()));
      })
      .catch(() => {
        res.statusCode = 502;
        res.end();
      });
    return;
  }
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  middleware(req, res, next);
};

module.exports = config;
