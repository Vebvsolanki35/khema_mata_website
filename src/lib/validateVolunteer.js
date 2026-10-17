/**
 * Validation for the Seva / volunteer interest form.
 *
 * Kept out of the component so the rules can be unit-tested.
 *
 * Only the fields the Trust actually needs are validated. No identity
 * document, bank or payment field is ever requested, so none is handled here.
 */

const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * @returns {Object} a map of field -> error message. Empty means valid.
 */
export function validateVolunteer(values, t) {
  const errors = {};

  if (!values.fullName || !values.fullName.trim()) {
    errors.fullName = t.errName;
  }

  if (!values.activity) {
    errors.activity = t.errActivity;
  }

  if (values.contactMethod === "mobile") {
    const digits = String(values.mobile || "").replace(/\D/g, "");
    if (!MOBILE_RE.test(digits)) errors.mobile = t.errMobile;
  } else {
    if (!EMAIL_RE.test(String(values.email || "").trim())) errors.email = t.errEmail;
  }

  return errors;
}

/** True when the contact method carries a usable value. */
export function hasContact(values) {
  return values.contactMethod === "mobile"
    ? MOBILE_RE.test(String(values.mobile || "").replace(/\D/g, ""))
    : EMAIL_RE.test(String(values.email || "").trim());
}

export default validateVolunteer;
