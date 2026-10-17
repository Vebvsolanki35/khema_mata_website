/**
 * Festival / auspicious-date records.
 *
 * MOVED VERBATIM from src/pages/Calendar.jsx so the Home page can show
 * "upcoming festivals" without duplicating the data. Calendar.jsx now imports
 * from here — the records themselves are unchanged.
 */
export const FESTIVALS = [
  { date: "2025-03-30", name: "चैत्र नवरात्रि प्रारंभ", type: "navratri", desc: "माँ शैलपुत्री की पूजा" },
  { date: "2025-04-06", name: "रामनवमी", type: "festival", desc: "भगवान राम का जन्मदिन" },
  { date: "2025-04-13", name: "हनुमान जयंती", type: "festival", desc: "बजरंगबली का प्रकटोत्सव" },
  { date: "2025-10-02", name: "शारदीय नवरात्रि", type: "navratri", desc: "माँ दुर्गा के नौ स्वरूप" },
  { date: "2025-10-12", name: "दशहरा", type: "festival", desc: "रावण दहन" },
  { date: "2025-10-20", name: "दीपावली", type: "festival", desc: "लक्ष्मी पूजन, दीपों का महोत्सव" },
  { date: "2025-11-05", name: "छठ पूजा", type: "festival", desc: "सूर्य देव को अर्घ्य" },
  { date: "2026-03-19", name: "चैत्र नवरात्रि 2026", type: "navratri", desc: "माँ खेमज माता का विशेष उत्सव" },
];

export default FESTIVALS;
