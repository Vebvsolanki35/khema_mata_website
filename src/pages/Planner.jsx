import { useState } from "react";
import { useLanguage } from "../context/useLanguage";
import WeatherWidget from "../components/WeatherWidget";
import routes from "../data/routes";

const DARSHAN_TIMES = [
  { icon: "🌅", label: "प्रातःकाल दर्शन", labelEn: "Morning Darshan", labelGu: "સવારના દર્શન", time: "05:00 – 12:00" },
  { icon: "🌇", label: "सायंकाल दर्शन", labelEn: "Evening Darshan", labelGu: "સાંજના દર્શન", time: "16:00 – 21:00" },
  { icon: "🎉", label: "नवरात्रि विशेष", labelEn: "Navratri Special", labelGu: "નવરાત્રિ વિશેષ", time: "Sunrise – 23:00" },
];

const CHECKLIST_ITEMS = {
  hi: [
    "पहचान प्रमाण (आधार कार्ड / वोटर आईडी)",
    "आरामदायक कपड़े और सिर ढकने का वस्त्र",
    "पानी की बोतल और हल्का नाश्ता",
    "प्रसाद / चुनरी / पुष्प माँ के लिए",
    "मोबाइल चार्जर और पावर बैंक",
    "गूगल मैप्स में 'खेमज माता मंदिर, देई, बूंदी' सेव करें",
    "मंदिर ट्रस्ट के आधिकारिक WhatsApp ग्रुप में शामिल हों",
  ],
  en: [
    "ID Proof (Aadhaar Card / Voter ID)",
    "Comfortable clothes and head covering",
    "Water bottle and light snacks",
    "Prasad / Chunri / Flowers for Maa",
    "Mobile charger and power bank",
    "Save 'Khemaj Mata Temple, Dei, Bundi' on Google Maps",
    "Join the official Temple Trust WhatsApp group",
  ],
  gu: [
    "ઓળખ પ્રૂફ (આધાર કાર્ડ / વોટર આઈડી)",
    "આરામદાયક કપડાં અને માથું ઢાંકવાનું કપડું",
    "પાણીની બોટલ અને હળવો નાસ્તો",
    "પ્રસાદ / ચૂંદડી / ફૂલ માતા માટે",
    "મોબાઇલ ચાર્જર અને પાવર બૅંક",
    "Google Maps પર 'ખેમજ માતા મંદિર, દેઈ, બૂંદી' સેવ કરો",
    "મંદિર ટ્રસ્ટના અધિકૃત WhatsApp ગ્રૂપમાં જોડાઓ",
  ],
};

const BEST_SEASONS = [
  {
    season: "शरद / हेमंत",
    seasonEn: "Autumn / Winter",
    seasonGu: "શરદ / હેમંત",
    months: "Oct – Feb",
    icon: "🍂",
    desc: "सबसे उत्तम मौसम। ठंडक और नवरात्रि महोत्सव।",
    descEn: "Best season. Pleasant cool weather and Navratri festival.",
    descGu: "શ્રેષ્ઠ ઋતુ. ઠંડું હવામાન અને નવરાત્રિ ઉત્સવ.",
    recommended: true,
  },
  {
    season: "वसंत",
    seasonEn: "Spring",
    seasonGu: "વસંત",
    months: "Mar – Apr",
    icon: "🌸",
    desc: "चैत्र नवरात्रि का समय। सुहाना मौसम।",
    descEn: "Time of Chaitra Navratri. Pleasant weather.",
    descGu: "ચૈત્ર નવરાત્રિ. સુહાવણું હવામાન.",
    recommended: false,
  },
  {
    season: "ग्रीष्म",
    seasonEn: "Summer",
    seasonGu: "ઉનાળો",
    months: "May – Jun",
    icon: "☀️",
    desc: "गर्मी अधिक। सुबह जल्दी दर्शन की सलाह।",
    descEn: "Hot weather. Early morning darshan recommended.",
    descGu: "ગરમી વધારે. વહેલી સવારના દર્શનની ભલામણ.",
    recommended: false,
  },
  {
    season: "वर्षा",
    seasonEn: "Monsoon",
    seasonGu: "ચોમાસું",
    months: "Jul – Sep",
    icon: "🌧️",
    desc: "हरियाली सुंदर। रास्ते सावधानी से।",
    descEn: "Beautiful greenery. Travel carefully on roads.",
    descGu: "સુંદર લીલોતરી. રસ્તા પર સાવધાની.",
    recommended: false,
  },
];

/** Hero banner. Rendered above the Planner content.
 *  Kept separate so the parent page can inline the body only.
 */
function PlannerHero() {
  const { language, t } = useLanguage();

  return (
    <section
      className="py-16 px-4 text-center"
      style={{ background: "linear-gradient(135deg, var(--maroon) 0%, #6B1313 100%)" }}
    >
      <div className="text-5xl mb-4">🗓️</div>
      <h1
        className="text-3xl md:text-5xl font-bold mb-2"
        style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
      >
        {t.nav.planner}
      </h1>
      <p className="text-lg opacity-90 mb-6" style={{ color: "#FFF8F0" }}>
        {language === "en"
          ? "Plan your perfect pilgrimage to Shri Khemaj Mata Temple"
          : language === "gu"
          ? "શ્રી ખેમજ માતા મંદિરની યાત્રા આયોજન કરો"
          : "श्री खेमज माता मंदिर की यात्रा की पूरी योजना बनाएं"}
      </p>
      {/* Live Weather */}
      <div className="flex justify-center">
        <WeatherWidget />
      </div>
    </section>
  );
}

/**
 * All Planner content below the hero.
 *
 * Exported so Yatra (/visit) can render it inline as one continuous page.
 * Nothing is removed: the /planner route still renders exactly this
 * content, unchanged and fully functional.
 */
export function PlannerContent({ showChecklist = true, showMapEmbed = true }) {
  const { language } = useLanguage();
  const [checkedItems, setCheckedItems] = useState({});

  const checklistItems = CHECKLIST_ITEMS[language] || CHECKLIST_ITEMS.hi;

  const toggleItem = (i) =>
    setCheckedItems((prev) => ({ ...prev, [i]: !prev[i] }));

  const getRouteLabel = (route) => {
    if (language === "en") return { from: route.fromEn, desc: route.descEn };
    if (language === "gu") return { from: route.fromGu, desc: route.descGu };
    return { from: route.from, desc: route.desc };
  };

  const getSeasonLabel = (s) => {
    if (language === "en") return { season: s.seasonEn, desc: s.descEn };
    if (language === "gu") return { season: s.seasonGu, desc: s.descGu };
    return { season: s.season, desc: s.desc };
  };

  return (
    <>

      {/* Darshan Timings */}
      <section className="py-12 px-4" style={{ backgroundColor: "var(--cream)" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="section-title text-2xl font-bold">
            ⏰{" "}
            {language === "en"
              ? "Darshan Timings"
              : language === "gu"
              ? "દર્શન સમય"
              : "दर्शन समय"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
            {DARSHAN_TIMES.map((item, i) => (
              <div
                key={i}
                className="temple-card bg-white rounded-2xl p-6 text-center"
                style={{ borderLeft: "4px solid var(--saffron)" }}
              >
                <div className="text-3xl mb-2">{item.icon}</div>
                <h3 className="font-semibold text-gray-700 mb-1">
                  {language === "en" ? item.labelEn : language === "gu" ? item.labelGu : item.label}
                </h3>
                <p className="text-lg font-bold" style={{ color: "var(--saffron)" }}>
                  {item.time}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Travel Routes */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="section-title text-2xl font-bold">
            🚗{" "}
            {language === "en"
              ? "How to Reach"
              : language === "gu"
              ? "કેવી રીતે પહોંચવું"
              : "कैसे पहुँचें"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
            {routes.map((route, i) => {
              const { from, desc } = getRouteLabel(route);
              return (
                <div
                  key={i}
                  className="temple-card rounded-2xl p-5 bg-white"
                  style={{ borderLeft: "4px solid var(--saffron)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">📍</span>
                    <h3
                      className="font-bold text-gray-800"
                      style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}
                    >
                      {from}
                    </h3>
                  </div>
                  <div className="flex gap-4 mb-2">
                    <span className="text-sm font-semibold" style={{ color: "var(--saffron)" }}>
                      📏 {route.distance}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: "var(--maroon)" }}>
                      ⏱️ {route.time}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Best Time to Visit */}
      <section className="py-12 px-4" style={{ backgroundColor: "#FFF0E0" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="section-title text-2xl font-bold">
            📅{" "}
            {language === "en"
              ? "Best Time to Visit"
              : language === "gu"
              ? "મુલાકાત માટે શ્રેષ્ઠ સમય"
              : "यात्रा का सबसे अच्छा समय"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-8">
            {BEST_SEASONS.map((s, i) => {
              const { season, desc } = getSeasonLabel(s);
              return (
                <div
                  key={i}
                  className="rounded-2xl p-5 bg-white temple-card relative"
                  style={{
                    border: s.recommended
                      ? "2px solid var(--gold)"
                      : "1px solid rgba(212,175,55,0.3)",
                  }}
                >
                  {s.recommended && (
                    <span
                      className="absolute -top-3 left-4 text-xs font-bold px-3 py-1 rounded-full"
                      style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
                    >
                      {language === "en" ? "Recommended" : language === "gu" ? "ભલામણ" : "अनुशंसित"}
                    </span>
                  )}
                  <div className="text-3xl mb-2">{s.icon}</div>
                  <h3
                    className="font-bold mb-0.5"
                    style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                  >
                    {season}
                  </h3>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--saffron)" }}>
                    {s.months}
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Packing Checklist */}
      {showChecklist && (
      <section className="py-12 px-4 bg-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="section-title text-2xl font-bold">
            ✅{" "}
            {language === "en"
              ? "Packing Checklist"
              : language === "gu"
              ? "સામાન ચેકલિસ્ટ"
              : "यात्रा चेकलिस्ट"}
          </h2>
          <ul className="mt-8 space-y-3">
            {checklistItems.map((item, i) => (
              <li
                key={i}
                className="flex items-center gap-3 p-4 rounded-xl cursor-pointer select-none"
                style={{
                  backgroundColor: checkedItems[i] ? "rgba(212,175,55,0.15)" : "var(--cream)",
                  border: checkedItems[i]
                    ? "1px solid var(--gold)"
                    : "1px solid rgba(212,175,55,0.3)",
                  transition: "all 0.2s ease",
                }}
                onClick={() => toggleItem(i)}
              >
                <span
                  className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 text-sm font-bold transition-colors"
                  style={
                    checkedItems[i]
                      ? { borderColor: "var(--gold)", backgroundColor: "var(--gold)", color: "var(--maroon)" }
                      : { borderColor: "var(--maroon)" }
                  }
                >
                  {checkedItems[i] ? "✓" : ""}
                </span>
                <span
                  className="text-gray-700 text-sm"
                  style={{
                    fontFamily: "'Tiro Devanagari Hindi', serif",
                    textDecoration: checkedItems[i] ? "line-through" : "none",
                    opacity: checkedItems[i] ? 0.6 : 1,
                  }}
                >
                  {item}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 mt-4 text-center">
            {language === "en"
              ? "Click items to check them off"
              : language === "gu"
              ? "આઇટમ ક્લિક કરીને ચેક કરો"
              : "आइटम पर क्लिक करके चेक करें"}
          </p>
        </div>
      </section>
      )}

      {/* Map Embed */}
      {showMapEmbed && (
      <section className="py-12 px-4" style={{ backgroundColor: "var(--maroon)" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="section-title text-2xl font-bold" style={{ color: "var(--gold)" }}>
            🗺️{" "}
            {language === "en"
              ? "Temple Location"
              : language === "gu"
              ? "મંદિરનું સ્થાન"
              : "मंदिर का स्थान"}
          </h2>
          <div className="mt-8 rounded-2xl overflow-hidden shadow-xl">
            <iframe
              title="Khemaj Mata Temple Location"
              src="https://maps.google.com/maps?q=25.4358,75.6475&z=14&output=embed"
              width="100%"
              height="350"
              style={{ border: 0, display: "block" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <p className="text-center mt-4 text-sm" style={{ color: "#FFF8F0", opacity: 0.8 }}>
            📍{" "}
            {language === "en"
              ? "Dei, Bundi, Rajasthan 323802"
              : language === "gu"
              ? "દેઈ, બૂંદી, રાજસ્થાન ૩૨૩૮૦૨"
              : "देई, बूंदी, राजस्थान ३२३८०२"}
          </p>
        </div>
      </section>
      )}
    </>
  );
}

export default function Planner() {
  return (
    <main>
      <PlannerHero />
      <PlannerContent />
    </main>
  );
}
