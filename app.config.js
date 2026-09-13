// Layers over app.json. Expo reads both; this only adds what can't live in
// static JSON: the base path for a GitHub Pages build (scripts/deploy-pages.mjs
// sets EXPO_BASE_URL). Unset, the config is exactly app.json.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
