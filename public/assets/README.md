# Trust-supplied media

Drop the trust's original image files here, then register each one in
`src/config/media.js`. A file that is not registered simply never renders —
no broken images appear on the site.

| Slot | Config key (`src/config/media.js`) | Source |
|---|---|---|
| Bank / payment QR | `bankQr` | ICICI Bank card |
| WhatsApp group QR | `whatsappGroupQr` | WhatsApp group QR screenshot |
| Temple photograph | `templeEntrance` | Original temple entrance photo |

Trust committee member photos go in `public/assets/trust/` and are referenced
from `src/data/trustCommittee.js` (`photo` field).

## Rules

- Use the **original** files. Never regenerate, upscale or replace the temple
  photograph with stock or AI imagery.
- Crop / rotate as needed, but keep the QR codes square and un-cropped at the
  quiet-zone edges so they stay scannable.
- The bank QR and the WhatsApp group QR are **different QR codes** and render in
  different sections — do not swap them.
