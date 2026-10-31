/**
 * Scrolling announcement bar.
 *
 * Deliberately limited to timeless essentials: no darshan timings (the home
 * page publishes them) and no dated festival announcements that would silently
 * go stale. There is no placeholder phone number here — the WhatsApp entry
 * points at the official channel.
 */
function Ticker() {
  const updates = [
    "🙏 श्री खेमज माता जी की जय!",
    "🕌 देई, बूंदी, राजस्थान ३२३८०२",
    "🌟 निःशुल्क दर्शन | Free Entry",
    "💸 बैंक दान: ICICI Bank • खाता 686005601933 • IFSC ICIC0006860",
    "💬 मंदिर अपडेट के लिए आधिकारिक WhatsApp चैनल फॉलो करें",
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
