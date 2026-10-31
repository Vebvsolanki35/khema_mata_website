# Trust-supplied media

Files here are served at `/assets/<filename>` and are registered in
`src/config/media.js`. A file that is not registered simply never renders —
no broken images appear on the site.

## Files in use

| File | Config key | Source | Status |
|---|---|---|---|
| `bank-payment-qr.png` | `bankQr` | Cropped from the ICICI Bank card | ✅ QR decoded & verified as a UPI payment QR |
| `temple-entrance.jpg` | `templeEntrance` | Original temple entrance photograph | ✅ Original photo, resized only |
| `bank-card-full.jpg` | *(not referenced)* | Full rotated ICICI card | Available if you'd rather show the whole card |

## What was done to the originals

The WhatsApp-supplied photos were shot rotated, so they were processed before
being published:

- **Bank card** — rotated 90° counter-clockwise (the QR's finder-pattern
  geometry confirmed the correct direction), then cropped to the QR symbol plus
  a quiet zone.
- **Temple photograph** — already upright (verified: dark, low-texture sky band
  across the top, warm stone below; dominant lines within 2.5° of horizontal).
  Resized to 1600px wide only. **Not** re-shot, restyled or replaced.

Every processed QR was **re-decoded from the delivered file** to prove it still
scans to the identical payload.

Deliberately avoided: re-encoding to 2–4 colours. Tested and rejected — it
corrupted the QR so it no longer decoded. The published QR files are lossless
grayscale PNGs.

## Not published

The **Trust President's identity card** is deliberately NOT in this folder. It
contains personal details (mobile number, address) and is only rendered if you
explicitly approve it. The originals live in `source-images/` at the repo root,
which is gitignored so it is never committed or served.

## Rules

- Use the **original** files. Never regenerate, upscale, or replace the temple
  photograph with stock or AI imagery.
- The temple no longer runs a WhatsApp *group*; the retired group QR
  (`whatsapp-group-qr.png`) is intentionally removed from this folder and from
  `src/config/media.js`. Promotions now use the official WhatsApp **Channel**
  link in `src/config/constants.js` only.
- Crop / rotate freely, but never redraw or "clean up" a QR.
