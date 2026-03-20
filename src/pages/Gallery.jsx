import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

const IMAGES = [
  { src: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600", alt: "राजस्थान मंदिर" },
  { src: "https://images.unsplash.com/photo-1477587458883-47145ed6a800?w=600", alt: "राजस्थान किला" },
  { src: "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=600", alt: "चित्तौड़गढ़" },
  { src: "https://images.unsplash.com/photo-1548013146-72479768bada?w=600", alt: "आमेर किला" },
  { src: "https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=600", alt: "राजस्थान संस्कृति" },
  { src: "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600", alt: "जयपुर" },
  { src: "https://images.unsplash.com/photo-1568454537842-d933259bb258?w=600", alt: "माँ दुर्गा" },
  { src: "https://images.unsplash.com/photo-1609766418204-94aae0ecfdfc?w=600", alt: "मंदिर घंटी" },
  { src: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600", alt: "मंदिर प्रांगण" },
  { src: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=600", alt: "मंदिर द्वार" },
  { src: "https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=600", alt: "नवरात्रि उत्सव" },
  { src: "https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=600", alt: "माँ की आरती" },
];

function Gallery() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(null);

  return (
    <main>
      {/* Hero */}
      <section
        className="py-16 px-4 text-center"
        style={{ background: "linear-gradient(135deg, var(--maroon), #5A0E0E)" }}
      >
        <div className="text-5xl mb-4">📷</div>
        <h1
          className="text-3xl md:text-4xl font-bold mb-2"
          style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
        >
          {t.gallery.title}
        </h1>
      </section>

      {/* Gallery Grid */}
      <section className="py-12 px-4" style={{ backgroundColor: "var(--cream)" }}>
        <div className="max-w-6xl mx-auto">
          {/* Upload placeholder */}
          <div className="text-center mb-8">
            <button
              className="px-6 py-2 rounded-full font-semibold text-sm transition-colors"
              style={{ backgroundColor: "var(--maroon)", color: "var(--gold)", border: "1px solid var(--gold)" }}
              onClick={() => alert("Upload feature coming soon!")}
            >
              📤 {t.gallery.upload}
            </button>
          </div>

          {/* Masonry Grid */}
          <div className="masonry-grid">
            {IMAGES.map((img, idx) => (
              <div
                key={idx}
                className="masonry-item"
                onClick={() => setSelected(img)}
                style={{ border: "2px solid transparent", transition: "border-color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--gold)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.9)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute -top-12 right-0 font-bold text-lg transition-colors"
              style={{ color: "var(--gold)" }}
            >
              ✕ {t.gallery.close}
            </button>
            <img
              src={
                new URL(selected.src).hostname === "images.unsplash.com"
                  ? selected.src.replace("w=600", "w=1200")
                  : selected.src
              }
              alt={selected.alt}
              className="w-full rounded-2xl shadow-2xl"
              style={{ maxHeight: "80vh", objectFit: "contain" }}
            />
            <p className="text-center mt-3 text-sm opacity-80" style={{ color: "#FFF8F0" }}>
              {selected.alt}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

export default Gallery;
