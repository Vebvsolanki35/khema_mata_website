import { useLanguage } from "../context/LanguageContext";

const KINGS_DETAILED = [
  {
    name: "मुलराज सोलंकी",
    years: "940–995 CE",
    description: "महाराज मुलराज सोलंकी ने 940-941 ईसवी में अंतिम चावड़ा शासक सामंतसिंह को पराजित कर गुजरात पर सोलंकी राज्य की स्थापना की। उन्होंने अनहिलपाटक (आधुनिक पाटन) को अपनी राजधानी बनाया और एक सुदृढ़ प्रशासनिक व्यवस्था स्थापित की। वे शैव मतानुयायी थे और ब्राह्मणों व मंदिरों के महान संरक्षक थे। उन्होंने देई, बूंदी में माँ खेमज माता मंदिर की स्थापना की और इसे सोलंकी वंश की कुलदेवी के रूप में प्रतिष्ठित किया। मुलराज ने चुडासमा, परमार और चाहमान राजाओं के विरुद्ध सफल युद्ध लड़कर सोलंकी साम्राज्य की नींव मजबूत की।",
  },
  {
    name: "चामुंडराज",
    years: "995–1008 CE",
    description: "महाराज चामुंडराज मुलराज सोलंकी के पुत्र और योग्य उत्तराधिकारी थे जिन्होंने अपने पिता के कार्यों को आगे बढ़ाया। उनके शासनकाल में सोलंकी साम्राज्य की सीमाओं का और विस्तार हुआ तथा आंतरिक प्रशासन सुदृढ़ हुआ। वे एक वीर योद्धा थे जिन्होंने पड़ोसी राज्यों के आक्रमणों का सफलतापूर्वक सामना किया। माँ खेमज माता की पूजा-अर्चना का क्रम उनके शासनकाल में भी निरंतर जारी रहा और मंदिर में नियमित पूजा होती थी। उनके शासन में गुजरात में व्यापार और कृषि का विकास हुआ जिससे राज्य की आर्थिक स्थिति मजबूत हुई।",
  },
  {
    name: "दुर्लभराज",
    years: "1008–1022 CE",
    description: "महाराज दुर्लभराज सोलंकी वंश के तृतीय शासक थे जिन्होंने अपने पूर्वजों की गौरवशाली परंपरा को बनाए रखा। उनके शासनकाल में राज्य की आंतरिक स्थिरता और समृद्धि चरम पर थी। वे माँ खेमज माता के परम भक्त थे और नियमित रूप से देई मंदिर में दर्शन और पूजन करते थे। उनके कुशल प्रशासन ने भीमदेव प्रथम के महान शासनकाल की नींव तैयार की। दुर्लभराज ने कला, साहित्य और मंदिर निर्माण को प्रोत्साहन दिया और सोलंकी संस्कृति के विकास में महत्वपूर्ण भूमिका निभाई।",
  },
  {
    name: "भीमदेव प्रथम",
    years: "1022–1064 CE",
    description: "महाराज भीमदेव प्रथम के शासनकाल में 1024-25 ईसवी में महमूद गज़नवी ने सोमनाथ मंदिर पर आक्रमण किया जिसका सोलंकी सेना ने वीरता से सामना किया। उनकी पत्नी महारानी उदयमती ने पाटन में विश्व प्रसिद्ध रानी-की-वाव (UNESCO विश्व धरोहर) का निर्माण करवाया जो भारतीय वास्तुकला का अद्वितीय उदाहरण है। उन्होंने 1026 ईसवी में मोढेरा का भव्य सूर्य मंदिर बनवाया जो आज भी भारतीय स्थापत्य कला की उत्कृष्ट कृति मानी जाती है। उनके शासनकाल को गुजरात का स्वर्ण युग कहा जाता है जिसमें कला, साहित्य और वास्तुकला का अभूतपूर्व विकास हुआ। उनके पुत्र कर्णदेव ने बाद में कर्णावती (आधुनिक अहमदाबाद) नगर की स्थापना की।",
  },
  {
    name: "कर्णदेव",
    years: "1064–1092 CE",
    description: "महाराज कर्णदेव ने एक भील सरदार को पराजित कर कर्णावती नगर की स्थापना की जो आज भारत के प्रमुख महानगर अहमदाबाद के नाम से जाना जाता है। वे एक महान योद्धा और कुशल प्रशासक थे जिन्होंने सोलंकी साम्राज्य की सीमाओं का विस्तार किया। उनके काल में व्यापार और वाणिज्य का विकास हुआ तथा गुजरात एक समृद्ध राज्य बना। उनकी पत्नी मीनलदेवी से महान सम्राट सिद्धराज जयसिंह का जन्म हुआ जो सोलंकी वंश के सर्वश्रेष्ठ शासक बने। कर्णदेव ने माँ खेमज माता मंदिर का विस्तार करवाया और भव्य उत्सवों की परंपरा प्रारंभ की।",
  },
  {
    name: "सिद्धराज जयसिंह",
    years: "1094–1143 CE",
    description: "महाराज सिद्धराज जयसिंह सोलंकी वंश के सर्वश्रेष्ठ शासक माने जाते हैं जिन्होंने 56 वर्षों तक शासन किया और एक विशाल साम्राज्य की स्थापना की। उन्होंने सौराष्ट्र, कच्छ, मालवा सहित विशाल भूभाग जीता और 1137 ईसवी में मालवा विजय के बाद 'अवंतिनाथ' की उपाधि धारण की। सिद्धपुर में उन्होंने भव्य रुद्र महाकाल मंदिर का निर्माण करवाया जो उनकी वास्तुकला-प्रेम का प्रमाण है। जैन आचार्य हेमचंद्र उनके दरबार में थे जिनके प्रभाव से साहित्य, व्याकरण और दर्शन का विकास हुआ। उन्होंने माँ खेमज माता मंदिर का भव्य जीर्णोद्धार करवाया और सोने-संगमरमर से मंदिर को सुसज्जित किया।",
  },
  {
    name: "कुमारपाल",
    years: "1143–1172 CE",
    description: "महाराज कुमारपाल हेमचंद्राचार्य के प्रभाव में जैन धर्म के अनुयायी बने और उन्होंने अपने राज्य में पशुहत्या पर पूर्ण प्रतिबंध लगाया। उन्होंने भीमदेव प्रथम के काल में क्षतिग्रस्त सोमनाथ मंदिर का पुनर्निर्माण करवाया और उसे पूर्व वैभव प्रदान किया। तुर्क आक्रमणकारियों को उन्होंने कई बार पराजित किया और गुजरात की स्वतंत्रता की रक्षा की। उनके न्यायप्रिय और धर्मनिष्ठ शासन की प्रशंसा समकालीन जैन और हिंदू ग्रंथों में मिलती है। कुमारपाल ने मंदिर निर्माण और धार्मिक संस्थाओं को उदारतापूर्वक संरक्षण दिया।",
  },
  {
    name: "भीमदेव द्वितीय",
    years: "1178–1240 CE",
    description: "महाराज भीमदेव द्वितीय के शासनकाल में कयाडरा का ऐतिहासिक युद्ध (1178 CE) हुआ जिसमें रानी नायकी देवी ने अपने अल्पायु पुत्र की ओर से सेना का नेतृत्व करते हुए माउंट आबू के पास मोहम्मद गोरी की विशाल सेना को करारी पराजय दी। यह युद्ध भारतीय इतिहास में मुस्लिम आक्रमणकारियों की सबसे बड़ी पराजयों में से एक माना जाता है। भीमदेव द्वितीय ने स्वयं मोहम्मद गोरी को पकड़कर 2 वर्षों तक गुजरात में बंदी बनाए रखा जिसके बाद गोरी ने कभी गुजरात की ओर दृष्टि नहीं डाली। उनके बाद वाघेला वंश ने सत्ता संभाली और 1299 ईसवी में अलाउद्दीन खिलजी के सेनापतियों ने गुजरात पर अधिकार किया। सोलंकी वंश का यह अंतिम महान शासक था जिसके बाद भी सोलंकी परिवारों ने माँ खेमज माता की उपासना की परंपरा जारी रखी।",
  },
];

const TOP_SECTION = `सोलंकी वंश (चालुक्य वंश) भारत के सबसे गौरवशाली राजपूत वंशों में से एक है। इस वंश ने गुजरात और राजस्थान पर लगभग 940 ईसवी से 1244 ईसवी तक शासन किया। उनकी राजधानी अनहिलवाड़ा (आधुनिक पाटन, गुजरात) थी जो उस समय भारत के सबसे बड़े नगरों में से एक था जिसकी जनसंख्या एक लाख से अधिक थी।

सोलंकी राजा अग्निकुल क्षत्रिय थे — पुराणों के अनुसार आबू पर्वत पर विशिष्ट ऋषि के यज्ञ-कुंड से चार वीर योद्धा प्रकट हुए — परमार, प्रतिहार, चालुक्य (सोलंकी) और चाहमान (चौहान)। ये चारों अग्निवंशी क्षत्रिय कहलाते हैं।

वे शैव, वैष्णव और जैन धर्म के महान संरक्षक थे। सोलंकी काल को गुजरात का स्वर्ण युग कहा जाता है। इस काल में मोढेरा सूर्य मंदिर (1026 CE), रानी-की-वाव पाटन (UNESCO विश्व धरोहर), रुद्र महाकाल मंदिर सिद्धपुर जैसी अद्वितीय वास्तुकला का निर्माण हुआ।

सोलंकी सेनाओं ने महमूद गज़नवी, मोहम्मद गोरी जैसे आक्रमणकारियों को कई बार पराजित किया। कयाडरा युद्ध (1178 CE) में रानी नायकी देवी ने गोरी की सेना को कुचल दिया — यह मध्यकालीन भारत के सबसे महत्वपूर्ण युद्धों में से एक है। महाराज भीमदेव द्वितीय ने मोहम्मद गोरी को 2 वर्ष बंदी बनाकर रखा।

सोलंकी राजाओं की कुलदेवी माँ खेमज माता (श्री क्षेमकरी माता) हैं जिनका मुख्य मंदिर देई, बूंदी, राजस्थान में स्थित है। इस मंदिर की स्थापना स्वयं वंश संस्थापक महाराज मुलराज सोलंकी ने ~940 ईसवी में की थी।`;

const BOTTOM_SECTION = `सोलंकी वंश की महान विरासत आज भी भारतीय इतिहास और संस्कृति में जीवित है। इस वंश के शासकों ने न केवल युद्ध में वीरता दिखाई बल्कि कला, साहित्य, वास्तुकला और धर्म के क्षेत्र में भी अमूल्य योगदान दिया।

मोढेरा का सूर्य मंदिर और पाटन की रानी-की-वाव आज UNESCO विश्व धरोहर सूची में शामिल हैं और भारतीय स्थापत्य कला की उत्कृष्ट उदाहरण हैं। जैन आचार्य हेमचंद्र के साथ सिद्धराज जयसिंह की मित्रता ने गुजराती साहित्य और भाषा के विकास में महत्वपूर्ण भूमिका निभाई।

आज लाखों सोलंकी परिवार गुजरात, राजस्थान, मध्यप्रदेश और महाराष्ट्र में निवास करते हैं। सोलंकी, शुक्ल, मेहता, शाह और अनेक उपनामों वाले परिवार इस गौरवशाली वंश के वंशज हैं।

माँ खेमज माता की उपासना इस वंश की सांस्कृतिक पहचान और एकता का प्रतीक है। प्रतिवर्ष नवरात्रि में देई मंदिर में कुल महामिलन आयोजित होता है जिसमें हजारों सोलंकी परिवार एकत्रित होते हैं और अपनी साझा विरासत का उत्सव मनाते हैं।

सोलंकी वंश का इतिहास हमें यह सिखाता है कि शक्ति और भक्ति का संयोग ही सच्ची महानता है। माँ खेमज माता के आशीर्वाद से यह वंश आज भी फलता-फूलता है और अपनी गौरवशाली परंपराओं को जीवित रखे हुए है। जय माँ खेमज! जय सोलंकी वंश!`;

function History() {
  const { t } = useLanguage();
  const hp = t.historyPage;

  return (
    <main>
      {/* Hero */}
      <section
        className="py-20 px-4 text-center"
        style={{ background: "linear-gradient(135deg, var(--maroon) 0%, #5A0E0E 100%)" }}
      >
        <div className="text-5xl mb-4">👑</div>
        <h1
          className="text-3xl md:text-5xl font-bold mb-3"
          style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
        >
          {hp.title}
        </h1>
        <p className="text-lg opacity-90" style={{ color: "#FFF8F0" }}>
          {hp.subtitle}
        </p>
      </section>

      {/* Top Section - Solanki Dynasty Overview */}
      <section className="py-12 px-4" style={{ backgroundColor: "#FFF0E0" }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{hp.agnikulaTitle}</h2>
          <div
            className="mt-8 p-6 rounded-2xl leading-relaxed text-gray-700 space-y-4"
            style={{
              backgroundColor: "white",
              borderLeft: "5px solid var(--gold)",
              fontFamily: "'Tiro Devanagari Hindi', serif",
              fontSize: "1.05rem",
            }}
          >
            {TOP_SECTION.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Solanki Kings Timeline */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{hp.dynastyTitle}</h2>
          <div className="timeline-line ml-6 pl-8 space-y-8 mt-10 relative">
            {KINGS_DETAILED.map((king, i) => (
              <div key={i} className="relative">
                {/* Dot */}
                <span
                  className="absolute -left-11 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs"
                  style={{
                    backgroundColor: "var(--gold)",
                    borderColor: "var(--maroon)",
                    color: "var(--maroon)",
                    fontWeight: "bold",
                  }}
                >
                  {i + 1}
                </span>
                <div
                  className="rounded-xl p-5 shadow-sm temple-card"
                  style={{ backgroundColor: "var(--cream)" }}
                >
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3
                      className="font-bold text-lg"
                      style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                    >
                      👑 {king.name}
                    </h3>
                    <span
                      className="text-sm font-semibold px-3 py-1 rounded-full"
                      style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
                    >
                      {king.years}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed" style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}>{king.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Battle of Kasahrada */}
      <section className="py-12 px-4" style={{ backgroundColor: "var(--maroon)" }}>
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-2xl md:text-3xl font-bold mb-8 text-center"
            style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
          >
            ⚔️ {hp.kasahradaTitle}
          </h2>
          <div
            className="p-6 rounded-2xl mb-4"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid var(--gold)" }}
          >
            <p className="leading-relaxed" style={{ color: "#FFF8F0", fontFamily: "'Tiro Devanagari Hindi', serif" }}>
              {hp.kasahradaDesc}
            </p>
          </div>
          <div
            className="p-4 rounded-xl text-center font-semibold"
            style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
          >
            🏆 {hp.imprisonDesc}
          </div>
        </div>
      </section>

      {/* Solanki Heritage */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{hp.heritageTitle}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
            {hp.heritage.map((item, i) => (
              <div
                key={i}
                className="temple-card rounded-2xl p-6"
                style={{ backgroundColor: "var(--cream)", borderTop: "4px solid var(--saffron)" }}
              >
                <h3
                  className="font-bold text-lg mb-2"
                  style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                >
                  🏛️ {item.name}
                </h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Section - Legacy */}
      <section className="py-12 px-4" style={{ backgroundColor: "#FFF0E0" }}>
        <div className="max-w-3xl mx-auto">
          <div
            className="p-6 rounded-2xl leading-relaxed text-gray-700 space-y-4"
            style={{
              backgroundColor: "white",
              borderLeft: "5px solid var(--saffron)",
              fontFamily: "'Tiro Devanagari Hindi', serif",
              fontSize: "1.05rem",
            }}
          >
            {BOTTOM_SECTION.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default History;
