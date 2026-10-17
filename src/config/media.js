/**
 * Image / media asset registry.
 *
 * Every asset the trust supplies is referenced from here, so adding a photo is a
 * one-line change and no component has to be touched.
 *
 * HOW TO ADD AN IMAGE
 * 1. Drop the file into `public/assets/` (e.g. `public/assets/temple-entrance.jpg`).
 * 2. Set the matching value below to `/assets/<filename>`.
 * 3. The section renders automatically.
 *
 * A `null` value means "asset not supplied yet" — the section then shows a
 * clearly-labelled pending state instead of a broken image.
 *
 * NOTE: never generate or substitute artwork for `temple*` entries. These must
 * stay as the original photographs supplied by the trust.
 */

export const MEDIA = {
  /** Bank / payment QR supplied by the trust (from the ICICI card). */
  bankQr: null, // e.g. "/assets/bank-qr.jpg"

  /** WhatsApp group QR screenshot supplied by the trust. */
  whatsappGroupQr: null, // e.g. "/assets/whatsapp-group-qr.png"

  /** Authentic temple photograph (entrance shot) supplied by the trust. */
  templeEntrance: null, // e.g. "/assets/temple-entrance.jpg"
};

export default MEDIA;
