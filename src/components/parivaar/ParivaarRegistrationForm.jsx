import { useEffect, useMemo, useState } from "react";
import SearchableSelect from "./SearchableSelect";

const INITIAL_FORM = {
  fullName: "",
  fatherName: "",
  memberCount: "",
  stateCode: "",
  districtCode: "",
  subdistrictCode: "",
  villageCode: "",
  currentAddress: "",
  phoneNumber: "",
};

const INITIAL_MISSING_REPORT = {
  reporterName: "",
  reporterPhone: "",
  missingLevel: "village",
  proposedName: "",
  parentContext: "",
  pincode: "",
  notes: "",
};

const inputStyle = {
  width: "100%",
  padding: "0.75rem 0.9rem",
  borderRadius: "0.75rem",
  border: "1px solid rgba(212,175,55,0.7)",
  backgroundColor: "#FFFFFF",
  color: "#2D1B0E",
  fontSize: "16px",
  minHeight: "48px",
};

function ParivaarRegistrationForm({
  states = [],
  fetchDistricts,
  fetchSubdistricts,
  fetchVillages,
  submitRegistration,
  submitMissingLocation,
  resetSubmission,
  submitting,
  submitSuccess,
  submitError,
  savedRegistration,
  prefillLocation,
  onViewInDirectory,
  adminContactPhone = "",
  t,
}) {
  const [values, setValues] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [copiedId, setCopiedId] = useState(false);

  const [districts, setDistricts] = useState([]);
  const [subdistricts, setSubdistricts] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSubdistricts, setLoadingSubdistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [hierarchyError, setHierarchyError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Missing location report state
  const [showMissingForm, setShowMissingForm] = useState(false);
  const [missingValues, setMissingValues] = useState(INITIAL_MISSING_REPORT);
  const [missingErrors, setMissingErrors] = useState({});
  const [missingSubmitting, setMissingSubmitting] = useState(false);
  const [missingResult, setMissingResult] = useState(null);

  // Apply prefill location when user clicks "+ Register Here" in the directory
  useEffect(() => {
    if (!prefillLocation) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setValues((prev) => ({
        ...prev,
        stateCode: prefillLocation.stateCode || "",
        districtCode: prefillLocation.districtCode || "",
        subdistrictCode: prefillLocation.subdistrictCode || "",
        villageCode: prefillLocation.villageCode || "",
      }));
      setErrors({});
    });
    return () => {
      active = false;
    };
  }, [prefillLocation]);

  // Dependent load: State -> Districts
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!values.stateCode) return [];
        setLoadingDistricts(true);
        setHierarchyError(null);
        return fetchDistricts(values.stateCode);
      })
      .then((list) => {
        if (active) {
          setDistricts(list || []);
          setLoadingDistricts(false);
        }
      })
      .catch((err) => {
        if (active) {
          setDistricts([]);
          setHierarchyError(err?.message || "Failed to load districts from database.");
          setLoadingDistricts(false);
        }
      });
    return () => {
      active = false;
    };
  }, [values.stateCode, fetchDistricts, reloadTick]);

  // Dependent load: District -> Subdistricts/Blocks
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!values.districtCode) return [];
        setLoadingSubdistricts(true);
        setHierarchyError(null);
        return fetchSubdistricts(values.districtCode, values.stateCode);
      })
      .then((list) => {
        if (active) {
          setSubdistricts(list || []);
          setLoadingSubdistricts(false);
        }
      })
      .catch((err) => {
        if (active) {
          setSubdistricts([]);
          setHierarchyError(err?.message || "Failed to load tehsils/blocks from database.");
          setLoadingSubdistricts(false);
        }
      });
    return () => {
      active = false;
    };
  }, [values.districtCode, values.stateCode, fetchSubdistricts, reloadTick]);

  // Dependent load: Subdistrict -> Villages
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!values.subdistrictCode) return [];
        setLoadingVillages(true);
        setHierarchyError(null);
        return fetchVillages(values.subdistrictCode, "", {
          districtCode: values.districtCode,
          stateCode: values.stateCode,
          limit: 1000,
        });
      })
      .then((list) => {
        if (active) {
          setVillages(list || []);
          setLoadingVillages(false);
        }
      })
      .catch((err) => {
        if (active) {
          setVillages([]);
          setHierarchyError(err?.message || "Failed to load villages from database.");
          setLoadingVillages(false);
        }
      });
    return () => {
      active = false;
    };
  }, [values.subdistrictCode, values.districtCode, values.stateCode, fetchVillages, reloadTick]);

  const selectedStateObj = useMemo(
    () => states.find((s) => String(s.state_code) === String(values.stateCode)) || null,
    [states, values.stateCode]
  );
  const selectedDistrictObj = useMemo(
    () =>
      districts.find((d) => String(d.district_code) === String(values.districtCode)) ||
      null,
    [districts, values.districtCode]
  );
  const selectedSubdistrictObj = useMemo(
    () =>
      subdistricts.find(
        (sb) => String(sb.subdistrict_code) === String(values.subdistrictCode)
      ) || null,
    [subdistricts, values.subdistrictCode]
  );
  const selectedVillageObj = useMemo(
    () =>
      villages.find((v) => String(v.village_code) === String(values.villageCode)) ||
      null,
    [villages, values.villageCode]
  );

  const selectedVillageName = selectedVillageObj
    ? String(selectedVillageObj.name_en || "").trim()
    : "";

  const handleFieldChange = (field) => (e) => {
    const val = e.target.value;
    setValues((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleStateSelect = (stateCode) => {
    setValues((prev) => ({
      ...prev,
      stateCode,
      districtCode: "",
      subdistrictCode: "",
      villageCode: "",
    }));
    setErrors((prev) => ({
      ...prev,
      stateCode: undefined,
      districtCode: undefined,
      subdistrictCode: undefined,
      villageCode: undefined,
    }));
  };

  const handleDistrictSelect = (districtCode) => {
    setValues((prev) => ({
      ...prev,
      districtCode,
      subdistrictCode: "",
      villageCode: "",
    }));
    setErrors((prev) => ({
      ...prev,
      districtCode: undefined,
      subdistrictCode: undefined,
      villageCode: undefined,
    }));
  };

  const handleSubdistrictSelect = (subdistrictCode) => {
    setValues((prev) => ({
      ...prev,
      subdistrictCode,
      villageCode: "",
    }));
    setErrors((prev) => ({
      ...prev,
      subdistrictCode: undefined,
      villageCode: undefined,
    }));
  };

  const handleVillageSelect = (villageCode) => {
    setValues((prev) => ({
      ...prev,
      villageCode,
    }));
    setErrors((prev) => ({
      ...prev,
      villageCode: undefined,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const result = await submitRegistration(
      {
        ...values,
        requireVillage: true,
        thikana: selectedVillageName,
        thikanaSameAsVillage: true,
        consentGiven: true,
        selectedVillageName,
      },
      t
    );
    if (!result.ok && result.fieldErrors) {
      setErrors(result.fieldErrors);
    }
  };

  const handleRegisterAnother = () => {
    setValues(INITIAL_FORM);
    setErrors({});
    setCopiedId(false);
    resetSubmission();
  };

  const handleCopyFamilyId = async () => {
    const familyIdText = String(savedRegistration?.family_id || "").trim();
    if (!familyIdText) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(familyIdText);
      } else {
        const temp = document.createElement("textarea");
        temp.value = familyIdText;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      }
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 3000);
    } catch {
      setCopiedId(false);
    }
  };

  const handleMissingSubmit = async (e) => {
    e.preventDefault();
    if (missingSubmitting) return;
    setMissingSubmitting(true);
    setMissingErrors({});
    setMissingResult(null);

    const res = await submitMissingLocation(
      {
        ...missingValues,
        stateCode: values.stateCode || null,
        districtCode: values.districtCode || null,
        subdistrictCode: values.subdistrictCode || null,
      },
      t
    );
    setMissingSubmitting(false);

    if (!res.ok && res.fieldErrors) {
      setMissingErrors(res.fieldErrors);
      return;
    }

    if (!res.ok) {
      setMissingResult({
        ok: false,
        message: res.error?.message || "Could not submit missing location report.",
      });
      return;
    }

    setMissingResult({
      ok: true,
      message: t.missingLocationSuccessMsg,
    });
    setMissingValues(INITIAL_MISSING_REPORT);
  };

  const stateOptions = useMemo(
    () =>
      states.map((s) => ({
        value: s.state_code,
        label: s.name_local ? `${s.name_en} (${s.name_local})` : s.name_en,
        sublabel: `${s.state_or_ut} • LGD Code: ${s.state_code}`,
      })),
    [states]
  );

  const districtOptions = useMemo(
    () =>
      districts.map((d) => ({
        value: d.district_code,
        label: d.name_en,
        sublabel: `LGD District Code: ${d.district_code}`,
      })),
    [districts]
  );

  const subdistrictOptions = useMemo(
    () =>
      subdistricts.map((sb) => ({
        value: sb.subdistrict_code,
        label: sb.name_en,
        sublabel: `${sb.admin_type || "Tehsil"} • LGD Code: ${sb.subdistrict_code}`,
      })),
    [subdistricts]
  );

  const villageOptions = useMemo(
    () =>
      villages.map((v) => ({
        value: v.village_code,
        label: v.name_local ? `${v.name_en} (${v.name_local})` : v.name_en,
        sublabel: `LGD Village Code: ${v.village_code}${v.coord_verified ? " • ✓ Map Coords" : ""}`,
      })),
    [villages]
  );

  const confirmationDetails = useMemo(() => {
    if (!savedRegistration) return null;
    const stateLabel =
      savedRegistration.state_name ||
      selectedStateObj?.name_en ||
      savedRegistration.state_code ||
      "—";
    const districtLabel =
      savedRegistration.district_name ||
      selectedDistrictObj?.name_en ||
      savedRegistration.district_code ||
      "—";
    const subdistrictLabel =
      savedRegistration.subdistrict_name ||
      selectedSubdistrictObj?.name_en ||
      savedRegistration.subdistrict_code ||
      "—";
    const villageLabel =
      savedRegistration.village_name ||
      selectedVillageObj?.name_en ||
      savedRegistration.village_code ||
      "—";

    return {
      familyId: savedRegistration.family_id || "",
      headName: savedRegistration.full_name || values.fullName,
      fatherName: String(
        savedRegistration.father_name ?? values.fatherName ?? ""
      ).trim(),
      memberCount: savedRegistration.member_count || values.memberCount,
      stateLabel,
      districtLabel,
      subdistrictLabel,
      villageLabel,
      villageCode: savedRegistration.village_code || values.villageCode,
      currentAddress: savedRegistration.current_address || values.currentAddress,
      phoneNumber: savedRegistration.phone_number || values.phoneNumber,
    };
  }, [
    savedRegistration,
    selectedStateObj,
    selectedDistrictObj,
    selectedSubdistrictObj,
    selectedVillageObj,
    values,
  ]);

  return (
    <section
      id="parivaar-register"
      className="py-12 px-4 scroll-mt-24"
      style={{ backgroundColor: "#FFFFFF" }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <span
            className="inline-block px-3.5 py-1 rounded-full text-xs font-bold mb-2"
            style={{
              backgroundColor: "rgba(212,175,55,0.18)",
              color: "var(--maroon)",
              border: "1px solid var(--gold)",
            }}
          >
            {t.section4Label || "4. परिवार पंजीकरण (Register Family)"}
          </span>
          <h2
            className="section-title text-2xl md:text-3xl font-bold"
            style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}
          >
            {t.formHeading || "परिवार पंजीकरण (Family Registration)"}
          </h2>
          <p
            className="text-sm sm:text-base font-semibold -mt-3 max-w-2xl mx-auto leading-relaxed"
            style={{ color: "var(--maroon)" }}
          >
            {t.formSubheading ||
              "समाज की एकता और संपर्क — आधिकारिक स्थान जानकारी के साथ अपना परिवार दर्ज करें (Community Unity and Connection — Register your family with official location information)"}
          </p>
        </div>

        <div
          className="rounded-2xl p-5 sm:p-8 shadow-lg"
          style={{
            backgroundColor: "var(--cream)",
            border: "2px solid var(--gold)",
          }}
        >
          {submitSuccess && confirmationDetails ? (
            <div
              className="py-4 space-y-6"
              data-testid="parivaar-registration-success"
            >
              {/* 1. Confirmation Header */}
              <div className="text-center space-y-2">
                <div
                  className="inline-flex items-center justify-center w-14 h-14 rounded-full text-2xl font-bold shadow-sm"
                  style={{
                    backgroundColor: "#DCFCE7",
                    color: "#15803D",
                    border: "2px solid #16A34A",
                  }}
                >
                  ✓
                </div>
                <h3
                  className="text-xl sm:text-2xl font-bold"
                  style={{
                    color: "#15803D",
                    fontFamily: "'Tiro Devanagari Hindi', serif",
                  }}
                  data-testid="confirmation-heading"
                >
                  {t.registrationSuccessTitle ||
                    "पंजीकरण सफल (Registration Successful)"}
                </h3>
                <p
                  className="text-xs sm:text-sm font-medium max-w-xl mx-auto"
                  style={{ color: "#4A3728" }}
                >
                  {t.reviewSubmittedDetailsNote ||
                    "कृपया नीचे दिए गए अपने पंजीकृत विवरण की ध्यानपूर्वक जाँच करें और भविष्य के संदर्भ के लिए अपनी Family ID सुरक्षित रखें। (Please review your submitted details carefully and save your Family ID for future reference.)"}
                </p>
              </div>

              {/* 2. Prominent Family ID Badge & Working Copy Button */}
              <div
                className="rounded-2xl p-5 text-center shadow-md"
                style={{
                  background:
                    "linear-gradient(135deg, #4A0810 0%, #6B0F1A 60%, #8B1E2B 100%)",
                  color: "#FFFFFF",
                  border: "2px solid var(--gold)",
                }}
              >
                <p
                  className="text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1.5"
                  style={{ color: "var(--gold)" }}
                >
                  {t.familyIdLabel ||
                    "आपकी स्थायी Family ID (Your Permanent Family ID)"}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
                  <span
                    className="px-5 py-2.5 rounded-xl font-mono text-2xl sm:text-3xl font-extrabold tracking-wider select-all"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.12)",
                      color: "#FFD700",
                      border: "1.5px solid rgba(212,175,55,0.7)",
                    }}
                    data-testid="generated-family-id"
                  >
                    {confirmationDetails.familyId}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyFamilyId}
                    data-testid="copy-family-id-btn"
                    className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-transform active:scale-95 cursor-pointer"
                    style={{
                      minHeight: "44px",
                      backgroundColor: copiedId ? "#16A34A" : "var(--gold)",
                      color: copiedId ? "#FFFFFF" : "var(--maroon)",
                    }}
                  >
                    {copiedId
                      ? `✓ ${t.copiedFamilyIdBtn || "कॉपी हो गया! (Copied!)"}`
                      : `📋 ${t.copyFamilyIdBtn || "Family ID कॉपी करें (Copy Family ID)"}`}
                  </button>
                </div>
                <p className="text-[11px] mt-2.5 text-amber-100/90">
                  प्रारूप (Format): LGD_VILLAGE_CODE-SEQUENCE • यह Family ID स्थायी है (Permanent ID)
                </p>
              </div>

              {/* 3. Submitted Details Review Card */}
              <div
                className="rounded-xl p-4 sm:p-5 space-y-3"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1.5px solid rgba(212,175,55,0.65)",
                }}
                data-testid="confirmation-details-card"
              >
                <h4
                  className="text-sm sm:text-base font-bold pb-2 border-b"
                  style={{
                    color: "var(--maroon)",
                    borderColor: "rgba(212,175,55,0.35)",
                  }}
                >
                  📋 पंजीकृत विवरण की समीक्षा (Submitted Details for Review)
                </h4>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="p-2.5 rounded-lg bg-[#FFFBF2]">
                    <dt className="font-semibold text-[#6B5B4B]">
                      परिवार के मुखिया का नाम (Family Head&apos;s Name)
                    </dt>
                    <dd
                      className="font-bold text-[#2D1B0E] mt-0.5"
                      data-testid="confirm-head-name"
                    >
                      <div>{confirmationDetails.headName}</div>
                      {confirmationDetails.fatherName && (
                        <div
                          className="text-xs font-normal text-[#6E5840] mt-0.5"
                          data-testid="confirm-father-subline"
                        >
                          S/o {confirmationDetails.fatherName}
                        </div>
                      )}
                    </dd>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#FFFBF2]">
                    <dt className="font-semibold text-[#6B5B4B]">
                      पिता का नाम (Father&apos;s Name)
                    </dt>
                    <dd
                      className="font-bold text-[#2D1B0E] mt-0.5"
                      data-testid="confirm-father-name"
                    >
                      {confirmationDetails.fatherName || "—"}
                    </dd>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#FFFBF2]">
                    <dt className="font-semibold text-[#6B5B4B]">
                      परिवार के सदस्यों की संख्या (Number of Family Members)
                    </dt>
                    <dd
                      className="font-bold text-[#2D1B0E] mt-0.5"
                      data-testid="confirm-member-count"
                    >
                      {confirmationDetails.memberCount}
                    </dd>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#FFFBF2]">
                    <dt className="font-semibold text-[#6B5B4B]">
                      पैतृक राज्य / केंद्रशासित प्रदेश (Ancestral State / UT)
                    </dt>
                    <dd
                      className="font-bold text-[#2D1B0E] mt-0.5"
                      data-testid="confirm-state"
                    >
                      {confirmationDetails.stateLabel}
                    </dd>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#FFFBF2]">
                    <dt className="font-semibold text-[#6B5B4B]">
                      पैतृक जिला (Ancestral District)
                    </dt>
                    <dd
                      className="font-bold text-[#2D1B0E] mt-0.5"
                      data-testid="confirm-district"
                    >
                      {confirmationDetails.districtLabel}
                    </dd>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#FFFBF2]">
                    <dt className="font-semibold text-[#6B5B4B]">
                      पैतृक तहसील / ब्लॉक (Ancestral Tehsil / Block)
                    </dt>
                    <dd
                      className="font-bold text-[#2D1B0E] mt-0.5"
                      data-testid="confirm-subdistrict"
                    >
                      {confirmationDetails.subdistrictLabel}
                    </dd>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#FFFBF2]">
                    <dt className="font-semibold text-[#6B5B4B]">
                      पैतृक गाँव / ठिकाना (Ancestral Village / Thikana)
                    </dt>
                    <dd
                      className="font-bold text-[#2D1B0E] mt-0.5"
                      data-testid="confirm-village"
                    >
                      {confirmationDetails.villageLabel}{" "}
                      {confirmationDetails.villageCode
                        ? `(LGD: ${confirmationDetails.villageCode})`
                        : ""}
                    </dd>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#FFFBF2] sm:col-span-2">
                    <dt className="font-semibold text-[#6B5B4B]">
                      वर्तमान पता (Current Address) •{" "}
                      <span className="text-[11px] text-amber-800">
                        🔒 गोपनीय (Private — Not Shown Publicly)
                      </span>
                    </dt>
                    <dd
                      className="font-bold text-[#2D1B0E] mt-0.5"
                      data-testid="confirm-current-address"
                    >
                      {confirmationDetails.currentAddress}
                    </dd>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#FFFBF2] sm:col-span-2">
                    <dt className="font-semibold text-[#6B5B4B]">
                      मोबाइल नंबर (Mobile Number) •{" "}
                      <span className="text-[11px] text-amber-800">
                        🔒 गोपनीय (Private — Not Shown Publicly)
                      </span>
                    </dt>
                    <dd
                      className="font-bold text-[#2D1B0E] mt-0.5"
                      data-testid="confirm-phone"
                    >
                      +91 {confirmationDetails.phoneNumber}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* 4. Exact Correction Notice in Hindi with English in brackets */}
              <div
                className="rounded-xl p-4 sm:p-5"
                style={{
                  backgroundColor: "#FFFBF2",
                  border: "1.5px solid var(--gold)",
                }}
                data-testid="confirmation-correction-notice"
              >
                <h4
                  className="text-sm sm:text-base font-bold mb-1.5"
                  style={{ color: "var(--maroon)" }}
                >
                  ⚠️ {t.foundErrorHeading || "जानकारी में कोई गलती है? (Found an Error?)"}
                </h4>
                <p
                  className="text-xs sm:text-sm font-medium leading-relaxed"
                  style={{ color: "#2D1B0E" }}
                >
                  {t.foundErrorBody ||
                    "यदि आपके द्वारा भरी गई जानकारी में कोई गलती है, तो कृपया अपने Family ID के साथ directory administrator से संपर्क करें। (If any submitted information is incorrect, contact the directory administrator and provide your Family ID.)"}
                </p>
                {adminContactPhone ? (
                  <p
                    className="text-xs sm:text-sm font-bold mt-2"
                    style={{ color: "var(--maroon)" }}
                  >
                    📞 Directory Administrator Contact: {adminContactPhone}
                  </p>
                ) : (
                  <p className="text-xs mt-2" style={{ color: "#6B5B4B" }}>
                    नीचे अनुभाग <strong>5. सुधार एवं सहायता (Corrections &amp; Help)</strong> में अपनी{" "}
                    <span className="font-mono font-bold">
                      {confirmationDetails.familyId}
                    </span>{" "}
                    के साथ संपर्क करें।
                  </p>
                )}
              </div>

              {/* 5. Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                {onViewInDirectory && (
                  <button
                    type="button"
                    onClick={() =>
                      onViewInDirectory({
                        familyId: confirmationDetails.familyId,
                        stateCode: savedRegistration?.state_code || values.stateCode,
                        districtCode:
                          savedRegistration?.district_code || values.districtCode,
                        subdistrictCode:
                          savedRegistration?.subdistrict_code || values.subdistrictCode,
                        villageCode:
                          savedRegistration?.village_code || values.villageCode,
                      })
                    }
                    className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs sm:text-sm transition-transform hover:scale-102 cursor-pointer"
                    style={{
                      minHeight: "46px",
                      backgroundColor: "var(--gold)",
                      color: "var(--maroon)",
                      border: "1.5px solid var(--maroon)",
                    }}
                  >
                    🔍 {t.viewInDirectoryBtn || "परिवार निर्देशिका में देखें (View in Family Directory)"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRegisterAnother}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs sm:text-sm transition-transform hover:scale-102 cursor-pointer"
                  style={{
                    minHeight: "46px",
                    backgroundColor: "var(--maroon)",
                    color: "var(--gold)",
                  }}
                >
                  + {t.registerAnotherBtn || "एक और परिवार पंजीकरण करें (Register Another Family)"}
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              data-testid="parivaar-registration-form"
            >
              <div className="space-y-6">
                {/* Part A: Family Details */}
                <div
                  className="rounded-xl p-4 sm:p-5 space-y-4"
                  style={{
                    backgroundColor: "#FFFBF2",
                    border: "1px solid rgba(212,175,55,0.55)",
                  }}
                >
                  <h3
                    className="text-sm sm:text-base font-bold pb-1.5 border-b"
                    style={{
                      color: "var(--maroon)",
                      borderColor: "rgba(212,175,55,0.35)",
                    }}
                  >
                    👨‍👩‍👧‍👦 परिवार का विवरण (Family Details)
                  </h3>

                  {/* 1. Family Head's Name / Full Name */}
                  <div>
                    <label
                      htmlFor="parivaar-full-name"
                      className="block text-xs sm:text-sm font-bold mb-1.5"
                      style={{ color: "var(--maroon)" }}
                    >
                      1.{" "}
                      {t.fieldHeadNameLabel ||
                        "परिवार के मुखिया का नाम (Family Head's Name)"}{" "}
                      <span
                        className="font-normal text-xs"
                        style={{ color: "#8B7355" }}
                      >
                        ({t.requiredText})
                      </span>
                    </label>
                    <input
                      id="parivaar-full-name"
                      data-testid="reg-head-name-input"
                      type="text"
                      required
                      value={values.fullName}
                      onChange={handleFieldChange("fullName")}
                      placeholder={
                        t.fieldHeadNamePlaceholder ||
                        "परिवार के मुखिया का पूरा नाम लिखें (Enter Family Head's full name)"
                      }
                      autoComplete="name"
                      style={{
                        ...inputStyle,
                        borderColor: errors.fullName
                          ? "#B91C1C"
                          : "rgba(212,175,55,0.65)",
                      }}
                    />
                    {errors.fullName && (
                      <p
                        className="text-xs font-semibold mt-1"
                        style={{ color: "#B91C1C" }}
                        role="alert"
                      >
                        {errors.fullName}
                      </p>
                    )}
                  </div>

                  {/* 2. Father's Name (Required, directly below Full Name) */}
                  <div>
                    <label
                      htmlFor="parivaar-father-name"
                      className="block text-xs sm:text-sm font-bold mb-1.5"
                      style={{ color: "var(--maroon)" }}
                    >
                      2.{" "}
                      {t.fieldFatherNameLabel ||
                        "पिता का नाम (Father's Name)"}{" "}
                      <span
                        className="font-normal text-xs"
                        style={{ color: "#8B7355" }}
                      >
                        ({t.requiredText})
                      </span>
                    </label>
                    <input
                      id="parivaar-father-name"
                      data-testid="reg-father-name-input"
                      type="text"
                      required
                      value={values.fatherName}
                      onChange={handleFieldChange("fatherName")}
                      placeholder={
                        t.fieldFatherNamePlaceholder ||
                        "पिता का पूरा नाम लिखें (Enter Father's full name)"
                      }
                      style={{
                        ...inputStyle,
                        borderColor: errors.fatherName
                          ? "#B91C1C"
                          : "rgba(212,175,55,0.65)",
                      }}
                    />
                    {errors.fatherName && (
                      <p
                        className="text-xs font-semibold mt-1"
                        style={{ color: "#B91C1C" }}
                        role="alert"
                      >
                        {errors.fatherName}
                      </p>
                    )}
                  </div>

                  {/* 3. Number of Family Members & 4. Mobile Number */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="parivaar-member-count"
                        className="block text-xs sm:text-sm font-bold mb-1.5"
                        style={{ color: "var(--maroon)" }}
                      >
                        2.{" "}
                        {t.fieldMemberCountLabel ||
                          "परिवार के सदस्यों की संख्या (Number of Family Members)"}{" "}
                        <span
                          className="font-normal text-xs"
                          style={{ color: "#8B7355" }}
                        >
                          ({t.requiredText})
                        </span>
                      </label>
                      <input
                        id="parivaar-member-count"
                        data-testid="reg-member-count-input"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={250}
                        step={1}
                        required
                        value={values.memberCount}
                        onChange={handleFieldChange("memberCount")}
                        placeholder={
                          t.fieldMemberCountPlaceholder || "जैसे: 5 (e.g. 5)"
                        }
                        style={{
                          ...inputStyle,
                          borderColor: errors.memberCount
                            ? "#B91C1C"
                            : "rgba(212,175,55,0.65)",
                        }}
                      />
                      {errors.memberCount && (
                        <p
                          className="text-xs font-semibold mt-1"
                          style={{ color: "#B91C1C" }}
                          role="alert"
                        >
                          {errors.memberCount}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="parivaar-phone"
                        className="block text-xs sm:text-sm font-bold mb-1.5"
                        style={{ color: "var(--maroon)" }}
                      >
                        3. {t.fieldPhoneLabel}{" "}
                        <span
                          className="font-normal text-xs"
                          style={{ color: "#8B7355" }}
                        >
                          ({t.requiredText} • 🔒 {t.privateFieldBadge})
                        </span>
                      </label>
                      <div className="flex items-stretch gap-2">
                        <span
                          className="inline-flex items-center px-3 rounded-xl font-bold text-sm shrink-0"
                          style={{
                            backgroundColor: "#FFFFFF",
                            border: "1px solid rgba(212,175,55,0.65)",
                            color: "var(--maroon)",
                          }}
                        >
                          🇮🇳 +91
                        </span>
                        <input
                          id="parivaar-phone"
                          data-testid="reg-phone-input"
                          type="tel"
                          inputMode="numeric"
                          required
                          maxLength={14}
                          value={values.phoneNumber}
                          onChange={handleFieldChange("phoneNumber")}
                          placeholder={t.fieldPhonePlaceholder}
                          autoComplete="tel-national"
                          style={{
                            ...inputStyle,
                            borderColor: errors.phoneNumber
                              ? "#B91C1C"
                              : "rgba(212,175,55,0.65)",
                          }}
                        />
                      </div>
                      {errors.phoneNumber && (
                        <p
                          className="text-xs font-semibold mt-1"
                          style={{ color: "#B91C1C" }}
                          role="alert"
                        >
                          {errors.phoneNumber}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Part B: Ancestral Location (Official LGD Hierarchy -> Generates Family ID) */}
                <div
                  className="rounded-xl p-4 sm:p-5 space-y-4"
                  style={{
                    backgroundColor: "#FFFBF2",
                    border: "1px solid rgba(212,175,55,0.55)",
                  }}
                >
                  <div>
                    <h3
                      className="text-sm sm:text-base font-bold"
                      style={{ color: "var(--maroon)" }}
                    >
                      🏡{" "}
                      {t.ancestralSectionTitle ||
                        "पैतृक स्थान — आधिकारिक गाँव / ठिकाना (Ancestral Location — Official Village / Thikana)"}
                    </h3>
                    <p
                      className="text-xs mt-1 leading-relaxed"
                      style={{ color: "#5C4A38" }}
                    >
                      {t.ancestralSectionNote ||
                        "चयनित आधिकारिक पैतृक गाँव का उपयोग आपके स्थायी Family ID (LGD_VILLAGE_CODE-SEQUENCE) और गाँव/ठिकाना संबद्धता के लिए किया जाता है।"}
                    </p>
                  </div>

                  {/* 4. State/UT & 5. District */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SearchableSelect
                      id="parivaar-state"
                      label={`4. ${t.fieldStateLabel}`}
                      required
                      requiredText={t.requiredText}
                      optionalText={t.optionalText}
                      options={stateOptions}
                      value={values.stateCode}
                      onChange={handleStateSelect}
                      placeholder={t.selectStatePlaceholder}
                      searchPlaceholder={t.searchStatePlaceholder}
                      error={errors.stateCode}
                      testId="reg-state-select"
                    />

                    <SearchableSelect
                      id="parivaar-district"
                      label={`5. ${t.fieldDistrictLabel}`}
                      required
                      requiredText={t.requiredText}
                      optionalText={t.optionalText}
                      options={districtOptions}
                      value={values.districtCode}
                      onChange={handleDistrictSelect}
                      disabled={!values.stateCode}
                      loading={loadingDistricts}
                      placeholder={
                        values.stateCode
                          ? t.selectDistrictPlaceholder
                          : t.selectStateFirst
                      }
                      searchPlaceholder={t.searchDistrictPlaceholder}
                      error={errors.districtCode}
                      testId="reg-district-select"
                    />
                  </div>

                  {/* 6. Tehsil / Block & 7. Official Ancestral Village */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SearchableSelect
                      id="parivaar-subdistrict"
                      label={`6. ${t.fieldSubdistrictLabel}`}
                      required
                      requiredText={t.requiredText}
                      optionalText={t.optionalText}
                      options={subdistrictOptions}
                      value={values.subdistrictCode}
                      onChange={handleSubdistrictSelect}
                      disabled={!values.districtCode}
                      loading={loadingSubdistricts}
                      placeholder={
                        values.districtCode
                          ? t.selectSubdistrictPlaceholder
                          : t.selectDistrictFirst
                      }
                      searchPlaceholder={t.searchSubdistrictPlaceholder}
                      error={errors.subdistrictCode}
                      testId="reg-subdistrict-select"
                    />

                    <SearchableSelect
                      id="parivaar-village"
                      label={`7. ${t.fieldVillageLabel}`}
                      required
                      requiredText={t.requiredText}
                      optionalText={t.optionalLgdVillageText}
                      options={villageOptions}
                      value={values.villageCode}
                      onChange={handleVillageSelect}
                      disabled={!values.subdistrictCode}
                      loading={loadingVillages}
                      placeholder={
                        values.subdistrictCode
                          ? t.selectVillagePlaceholder
                          : t.selectSubdistrictFirst
                      }
                      searchPlaceholder={t.searchVillagePlaceholder}
                      emptyText={t.villageNotInSubsetText}
                      error={errors.villageCode}
                      testId="reg-village-select"
                    />
                  </div>

                  {selectedVillageObj && (
                    <div
                      className="rounded-lg px-3.5 py-2.5 text-xs font-semibold flex flex-wrap items-center justify-between gap-2"
                      style={{
                        backgroundColor: "rgba(21,128,61,0.08)",
                        border: "1px solid rgba(21,128,61,0.35)",
                        color: "#15803D",
                      }}
                      data-testid="selected-ancestral-village-preview"
                    >
                      <span>
                        ✓ चयनित पैतृक गाँव / ठिकाना (Ancestral Village / Thikana):{" "}
                        <strong>{selectedVillageObj.name_en}</strong>
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border border-green-700/30">
                        Family ID Prefix: {selectedVillageObj.village_code}-***
                      </span>
                    </div>
                  )}

                  {hierarchyError && (
                    <div
                      className="rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold"
                      style={{
                        backgroundColor: "#FFF5F5",
                        border: "1px solid #B91C1C",
                        color: "#B91C1C",
                      }}
                      role="alert"
                      data-testid="reg-hierarchy-error"
                    >
                      <span>⚠️ {hierarchyError}</span>
                      <button
                        type="button"
                        onClick={() => setReloadTick((n) => n + 1)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold"
                        style={{ backgroundColor: "#B91C1C", color: "#FFFFFF" }}
                      >
                        Retry Loading Locations
                      </button>
                    </div>
                  )}
                </div>

                {/* Part C: Current Residence (Separate from Ancestral Village, Never Used for Family ID) */}
                <div
                  className="rounded-xl p-4 sm:p-5 space-y-3"
                  style={{
                    backgroundColor: "#FFFBF2",
                    border: "1px solid rgba(212,175,55,0.55)",
                  }}
                >
                  <h3
                    className="text-sm sm:text-base font-bold"
                    style={{ color: "var(--maroon)" }}
                  >
                    🏠{" "}
                    {t.currentResidenceSectionTitle ||
                      "वर्तमान निवास — गोपनीय (Current Residence — Private)"}
                  </h3>
                  <div>
                    <label
                      htmlFor="parivaar-current-address"
                      className="block text-xs sm:text-sm font-bold mb-1.5"
                      style={{ color: "var(--maroon)" }}
                    >
                      8. {t.fieldCurrentAddressLabel}{" "}
                      <span
                        className="font-normal text-xs"
                        style={{ color: "#8B7355" }}
                      >
                        ({t.requiredText} • 🔒 {t.privateFieldBadge})
                      </span>
                    </label>
                    <textarea
                      id="parivaar-current-address"
                      data-testid="reg-current-address-input"
                      rows={2}
                      required
                      value={values.currentAddress}
                      onChange={handleFieldChange("currentAddress")}
                      placeholder={t.fieldCurrentAddressPlaceholder}
                      autoComplete="street-address"
                      style={{
                        ...inputStyle,
                        resize: "vertical",
                        borderColor: errors.currentAddress
                          ? "#B91C1C"
                          : "rgba(212,175,55,0.65)",
                      }}
                    />
                    <p className="text-[11px] mt-1" style={{ color: "#6B5B4B" }}>
                      वर्तमान पता आपके पैतृक गाँव से अलग रखा जाता है और कभी भी सार्वजनिक निर्देशिका या मानचित्र में नहीं दिखाया जाता। (Current address is kept separate from ancestral village and never shown publicly.)
                    </p>
                    {errors.currentAddress && (
                      <p
                        className="text-xs font-semibold mt-1"
                        style={{ color: "#B91C1C" }}
                        role="alert"
                      >
                        {errors.currentAddress}
                      </p>
                    )}
                  </div>
                </div>

                {/* Backend submission error alert */}
                {submitError && (
                  <div
                    className="rounded-xl p-4"
                    style={{
                      backgroundColor: "#FFF5F5",
                      border: "2px solid #B91C1C",
                    }}
                    role="alert"
                    data-testid="parivaar-submit-error"
                  >
                    <p
                      className="font-bold text-sm mb-1"
                      style={{ color: "#B91C1C" }}
                    >
                      ✕ {t.submitErrorHeading}
                    </p>
                    <p
                      className="text-xs sm:text-sm leading-relaxed"
                      style={{ color: "#7F1D1D" }}
                    >
                      {submitError.message}
                    </p>
                  </div>
                )}

                {/* Submit Registration Button */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    data-testid="reg-submit-btn"
                    className="w-full sm:w-auto px-9 py-3.5 rounded-xl sm:rounded-full font-bold text-base shadow-md transition-transform active:scale-98 sm:hover:scale-105 disabled:opacity-60 cursor-pointer"
                    style={{
                      minHeight: "50px",
                      backgroundColor: "var(--gold)",
                      color: "var(--maroon)",
                      border: "2px solid var(--maroon)",
                    }}
                  >
                    {submitting ? t.submittingBtnLabel : t.submitBtnLabel}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Controlled Missing Location Reporting Drawer */}
        <div
          id="parivaar-missing-location-drawer"
          className="mt-6 rounded-2xl p-4 sm:p-5"
          style={{
            backgroundColor: "#FFFBF2",
            border: "1px solid rgba(212,175,55,0.55)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3
                className="font-bold text-sm"
                style={{ color: "var(--maroon)" }}
              >
                📍 {t.missingLocationBannerTitle}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "#6B5B4B" }}>
                {t.missingLocationBannerDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowMissingForm((v) => !v)}
              data-testid="toggle-missing-location-btn"
              className="px-4 py-2 rounded-full text-xs font-bold border transition-colors cursor-pointer"
              style={{
                backgroundColor: showMissingForm ? "var(--maroon)" : "#FFFFFF",
                color: showMissingForm ? "var(--gold)" : "var(--maroon)",
                borderColor: "var(--gold)",
              }}
            >
              {showMissingForm ? t.closeMissingFormBtn : t.openMissingFormBtn}
            </button>
          </div>

          {showMissingForm && (
            <form
              onSubmit={handleMissingSubmit}
              className="mt-4 pt-4 border-t space-y-3.5"
              style={{ borderColor: "rgba(212,175,55,0.4)" }}
              noValidate
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    className="block text-xs font-bold mb-1"
                    style={{ color: "var(--maroon)" }}
                  >
                    {t.fieldHeadNameLabel || t.fieldNameLabel} ({t.requiredText})
                  </label>
                  <input
                    type="text"
                    value={missingValues.reporterName}
                    onChange={(e) =>
                      setMissingValues((p) => ({
                        ...p,
                        reporterName: e.target.value,
                      }))
                    }
                    placeholder={t.fieldNamePlaceholder}
                    style={inputStyle}
                  />
                  {missingErrors.reporterName && (
                    <p
                      className="text-xs font-semibold mt-1"
                      style={{ color: "#B91C1C" }}
                    >
                      {missingErrors.reporterName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    className="block text-xs font-bold mb-1"
                    style={{ color: "var(--maroon)" }}
                  >
                    {t.missingLevelLabel}
                  </label>
                  <select
                    value={missingValues.missingLevel}
                    onChange={(e) =>
                      setMissingValues((p) => ({
                        ...p,
                        missingLevel: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="village">गाँव (Village)</option>
                    <option value="subdistrict_block">
                      तहसील / ब्लॉक (Tehsil / Block)
                    </option>
                    <option value="district">जिला (District)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    className="block text-xs font-bold mb-1"
                    style={{ color: "var(--maroon)" }}
                  >
                    {t.proposedLocationNameLabel} ({t.requiredText})
                  </label>
                  <input
                    type="text"
                    value={missingValues.proposedName}
                    onChange={(e) =>
                      setMissingValues((p) => ({
                        ...p,
                        proposedName: e.target.value,
                      }))
                    }
                    placeholder={t.proposedLocationPlaceholder}
                    style={inputStyle}
                  />
                  {missingErrors.proposedName && (
                    <p
                      className="text-xs font-semibold mt-1"
                      style={{ color: "#B91C1C" }}
                    >
                      {missingErrors.proposedName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    className="block text-xs font-bold mb-1"
                    style={{ color: "var(--maroon)" }}
                  >
                    PIN Code ({t.optionalText})
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={missingValues.pincode}
                    onChange={(e) =>
                      setMissingValues((p) => ({
                        ...p,
                        pincode: e.target.value,
                      }))
                    }
                    placeholder="e.g. 323802"
                    style={inputStyle}
                  />
                  {missingErrors.pincode && (
                    <p
                      className="text-xs font-semibold mt-1"
                      style={{ color: "#B91C1C" }}
                    >
                      {missingErrors.pincode}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  className="block text-xs font-bold mb-1"
                  style={{ color: "var(--maroon)" }}
                >
                  {t.parentContextLabel} ({t.optionalText})
                </label>
                <input
                  type="text"
                  value={missingValues.parentContext}
                  onChange={(e) =>
                    setMissingValues((p) => ({
                      ...p,
                      parentContext: e.target.value,
                    }))
                  }
                  placeholder="e.g. State, District, Tehsil details for LGD verification"
                  style={inputStyle}
                />
              </div>

              {missingResult && (
                <div
                  className="rounded-xl p-3 text-xs font-semibold"
                  style={{
                    backgroundColor: missingResult.ok ? "#F0FDF4" : "#FFF5F5",
                    color: missingResult.ok ? "#15803D" : "#B91C1C",
                    border: `1px solid ${
                      missingResult.ok ? "#15803D" : "#B91C1C"
                    }`,
                  }}
                >
                  {missingResult.message}
                </div>
              )}

              <button
                type="submit"
                disabled={missingSubmitting}
                className="px-5 py-2.5 rounded-full font-bold text-xs transition-colors cursor-pointer"
                style={{
                  backgroundColor: "var(--maroon)",
                  color: "var(--gold)",
                }}
              >
                {missingSubmitting ? t.submittingBtnLabel : t.submitMissingReportBtn}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default ParivaarRegistrationForm;
