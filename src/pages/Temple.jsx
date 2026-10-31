import { Link } from "react-router-dom";
import { useLanguage } from "../context/useLanguage";
import { HistoryContent } from "./History";
import { GalleryContent } from "./Gallery";

/**
 * The "Virasat" tab — one complete, vertically scrollable page.
 *
 * Everything about the temple and its heritage is rendered here in order:
 *   1. temple introduction and information
 *   2. temple history
 *   3. Solanki dynasty history and heritage  (<HistoryContent/>)
 *   4. photo gallery (verified photographs only)
 *
 * Darshan and aarti timings are NOT repeated here — they are published once on
 * the home page, linked from the card below the information table. The former
 * "Helpful services" card grid (/facilities) has been removed entirely.
 */
function Temple() {
  const { t } = useLanguage();
  const tp = t.temple;

  return (
    <main>
      {/* Hero Banner */}
      <section
        className="relative py-10 sm:py-14 px-4 text-center"
        style={{
          backgroundImage: "linear-gradient(135deg, var(--maroon) 0%, #6B1313 100%)",
        }}
      >
        <div className="text-3xl sm:text-4xl mb-2.5">🛕</div>
        <h1
          className="text-3xl md:text-5xl font-bold mb-2"
          style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
        >
          {tp.title}
        </h1>
        <p className="text-lg" style={{ color: "#FFF8F0" }}>
          {tp.subtitle}
        </p>
      </section>

      {/* Temple Info Table */}
      <section className="py-12 px-4" style={{ backgroundColor: "var(--cream)" }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{tp.infoTitle}</h2>
          <div className="rounded-2xl overflow-hidden shadow-lg mt-8" style={{ border: "1px solid var(--gold)" }}>
            <table className="info-table w-full">
              <tbody>
                {tp.info.map((row, i) => (
                  <tr key={i}>
                    <th className="text-left w-1/3">{row.label}</th>
                    <td className="text-gray-800">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p
            className="mt-4 text-center font-semibold py-3 rounded-xl"
            style={{ color: "var(--maroon)", backgroundColor: "rgba(212,175,55,0.15)", border: "1px solid var(--gold)" }}
          >
            {tp.freeEntry}
          </p>
        </div>
      </section>

      <div className="gold-divider mx-8" />

      {/* Single link to the one place that shows darshan and aarti timings */}
      <section className="pb-8 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <Link
            to="/#darshan-timings"
            className="flex items-center justify-between gap-3 rounded-2xl px-4 py-4"
            style={{
              backgroundColor: "var(--cream)",
              border: "1.5px solid var(--gold)",
              minHeight: "64px",
            }}
            data-testid="temple-darshan-link"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span aria-hidden="true" className="text-xl">
                🔔
              </span>
              <span className="min-w-0">
                <span
                  className="block font-bold text-sm sm:text-base"
                  style={{ color: "var(--maroon)" }}
                >
                  {t.nav.darshanTab}
                </span>
                <span className="block text-[11px] sm:text-xs" style={{ color: "#6B5B4B" }}>
                  मुख्य पृष्ठ पर दर्शन एवं आरती का समय देखें
                </span>
              </span>
            </span>
            <span aria-hidden="true" style={{ color: "var(--gold)" }}>
              →
            </span>
          </Link>
        </div>
      </section>

      {/* History */}
      <section className="py-12 px-4" style={{ backgroundColor: "#FFF0E0" }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{tp.historyTitle}</h2>
          <div className="space-y-5 mt-8">
            {[
              "श्री खेमज माता मंदिर राजस्थान के बूंदी जिले के देई ग्राम में स्थित एक अत्यंत प्राचीन और पवित्र शक्तिपीठ है। यह मंदिर गुजरात के सोलंकी राजवंश के संस्थापक महाराज मुलराज सोलंकी (~940-995 ईसवी) ने स्थापित करवाया था। माँ खेमज सोलंकी कुल की आराध्य देवी हैं जो अपने सात वाहनों के साथ भक्तों के कष्ट हरती हैं।",
              "मंदिर का नाम 'खेमज' या 'क्षेमकरी' संस्कृत शब्द 'क्षेम' से आया है जिसका अर्थ है कल्याण और रक्षा करने वाली। दुर्गा सप्तशती के अनुसार माँ क्षेमकरी मार्ग की रक्षा करती हैं और पथिकों को भय से मुक्त करती हैं। देई मंदिर में जो मूल प्रतिमा विराजमान है वह 1000+ वर्ष पुरानी मूल प्राचीन मूर्ति है जिसे मुगल काल में बूंदी लाकर सुरक्षित रखा गया था।",
              "12वीं सदी में महाराज सिद्धराज जयसिंह ने मंदिर का भव्य जीर्णोद्धार करवाया। उन्होंने मंदिर में सोने और संगमरमर की नक्काशी करवाई तथा नवरात्रि महोत्सव को राजकीय उत्सव घोषित किया। माँ के 7 वाहन — सिंह, हाथी, घोड़ा, मोर, नाग, कछुआ और मगरमच्छ — उनकी असीम शक्ति के प्रतीक हैं। प्रत्येक वाहन एक विशेष शक्ति और आशीर्वाद का प्रतिनिधित्व करता है।",
              "मुगल काल में जब हिंदू मंदिरों पर आक्रमण हो रहे थे, समर्पित सोलंकी राजपूतों ने माँ की मूल प्रतिमा को बूंदी के देई ग्राम में सुरक्षित स्थानांतरित किया। तब से यह मंदिर सोलंकी वंश की आस्था का केंद्र बना हुआ है। आज भी इस मंदिर में हर वर्ष लाखों श्रद्धालु दर्शन के लिए आते हैं।",
              "मंदिर परिसर में माँ खेमज के अतिरिक्त काल भैरव, गणेश जी, गोरा भैरव और अंबाजी की प्रतिमाएं भी स्थापित हैं। केंद्रीय वेदी पर भगवान सूर्य की प्रतिमा है। मंदिर की वास्तुकला मध्यकालीन राजपूत शैली में है जिसमें अलंकृत प्रवेश द्वार, सिंह मूर्तियां और काले-सफेद संगमरमर का आंगन विशेष रूप से उल्लेखनीय है।",
              "प्रतिवर्ष चैत्र नवरात्रि (मार्च-अप्रैल) और शारदीय नवरात्रि (अक्टूबर) में मंदिर में भव्य उत्सव मनाया जाता है। देश-विदेश से हजारों सोलंकी परिवार कुल महामिलन के लिए एकत्रित होते हैं। विशेष श्रृंगार, भव्य आरती, प्रसाद वितरण और सांस्कृतिक कार्यक्रम आयोजित किए जाते हैं।",
              "मंदिर न्यास द्वारा श्रद्धालुओं के लिए निःशुल्क दर्शन, प्रसाद वितरण, धर्मशाला और भंडारे की व्यवस्था की जाती है। मंदिर में सोलंकी इतिहास और माँ खेमज माता पर एक विस्तृत पुस्तक भी उपलब्ध है जो मंदिर न्यास से प्राप्त की जा सकती है।",
            ].map((para, i) => (
              <p
                key={i}
                className="text-gray-700 leading-relaxed text-base md:text-lg"
                style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}
              >
                {para}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* 3 — Solanki dynasty history and heritage (from /history) */}
      <HistoryContent />

      {/* 4 — Photo gallery: verified photographs only (from /gallery) */}
      <GalleryContent />

    </main>
  );
}

export default Temple;
