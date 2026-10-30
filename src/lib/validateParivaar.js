/**
 * Validation & sanitization utilities for the Solanki Parivaar Community Directory.
 *
 * Enforces:
 * - Required field checks (Name, State/UT, District, Tehsil/Block, Thikana, Current Address, Phone Number, Consent)
 * - Optional "Thikana is the same as Village" (`thikanaSameAsVillage`) validation:
 *   - Not checked by default
 *   - When checked, requires a valid official Village selection and uses the official Village name as Thikana
 *   - When unchecked, validates the manually entered Thikana text independently
 * - Indian 10-digit mobile number validation (starts with 6–9, optional +91/0 prefix stripped, rejects repeated fake digits)
 * - Protection against HTML/script injection and malformed input
 */

const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;
const REPEATED_DIGIT_RE = /^(\d)\1{9}$/;
const PINCODE_RE = /^[1-9]\d{5}$/;
const UNSAFE_HTML_RE = /[<>]/;

const HINDI_SEARCH_ALIASES = {
  राजस्थान: "rajasthan",
  गुजरात: "gujarat",
  "मध्य प्रदेश": "madhya pradesh",
  मध्यप्रदेश: "madhya pradesh",
  "उत्तर प्रदेश": "uttar pradesh",
  उत्तरप्रदेश: "uttar pradesh",
  महाराष्ट्र: "maharashtra",
  दिल्ली: "delhi",
  हरियाणा: "haryana",
  पंजाब: "punjab",
  बिहार: "bihar",
  झारखंड: "jharkhand",
  छत्तीसगढ़: "chhattisgarh",
  उत्तराखंड: "uttarakhand",
  "हिमाचल प्रदेश": "himachal pradesh",
  कर्नाटक: "karnataka",
  तमिलनाडु: "tamil nadu",
  तेलंगाना: "telangana",
  "आंध्र प्रदेश": "andhra pradesh",
  केरल: "kerala",
  ओडिशा: "odisha",
  "पश्चिम बंगाल": "west bengal",
  असम: "assam",
  गोवा: "goa",
  बूंदी: "bundi",
  बून्दी: "bundi",
  कोटा: "kota",
  जयपुर: "jaipur",
  जोधपुर: "jodhpur",
  उदयपुर: "udaipur",
  अजमेर: "ajmer",
  भीलवाड़ा: "bhilwara",
  चित्तौड़गढ़: "chittorgarh",
  पाली: "pali",
  जालौर: "jalore",
  सिरोही: "sirohi",
  बाड़मेर: "barmer",
  जैसलमेर: "jaisalmer",
  बीकानेर: "bikaner",
  सीकर: "sikar",
  झुंझुनू: "jhunjhunu",
  नागौर: "nagaur",
  राजसमंद: "rajsamand",
  प्रतापगढ़: "pratapgarh",
  डूंगरपुर: "dungarpur",
  बांसवाड़ा: "banswara",
  झालावाड़: "jhalawar",
  बारां: "baran",
  तलेरा: "talera",
  तालेड़ा: "talera",
  केशोरायपाटन: "keshoraipatan",
  नैनवां: "nainwa",
  हिण्डोली: "hindoli",
  हिंडोली: "hindoli",
  इन्द्रगढ़: "indragarh",
  इंद्रगढ़: "indragarh",
  छापावदा: "chhapawda",
  छापावड़ा: "chhapawda",
  देई: "dei",
};

/**
 * Normalizes Hindi and English place search strings so users can search in
 * Devanagari (e.g. राजस्थान, बूंदी, तलेरा, छापावदा) or English/phonetic spellings
 * (e.g. Chhapawada / Chhapawda).
 */
export function normalizePlaceSearch(str) {
  let s = String(str || "").trim().toLowerCase();
  for (const [hi, en] of Object.entries(HINDI_SEARCH_ALIASES)) {
    if (s.includes(hi)) {
      s = `${s} ${en}`;
    }
  }
  return s
    .replace(/wada/g, "wda")
    .replace(/wara/g, "wra")
    .replace(/kheda/g, "khera")
    .replace(/gadh/g, "garh")
    .replace(/aa/g, "a")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u");
}

/**
 * Normalizes an Indian phone number string to a 10-digit mobile number.
 */
export function normalizeIndianPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Returns true if the input is a valid 10-digit Indian mobile number.
 */
export function isValidIndianPhone(raw) {
  const normalized = normalizeIndianPhone(raw);
  return INDIAN_MOBILE_RE.test(normalized) && !REPEATED_DIGIT_RE.test(normalized);
}

/**
 * Validates the Parivaar family registration form values.
 * @param {Object} values
 * @param {Object} messages - localized validation error strings
 * @returns {Object} field -> error message map (empty object when valid)
 */
export function validateParivaarRegistration(values, messages = {}) {
  const errors = {};

  const name = String(values.fullName || "").trim();
  if (name.length < 2 || name.length > 120 || UNSAFE_HTML_RE.test(name)) {
    errors.fullName =
      messages.errName || "Please enter the family head's full name (2–120 characters).";
  }

  if (values.fatherName !== undefined || values.requireFatherName === true) {
    const fatherName = String(values.fatherName || "").trim();
    if (
      fatherName.length < 2 ||
      fatherName.length > 120 ||
      UNSAFE_HTML_RE.test(fatherName)
    ) {
      errors.fatherName =
        messages.errFatherName ||
        "कृपया पिता का वैध नाम दर्ज करें — 2 से 120 अक्षर (Please enter a valid Father's Name, 2–120 characters).";
    }
  }

  if (values.memberCount !== undefined) {
    const rawMembers = String(values.memberCount ?? "").trim();
    const numMembers = Number(rawMembers);
    if (
      !rawMembers ||
      !Number.isInteger(numMembers) ||
      numMembers < 1 ||
      numMembers > 250
    ) {
      errors.memberCount =
        messages.errMemberCount ||
        "कृपया परिवार के सदस्यों की वैध संख्या दर्ज करें — कम से कम 1 (Please enter a valid positive integer for number of family members).";
    }
  }

  if (!String(values.stateCode || "").trim()) {
    errors.stateCode =
      messages.errState || "Please select your State or Union Territory.";
  }

  if (!String(values.districtCode || "").trim()) {
    errors.districtCode =
      messages.errDistrict || "Please select your District.";
  }

  if (!String(values.subdistrictCode || "").trim()) {
    errors.subdistrictCode =
      messages.errSubdistrict || "Please select your Tehsil / Sub-district / Block.";
  }

  const requireVillage = values.requireVillage === true;
  const sameAsVillage = values.thikanaSameAsVillage === true;
  const villageCode = String(values.villageCode || "").trim();
  const thikana = String(values.thikana || "").trim();

  if (requireVillage) {
    if (!villageCode) {
      errors.villageCode =
        messages.errVillageRequired ||
        "कृपया आधिकारिक सूची से अपना पैतृक गाँव चुनें (Please select your ancestral Village from the official LGD list).";
    }
  } else if (sameAsVillage) {
    if (!villageCode) {
      const sameErr =
        messages.errSameVillageRequired ||
        "Please select a Village or uncheck 'Thikana is the same as Village'.";
      errors.villageCode = sameErr;
      errors.thikana = sameErr;
    } else if (
      values.selectedVillageName &&
      thikana !== String(values.selectedVillageName).trim()
    ) {
      errors.thikana =
        messages.errThikanaMismatch ||
        "When 'Thikana is the same as Village' is checked, Thikana must match the selected Village name.";
    } else if (thikana.length < 1 || thikana.length > 150 || UNSAFE_HTML_RE.test(thikana)) {
      errors.thikana =
        messages.errThikana || "Please select a valid Village for your Thikana.";
    }
  } else {
    if (thikana.length < 1 || thikana.length > 150 || UNSAFE_HTML_RE.test(thikana)) {
      errors.thikana =
        messages.errThikana || "Please enter your Thikana name.";
    }
  }

  const address = String(values.currentAddress || "").trim();
  if (address.length < 3 || address.length > 500 || UNSAFE_HTML_RE.test(address)) {
    errors.currentAddress =
      messages.errAddress || "Please enter your current residential address.";
  }

  if (!isValidIndianPhone(values.phoneNumber)) {
    errors.phoneNumber =
      messages.errPhone ||
      "Please enter a valid 10-digit Indian mobile number (starting with 6–9).";
  }

  if (!requireVillage && values.consentGiven !== true) {
    errors.consentGiven =
      messages.errConsent ||
      "Please accept the privacy and directory consent notice to register.";
  }

  return errors;
}

/**
 * Validates a missing-location report submitted for administrator review.
 */
export function validateMissingLocationReport(values, messages = {}) {
  const errors = {};

  const reporterName = String(values.reporterName || "").trim();
  if (reporterName.length < 2 || reporterName.length > 120 || UNSAFE_HTML_RE.test(reporterName)) {
    errors.reporterName =
      messages.errName || "Please enter your name.";
  }

  const proposedName = String(values.proposedName || "").trim();
  if (proposedName.length < 2 || proposedName.length > 150 || UNSAFE_HTML_RE.test(proposedName)) {
    errors.proposedName =
      messages.errProposedLocation || "Please enter the name of the missing location.";
  }

  if (values.reporterPhone && String(values.reporterPhone).trim().length > 0) {
    if (!isValidIndianPhone(values.reporterPhone)) {
      errors.reporterPhone =
        messages.errPhone || "Please enter a valid 10-digit Indian mobile number.";
    }
  }

  if (values.pincode && String(values.pincode).trim().length > 0) {
    if (!PINCODE_RE.test(String(values.pincode).trim())) {
      errors.pincode =
        messages.errPincode || "Please enter a valid 6-digit Indian PIN code.";
    }
  }

  return errors;
}

export default validateParivaarRegistration;
