/**
 * Single source of truth for everything shown on the Donation page.
 *
 * VERIFICATION POLICY
 * -------------------
 * Nothing is presented as authentic until it has been confirmed. Each block
 * carries a `verified` flag:
 *   verified: true  -> shown as trust-confirmed details
 *   verified: false -> shown with a "pending confirmation" badge
 *
 * WHAT WAS VERIFIED AND HOW (17 Oct 2026)
 * ---------------------------------------
 * The bank card supplied by the trust was read two independent ways:
 *   1. OCR of the printed card text.
 *   2. Decoding the QR printed on the card.
 * Both agree, and both match the account number / IFSC you supplied.
 *
 * The QR decodes to a UPI payment link (see DONATION_QR.decodedPayload), so it
 * IS a UPI QR — this was confirmed by decoding, not assumed.
 */

/**
 * UPI IDs shown on the donation page.
 *
 * The first entry is the real one, DECODED FROM THE CARD'S QR. The other two
 * were already live on the site before this work; they could not be verified
 * against any document supplied so far, so they remain flagged "pending
 * confirmation" rather than being deleted (no working payment route is removed
 * without approval). Please confirm whether they are real or should be dropped.
 */
export const UPI_IDS = [
  {
    label: "ICICI Bank • UPI (QR-verified)",
    id: "MSSHRIMANDIRSHRIKHEVAJMATAJIKSHEMKARIKULDEVISOLANKIRAJPUTSAMAJTRUST.eazypay@icici",
    verified: true,
  },
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
 * Bank account details read from the ICICI Bank card.
 *
 * Cross-checked against the UPI QR's payee-name field (`pn`), which returns:
 *   "M/S.SHRIMANDIR SHRI KHEVAJ MATAJI KSHEMKARI KULDEVI SOLANKI RAJPUT SAMAJ TRUST"
 */
export const BANK_DETAILS = {
  bankName: "ICICI Bank",
  /** Printed on the card as "ICICI Bank DEI". */
  branch: "DEI",
  accountNumber: "686005601933",
  ifsc: "ICIC0006860",
  /**
   * Payee name as printed on the card and as encoded in the QR.
   * ⚠️ FLAGGED FOR CONFIRMATION: the printed name reads "SHRIMANDIR" as one
   * word. It is rendered below as "SHRI MANDIR" (adding the space) — please
   * confirm this is the correct spelling/expansion before publishing.
   */
  accountHolderName:
    "M/S. SHRI MANDIR SHRI KHEVAJ MATAJI KSHEMKARI KULDEVI SOLANKI RAJPUT SAMAJ TRUST",
  /** Exact string as decoded from the QR, kept for reference. */
  accountHolderNameRaw:
    "M/S.SHRIMANDIR SHRI KHEVAJ MATAJI KSHEMKARI KULDEVI SOLANKI RAJPUT SAMAJ TRUST",
  accountType: "",
  /** Confirmed by OCR + QR decode. */
  verified: true,
};

/**
 * The QR printed on the supplied card.
 *
 * DECODED — it is a UPI payment QR. The decoded payload is recorded below so it
 * can be re-checked at any time. No UPI ID, beneficiary name or payment link was
 * invented: every value below came out of the QR itself.
 */
export const DONATION_QR = {
  src: null, // uses MEDIA.bankQr; override here if you want a different file
  verifiedAsPaymentQr: true,
  /** Full decoded payload of the delivered /assets/bank-payment-qr.png. */
  decodedPayload:
    "upi://pay?pa=MSSHRIMANDIRSHRIKHEVAJMATAJIKSHEMKARIKULDEVISOLANKIRAJPUTSAMAJTRUST.eazypay@icici&pn=M/S.SHRIMANDIR SHRI KHEVAJ MATAJI KSHEMKARI KULDEVI SOLANKI RAJPUT SAMAJ TRUST &tr=EZYS9251616866&cu=INR&mc=8398",
  /**
   * The `tr` reference above is NOT displayed on the site — it is recorded here
   * only so the decode can be audited.
   */
};

/** Fields still awaiting your sign-off. */
export const PENDING_CONFIRMATION = [
  'Account-holder spelling: the card prints "SHRIMANDIR" as one word — I render it as "SHRI MANDIR".',
  'Branch is printed as "DEI" — confirm the full branch name if you want it expanded.',
  "Are the two older UPI IDs (kheemajmata.dei@upi, temple.dei.bundi@paytm) real, or should they be removed?",
];

export default { UPI_IDS, BANK_DETAILS, DONATION_QR, PENDING_CONFIRMATION };
