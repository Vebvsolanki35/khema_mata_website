import { useState } from "react";
import { FESTIVALS } from "../data/festivals";

const TITHI_NAMES = [
  "प्रतिपदा","द्वितीया","तृतीया","चतुर्थी","पंचमी","षष्ठी","सप्तमी",
  "अष्टमी","नवमी","दशमी","एकादशी","द्वादशी","त्रयोदशी","चतुर्दशी","पूर्णिमा/अमावस्या",
];

const HINDU_MONTHS = [
  "चैत्र","वैशाख","ज्येष्ठ","आषाढ़","श्रावण","भाद्रपद",
  "आश्विन","कार्तिक","मार्गशीर्ष","पौष","माघ","फाल्गुन",
];

const WEEKDAY_HI = ["रवि","सोम","मंगल","बुध","गुरु","शुक्र","शनि"];

const VRAT_CARDS = [
  {
    id: 1,
    title: "एकादशी",
    icon: "🌙",
    short: "प्रत्येक माह दो बार — भगवान विष्णु की पूजा",
    detail: "एकादशी प्रत्येक माह में दो बार आती है — शुक्ल पक्ष और कृष्ण पक्ष में। इस दिन भगवान विष्णु की पूजा की जाती है। व्रत रखने से पापों का नाश होता है और मोक्ष की प्राप्ति होती है। इस दिन अनाज नहीं खाया जाता, केवल फल और दूध ग्रहण करते हैं।",
  },
  {
    id: 2,
    title: "अमावस्या",
    icon: "🌑",
    short: "पितरों का दिन — तर्पण और दान का महत्व",
    detail: "अमावस्या को पितरों का दिन माना जाता है। इस दिन पितृ तर्पण, श्राद्ध और दान का विशेष महत्व है। माँ खेमज माता मंदिर में अमावस्या को विशेष पूजा होती है। इस दिन काले तिल, जल और फूल से पितरों को तर्पण दें।",
  },
  {
    id: 3,
    title: "नवमी",
    icon: "🙏",
    short: "माँ दुर्गा और भगवान राम को समर्पित",
    detail: "नवमी तिथि माँ दुर्गा और भगवान राम दोनों को समर्पित है। चैत्र शुक्ल नवमी रामनवमी है। आश्विन शुक्ल नवमी महानवमी — नवरात्रि का सबसे महत्वपूर्ण दिन है। माँ खेमज माता मंदिर में नवमी को हवन और विशेष भोग लगाया जाता है।",
  },
  {
    id: 4,
    title: "पूर्णिमा",
    icon: "🌕",
    short: "चंद्र देव की पूजा — नदी स्नान और दान",
    detail: "पूर्णिमा को चंद्र देव की पूजा की जाती है। इस दिन नदी स्नान, दान और व्रत का विशेष फल मिलता है। सत्यनारायण कथा पूर्णिमा को की जाती है। कार्तिक पूर्णिमा (देव दीपावली) विशेष रूप से पवित्र मानी जाती है।",
  },
];

function getLunarInfo(date) {
  const synodicMonth = 29.53058867;
  const knownNewMoon = new Date("2000-01-06T18:14:00Z");
  const diffMs = date - knownNewMoon;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const cyclePosition = ((diffDays % synodicMonth) + synodicMonth) % synodicMonth;
  const tithi = Math.floor(cyclePosition / (synodicMonth / 30)) + 1;
  const paksha = tithi <= 15 ? "शुक्ल" : "कृष्ण";
  const tithiInPaksha = tithi <= 15 ? tithi : tithi - 15;
  const hinduMonthIdx = Math.floor(((diffDays / synodicMonth) % 12 + 12) % 12);
  return { tithi, tithiInPaksha, paksha, hinduMonthIdx };
}

function getTithiColor(tithi) {
  const t = tithi <= 15 ? tithi : tithi - 15;
  if (tithi === 30 || tithi === 15) return "amavasya";
  if (tithi === 15) return "purnima";
  if (t === 11) return "ekadashi";
  if (t === 9) return "navami";
  return "normal";
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function toHindiNumeral(n) {
  const hindiDigits = ["०","१","२","३","४","५","६","७","८","९"];
  return String(n).split("").map(d => hindiDigits[parseInt(d)] || d).join("");
}

export default function Calendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedVrat, setSelectedVrat] = useState(null);

  const todayLunar = getLunarInfo(today);
  const tithiName = TITHI_NAMES[Math.min(todayLunar.tithiInPaksha - 1, 14)];

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const festivalMap = {};
  FESTIVALS.forEach((f) => {
    festivalMap[f.date] = f;
  });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const upcomingFestivals = FESTIVALS.filter(f => new Date(f.date) >= new Date(today.toDateString()))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1
        className="text-3xl font-bold text-center mb-2"
        style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
      >
        🗓️ हिंदू पंचांग
      </h1>
      <p className="text-center text-sm text-gray-500 mb-8">तिथि, पक्ष, माह और व्रत जानकारी</p>

      {/* Today's info */}
      <div
        className="rounded-2xl p-5 mb-8 shadow-md text-center"
        style={{ background: "linear-gradient(135deg,var(--maroon),#b54a00)", color: "var(--gold)" }}
      >
        <p className="text-lg font-bold" style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}>
          {WEEKDAY_HI[today.getDay()]}, {toHindiNumeral(today.getDate())} {["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"][today.getMonth()]} {toHindiNumeral(today.getFullYear())}
        </p>
        <p className="mt-1 text-sm opacity-90">
          {todayLunar.paksha} पक्ष — {tithiName} — {HINDU_MONTHS[todayLunar.hinduMonthIdx]} माह
        </p>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl shadow-md p-4 mb-8 border border-orange-100">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="px-3 py-1 rounded-lg text-sm font-bold border transition-colors"
            style={{ borderColor: "var(--maroon)", color: "var(--maroon)" }}
          >
            ◀ पिछला
          </button>
          <h2 className="text-lg font-bold" style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}>
            {["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"][viewMonth]} {viewYear}
          </h2>
          <button
            onClick={nextMonth}
            className="px-3 py-1 rounded-lg text-sm font-bold border transition-colors"
            style={{ borderColor: "var(--maroon)", color: "var(--maroon)" }}
          >
            अगला ▶
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_HI.map((d) => (
            <div key={d} className="text-center text-xs font-bold text-gray-500 py-1">{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const cellDate = new Date(viewYear, viewMonth, day);
            const lunar = getLunarInfo(cellDate);
            const tColor = getTithiColor(lunar.tithi);
            const fest = festivalMap[dateStr];
            const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

            let cellStyle = {};
            let textStyle = { color: "#333" };
            if (tColor === "amavasya") { cellStyle = { backgroundColor: "#1a1a2e" }; textStyle = { color: "#aaa" }; }
            else if (tColor === "purnima") { cellStyle = { backgroundColor: "#fff3b0", boxShadow: "0 0 8px #ffd700" }; textStyle = { color: "#7a6000" }; }
            else if (tColor === "ekadashi") { cellStyle = { backgroundColor: "#e8f5e9" }; textStyle = { color: "#2e7d32" }; }
            else if (tColor === "navami") { cellStyle = { backgroundColor: "#fff3e0" }; textStyle = { color: "#bf5700" }; }

            return (
              <div
                key={day}
                className="rounded-lg p-1 text-center relative"
                style={{ minHeight: "52px", border: isToday ? "2px solid var(--maroon)" : "1px solid #f0e0d0", ...cellStyle }}
              >
                <span className="text-sm font-bold" style={textStyle}>{day}</span>
                <p className="text-xs leading-tight mt-0.5 truncate" style={{ color: textStyle.color, opacity: 0.8, fontSize: "9px" }}>
                  {TITHI_NAMES[Math.min(lunar.tithiInPaksha - 1, 14)]}
                </p>
                {fest && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full" style={{ backgroundColor: "#e53935" }} title={fest.name} />
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 justify-center text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: "#1a1a2e" }} /> अमावस्या</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: "#fff3b0", boxShadow: "0 0 4px #ffd700" }} /> पूर्णिमा</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: "#e8f5e9" }} /> एकादशी</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: "#fff3e0" }} /> नवमी</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#e53935" }} /> त्योहार</span>
        </div>
      </div>

      {/* Upcoming Festivals */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}>
          🎉 आगामी त्योहार
        </h2>
        <div className="space-y-3">
          {upcomingFestivals.length === 0 ? (
            <p className="text-gray-500 text-sm">कोई आगामी त्योहार नहीं</p>
          ) : (
            upcomingFestivals.map((f) => {
              const d = new Date(f.date);
              return (
                <div
                  key={f.date}
                  className="flex items-center gap-4 p-3 rounded-xl shadow-sm border"
                  style={{ borderColor: f.type === "navratri" ? "var(--gold)" : "#f0e0d0", backgroundColor: f.type === "navratri" ? "#fff8e6" : "#fff" }}
                >
                  <div className="text-center min-w-[48px]">
                    <p className="text-lg font-bold" style={{ color: "var(--maroon)" }}>{d.getDate()}</p>
                    <p className="text-xs text-gray-500">{["जन","फर","मार","अप्र","मई","जून","जुल","अग","सित","अक्","नव","दिस"][d.getMonth()]}</p>
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: "var(--maroon)" }}>{f.name}</p>
                    <p className="text-xs text-gray-600">{f.desc}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Vrat Cards */}
      <div>
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}>
          🙏 व्रत जानकारी
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {VRAT_CARDS.map((vrat) => (
            <button
              key={vrat.id}
              onClick={() => setSelectedVrat(vrat)}
              className="rounded-xl p-4 text-center shadow-sm border transition-transform hover:scale-105"
              style={{ borderColor: "var(--gold)", backgroundColor: "#fff8e6" }}
            >
              <div className="text-3xl mb-2">{vrat.icon}</div>
              <h3 className="font-bold text-sm" style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}>{vrat.title}</h3>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">{vrat.short}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Modal */}
      {selectedVrat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setSelectedVrat(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <span className="text-4xl">{selectedVrat.icon}</span>
              <h3 className="text-xl font-bold mt-2" style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}>
                {selectedVrat.title}
              </h3>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed" style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}>
              {selectedVrat.detail}
            </p>
            <button
              onClick={() => setSelectedVrat(null)}
              className="mt-5 w-full py-2 rounded-xl font-bold text-white transition-colors"
              style={{ backgroundColor: "var(--maroon)" }}
            >
              बंद करें
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
