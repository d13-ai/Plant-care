// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite on web runs SQLite as WebAssembly; Metro has to treat the
// .wasm file as an asset or the web bundle fails to resolve it.
config.resolver.assetExts.push("wasm");

// SharedArrayBuffer (needed by the wasm build) requires cross-origin isolation.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  middleware(req, res, next);
};

module.exports = config;
