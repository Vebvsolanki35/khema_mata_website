function Ticker() {
  const updates = [
    "🙏 श्री खेमज माता जी की जय!",
    "🎉 चैत्र नवरात्रि महोत्सव: मार्च-अप्रैल 2025",
    "⏰ दर्शन समय: प्रातः ५:०० - १२:०० | सायं ४:०० - ९:०० बजे",
    "🕌 मंदिर स्थान: देई, बूंदी, राजस्थान ३२३८०२",
    "💸 ऑनलाइन दान: kheemajmata.dei@upi",
    "📞 WhatsApp: +91 90012 34567",
    "🌟 निःशुल्क दर्शन | Free Entry",
    "🔔 शारदीय नवरात्रि: अक्टूबर 2025",
  ];

  const tickerText = updates.join("   •   ");

  return (
    <div
      className="overflow-hidden"
      style={{ backgroundColor: "var(--maroon)", color: "var(--gold)", padding: "6px 0" }}
    >
      <span className="ticker-text text-sm font-semibold tracking-wide">
        {tickerText}
        &nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;
        {tickerText}
      </span>
    </div>
  );
}

export default Ticker;
