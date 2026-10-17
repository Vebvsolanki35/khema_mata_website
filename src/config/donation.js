/**
 * Single source of truth for everything shown on the Donation page.
 *
 * VERIFICATION POLICY
 * -------------------
 * Nothing here is presented as authentic until it has been confirmed. Each block
 * carries a `verified` flag:
 *   verified: true  -> shown as trust-confirmed details
 *   verified: false -> shown with a "pending confirmation" badge
 *
 * The pre-existing UPI IDs are KEPT (not deleted) so no working payment route is
 * lost before a replacement is approved, but they are flagged so you can review
 * them. Replace or remove them only once you have confirmed the real IDs.
 */

/** UPI IDs already live on the site. Flagged for your confirmation. */
export const UPI_IDS = [
  {
    label: "PhonePe / Google Pay",
    id: "kheemajmata.dei@upi",
    verified: false,
  },
  {
    label: "Paytm",
    id: "temple.dei.bundi@paytm",
    verified: false,
  },
];

/**
 * Bank account details taken from the ICICI Bank card you supplied.
 *
 * - bankName / accountNumber / ifsc: as transcribed from the card.
 * - accountHolderName: LEFT BLANK ON PURPOSE. The printed name on the card could
 *   not be read reliably, so no name is invented. Please confirm the exact
 *   printed account-holder name and it will be filled in.
 * - branch / accountType: not readable from the material supplied.
 */
export const BANK_DETAILS = {
  bankName: "ICICI Bank",
  accountNumber: "686005601933",
  ifsc: "ICIC0006860",
  accountHolderName: "", // <-- CONFIRM: exact printed name on the card
  branch: "", // <-- CONFIRM (e.g. "Bundi, Rajasthan")
  accountType: "", // <-- CONFIRM (e.g. "Savings")
  /** Set to true only after you have confirmed the fields above. */
  verified: false,
};

/**
 * The QR printed on the supplied card.
 *
 * The QR image has NOT been decoded, so it is NOT assumed to be a UPI payment QR.
 * It may be a UPI QR, a bank-branded static QR, a URL, or something else entirely.
 * No UPI ID, beneficiary name or payment link has been derived from it.
 */
export const DONATION_QR = {
  /** Path is set to null until the image is decoded/verified. */
  src: null,
  /** Only flip to true after you confirm what this QR actually pays to. */
  verifiedAsPaymentQr: false,
  /** Shown next to the QR until it is verified. */
  unverifiedNote:
    "इस QR को अभी तक सत्यापित नहीं किया गया है। दान भेजने से पहले कृपया ऊपर दिए गए खाता विवरण से भुगतान करें।",
};

export default { UPI_IDS, BANK_DETAILS, DONATION_QR };
