import useIntersectionObserver from "../hooks/useIntersectionObserver";

const TESTIMONIALS = [
  {
    name: "राजेश सोलंकी",
    nameEn: "Rajesh Solanki",
    location: "जयपुर, राजस्थान",
    locationEn: "Jaipur, Rajasthan",
    text: "माँ खेमज माता के दर्शन से मन को अद्भुत शांति मिलती है। हर नवरात्रि पर परिवार सहित आते हैं और माँ की कृपा से जीवन में सुख-समृद्धि बनी रहती है।",
    textEn: "Visiting Maa Khemaj Mata brings extraordinary peace to the mind. We come with family every Navratri and by Maa's grace, our life is filled with happiness and prosperity.",
    rating: 5,
  },
  {
    name: "मीना देवी",
    nameEn: "Meena Devi",
    location: "कोटा, राजस्थान",
    locationEn: "Kota, Rajasthan",
    text: "मंदिर की भव्यता और पुजारी जी की सेवा अतुलनीय है। यहाँ आकर ऐसा लगता है जैसे माँ खुद आशीर्वाद दे रही हैं। ५ साल से नियमित आना हो रहा है।",
    textEn: "The grandeur of the temple and the priest's service are incomparable. Coming here feels like Maa is personally bestowing blessings. We have been visiting regularly for 5 years.",
    rating: 5,
  },
  {
    name: "अनिल कुमार वर्मा",
    nameEn: "Anil Kumar Verma",
    location: "दिल्ली",
    locationEn: "Delhi",
    text: "दूर से आने पर भी यात्रा की थकान माँ के दर्शन करते ही मिट जाती है। मंदिर का वातावरण बहुत पवित्र और शांत है। ज़रूर एक बार आएं।",
    textEn: "Even after traveling from far away, all fatigue vanishes the moment you see Maa. The temple atmosphere is very sacred and peaceful. Please visit at least once.",
    rating: 5,
  },
  {
    name: "सुनीता पटेल",
    nameEn: "Sunita Patel",
    location: "अहमदाबाद, गुजरात",
    locationEn: "Ahmedabad, Gujarat",
    text: "सोलंकी वंश की कुलदेवी के दर्शन करना हमारे लिए बहुत पवित्र अनुभव है। मंदिर में सफाई और व्यवस्था बेहतरीन है। माँ की जय!",
    textEn: "Visiting the clan goddess of the Solanki dynasty is a very sacred experience for us. The temple cleanliness and management are excellent. Jai Maa!",
    rating: 5,
  },
];

function StarRating({ count }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < count ? "var(--gold)" : "#d1d5db" }}>
          ★
        </span>
      ))}
    </div>
  );
}

function TestimonialCard({ testimonial, visible }) {
  return (
    <div
      className="rounded-2xl p-6 bg-white flex flex-col gap-3 temple-card"
      style={{
        border: "1px solid rgba(212,175,55,0.35)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      <StarRating count={testimonial.rating} />
      <p
        className="text-gray-700 text-sm leading-relaxed flex-1"
        style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}
      >
        "{testimonial.text}"
      </p>
      <div className="flex items-center gap-3 mt-2 border-t pt-3" style={{ borderColor: "rgba(212,175,55,0.3)" }}>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
          style={{ backgroundColor: "var(--maroon)", color: "var(--gold)" }}
        >
          {testimonial.name.charAt(0)}
        </div>
        <div>
          <div
            className="font-bold text-sm"
            style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
          >
            {testimonial.name}
          </div>
          <div className="text-xs text-gray-500">{testimonial.location}</div>
        </div>
      </div>
    </div>
  );
}

function Testimonials() {
  const [ref, isIntersecting] = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section ref={ref} className="py-16 px-4" style={{ backgroundColor: "var(--cream)" }}>
      <div className="max-w-6xl mx-auto">
        <h2 className="section-title text-2xl md:text-3xl font-bold">
          💬 श्रद्धालुओं के अनुभव
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={i} testimonial={t} visible={isIntersecting} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Testimonials;
