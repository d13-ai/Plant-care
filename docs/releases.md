# Releases

What is on which phones. Two kinds of release:

- **Store builds** (Google Play): a new version code, built on EAS, reviewed by
  Google. Needed for anything native -- a new module, a permission, an
  `app.json` or `package.json` change.
- **Over-the-air updates** (EAS Update, `production` channel): JavaScript only,
  live in minutes, no review. An update reaches only builds with the same
  runtime fingerprint, so each one below names the build it is for. See
  docs/play-store.md, "Over-the-air updates", for how to publish one.

## Store builds

| Version | Built from | Track | Notes |
|---|---|---|---|
| 6 | -- | **Production**, live 11 Oct 2026 | First public release. No expo-updates: no OTA update reaches it. |
| 7 | -- | Internal testing | First with expo-updates; health checks compare an earlier photo. Its fingerprint doesn't match `main` (the first update for it was refused). |
| 8 | `61e12aa` | Internal testing; **being promoted to production, 12 Oct 2026** | The add-plant fix. Runtime `36f72ba23e93c968444de0e785e78881baed602b`. |
| 9 | -- | Not built | Planned: R8 minification (Play's DEX obfuscation warning, fix by Feb 2027). Native, so a new runtime; test on internal testing first. |

## Over-the-air updates to version 8 (runtime 36f72ba2…)

Newest last. Each includes everything before it.

| Date | Commit | Group | What |
|---|---|---|---|
| 11 Oct 2026 | `7f106d8` | a304c629 | Care guides from the plant library, cultivar notes, library labelling. |
| 11 Oct 2026 | `e09db3e` | 01a12c64 | Saved guides from before the library are fetched again, once. |
| 12 Oct 2026 | `99a8b4d` | see expo.dev | The opening sequence. |
| 12 Oct 2026 | `09f18f6` | see expo.dev | Opening sequence on every opening, slower. |
| 12 Oct 2026 | `1f5eb56` | see expo.dev | Green-room hold 1.3 s. |
| 12 Oct 2026 | `46ab00a` | see expo.dev | Green-room hold 1.1 s (3.9 s in all). |

## Release notes, version 8 (production)

```
<en-US>
What's new
• The parlour opens: a new opening as you come in.
• Adding a plant is simpler: identify it and its name is filled in, one tap to add.
• Health checks compare your new photo with an earlier one, so you can see what's changed.
• Care guides for 160+ houseplants now come from the PlantParlour plant library, the same as plantparlour.org.
• Smoother updates: improvements now reach the app without waiting for a new store version.
</en-US>
```

The opening sequence and library guides aren't in version 8's own bundle;
they arrive as the update above on its first open, and show from the next.
