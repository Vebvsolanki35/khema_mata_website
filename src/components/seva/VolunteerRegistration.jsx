import { useState } from "react";
import { useLanguage } from "../../context/useLanguage";
import useVolunteerApplication from "../../hooks/useVolunteerApplication";
import { validateVolunteer } from "../../lib/validateVolunteer";

/**
 * Seva & Volunteer Registration.
 *
 * Collects only what the Trust needs in order to reply: a name, one contact
 * method, the kind of seva offered, when the person is available and optionally
 * where they are. Deliberately does NOT ask for Aadhaar, identity documents,
 * bank or payment details, or passwords.
 *
 * On success the applicant is told plainly that this records interest and does
 * not guarantee selection. On failure the error is shown and the form stays
 * filled in — a submission is never reported as saved unless the backend
 * confirms it.
 */

const ACTIVITIES = [
  "temple_seva",
  "festival_event",
  "construction",
  "visitor_assistance",
  "community_service",
  "other",
];

const EMPTY = {
  fullName: "",
  contactMethod: "mobile",
  mobile: "",
  email: "",
  activity: "",
  availabilityDate: "",
  city: "",
  message: "",
};

const inputStyle = {
  width: "100%",
  padding: "0.7rem 0.85rem",
  borderRadius: "0.75rem",
  border: "1px solid rgba(212,175,55,0.6)",
  backgroundColor: "#FFFFFF",
  color: "#4A3728",
  fontSize: "1rem",
};

const labelStyle = {
  display: "block",
  fontSize: "0.82rem",
  fontWeight: 700,
  color: "var(--maroon)",
  marginBottom: "0.35rem",
};

function Field({ label, required, optionalLabel, children, error }) {
  return (
    <div>
      <label style={labelStyle}>
        {label}{" "}
        <span style={{ fontWeight: 500, color: "#8B7355", fontSize: "0.72rem" }}>
          {required ? `(${optionalLabel.required})` : `(${optionalLabel.optional})`}
        </span>
      </label>
      {children}
      {error && (
        <p className="text-xs font-semibold mt-1" style={{ color: "#B91C1C" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function VolunteerRegistration() {
  const { t } = useLanguage();
  const v = t.volunteer;
  const { submit, reset, loading, success, error } = useVolunteerApplication();

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const set = (key) => (e) => {
    setValues((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next = validateVolunteer(values, v);
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;          // guard against double submission
    if (!validate()) return;
    await submit(values);
  };

  const handleAnother = () => {
    setValues(EMPTY);
    setErrors({});
    reset();
  };

  return (
    <section className="py-14 px-4 bg-white">
      <div className="max-w-3xl mx-auto">
        <h2 className="section-title text-2xl md:text-3xl font-bold">{v.title}</h2>
        <p className="mt-2 text-sm sm:text-base" style={{ color: "#6B5B4B" }}>
          {v.subtitle}
        </p>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "#4A3728", fontFamily: "'Tiro Devanagari Hindi', serif" }}
        >
          {v.intro}
        </p>

        <div
          className="mt-8 rounded-2xl p-5 sm:p-7 shadow-md"
          style={{ backgroundColor: "var(--cream)", border: "1px solid var(--gold)" }}
        >
          {success ? (
            /* -------------------------------------------------- confirmed */
            <div className="text-center">
              <div className="text-4xl mb-3">🙏</div>
              <h3
                className="text-lg sm:text-xl font-bold mb-2"
                style={{ color: "#15803D", fontFamily: "'Tiro Devanagari Hindi', serif" }}
              >
                ✓ {v.successTitle}
              </h3>
              <p className="text-sm sm:text-base leading-relaxed mb-3" style={{ color: "#4A3728" }}>
                {v.successBody}
              </p>
              <div
                className="rounded-xl p-3.5 text-sm leading-relaxed mb-5"
                style={{ backgroundColor: "#FFFBF2", border: "1px solid var(--saffron)", color: "#92400E" }}
              >
                {v.successNote}
              </div>
              <button
                type="button"
                onClick={handleAnother}
                className="px-6 py-2.5 rounded-full font-bold text-sm"
                style={{ backgroundColor: "var(--maroon)", color: "var(--gold)" }}
              >
                {v.submitAnother}
              </button>
            </div>
          ) : (
            /* ------------------------------------------------------ form */
            <form onSubmit={handleSubmit} noValidate>
              <h3
                className="font-bold text-base mb-5"
                style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
              >
                {v.formTitle}
              </h3>

              <div className="space-y-4">
                <Field
                  label={v.name}
                  required
                  optionalLabel={v}
                  error={errors.fullName}
                >
                  <input
                    type="text"
                    value={values.fullName}
                    onChange={set("fullName")}
                    placeholder={v.namePlaceholder}
                    autoComplete="name"
                    style={inputStyle}
                  />
                </Field>

                {/* contact method */}
                <div>
                  <label style={labelStyle}>
                    {v.contactMethod}{" "}
                    <span style={{ fontWeight: 500, color: "#8B7355", fontSize: "0.72rem" }}>
                      ({v.required})
                    </span>
                  </label>
                  <div className="flex gap-2 mb-3">
                    {["mobile", "email"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setValues((p) => ({ ...p, contactMethod: m }));
                          setErrors((p) => ({ ...p, mobile: undefined, email: undefined }));
                        }}
                        aria-pressed={values.contactMethod === m}
                        className="px-4 py-2 rounded-full text-sm font-bold border transition-colors"
                        style={
                          values.contactMethod === m
                            ? { backgroundColor: "var(--maroon)", color: "var(--gold)", borderColor: "var(--maroon)" }
                            : { backgroundColor: "#FFFFFF", color: "var(--maroon)", borderColor: "var(--gold)" }
                        }
                      >
                        {m === "mobile" ? `📱 ${v.mobile}` : `✉️ ${v.email}`}
                      </button>
                    ))}
                  </div>

                  {values.contactMethod === "mobile" ? (
                    <Field label={v.mobile} required optionalLabel={v} error={errors.mobile}>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={values.mobile}
                        onChange={set("mobile")}
                        placeholder={v.mobilePlaceholder}
                        autoComplete="tel"
                        style={inputStyle}
                      />
                    </Field>
                  ) : (
                    <Field label={v.email} required optionalLabel={v} error={errors.email}>
                      <input
                        type="email"
                        value={values.email}
                        onChange={set("email")}
                        placeholder={v.emailPlaceholder}
                        autoComplete="email"
                        style={inputStyle}
                      />
                    </Field>
                  )}
                </div>

                <Field label={v.activity} required optionalLabel={v} error={errors.activity}>
                  <select value={values.activity} onChange={set("activity")} style={inputStyle}>
                    <option value="">{v.activityPlaceholder}</option>
                    {ACTIVITIES.map((a) => (
                      <option key={a} value={a}>
                        {v.activityOptions[a]}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={v.availability} optionalLabel={v}>
                    <input
                      type="date"
                      value={values.availabilityDate}
                      onChange={set("availabilityDate")}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label={v.city} optionalLabel={v}>
                    <input
                      type="text"
                      value={values.city}
                      onChange={set("city")}
                      placeholder={v.cityPlaceholder}
                      autoComplete="address-level2"
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <Field label={v.message} optionalLabel={v}>
                  <textarea
                    rows={3}
                    value={values.message}
                    onChange={set("message")}
                    placeholder={v.messagePlaceholder}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </Field>
              </div>

              {/* backend failure — be explicit that nothing was saved */}
              {error && (
                <div
                  className="mt-5 rounded-xl p-4"
                  style={{ backgroundColor: "#FFF5F5", border: "2px solid #B91C1C" }}
                  role="alert"
                >
                  <p className="font-bold text-sm mb-1" style={{ color: "#B91C1C" }}>
                    ✕ {v.errorTitle}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "#7F1D1D" }}>
                    {v.errorBody}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full sm:w-auto px-8 py-3 rounded-full font-bold transition-transform hover:scale-105 disabled:opacity-60"
                style={{ backgroundColor: "var(--maroon)", color: "var(--gold)" }}
              >
                {loading ? v.submitting : v.submit}
              </button>
            </form>
          )}
        </div>

        {/* privacy */}
        <div className="mt-6 rounded-2xl p-4 sm:p-5" style={{ backgroundColor: "#FFFBF2", border: "1px solid rgba(212,175,55,0.5)" }}>
          <h4 className="font-bold text-sm mb-1.5" style={{ color: "var(--maroon)" }}>
            🔒 {v.privacyTitle}
          </h4>
          <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "#6B5B4B" }}>
            {v.privacyBody}
          </p>
          <p className="text-xs sm:text-sm font-semibold mt-2" style={{ color: "#92400E" }}>
            {v.noSensitive}
          </p>
        </div>
      </div>
    </section>
  );
}

export default VolunteerRegistration;
