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
  /**
   * Payment QR cropped from the trust's ICICI Bank card.
   * Verified by decoding: it is a UPI QR paying to the account in
   * src/config/donation.js. Original photo rotated 90° and cropped to the
   * symbol + quiet zone; the payload was re-decoded from the delivered file to
   * confirm the crop is still scannable.
   */
  bankQr: "/assets/bank-payment-qr.png",

  /**
   * WhatsApp group QR cropped from the screenshot the trust supplied.
   * Verified by decoding — it resolves to the same invitation as
   * WHATSAPP_GROUP_INVITE.
   */
  whatsappGroupQr: "/assets/whatsapp-group-qr.png",

  /** Authentic temple entrance photograph supplied by the trust. */
  templeEntrance: "/assets/temple-entrance.jpg",
};

export default MEDIA;
