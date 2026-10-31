import { useState, useEffect } from "react";
import { useLanguage } from "../context/useLanguage";
import { supabase } from "../lib/supabase";
import { MEDIA } from "../config/media";

const DEFAULT_IMAGES = [
  { url: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600", title: "राजस्थान मंदिर" },
  { url: "https://images.unsplash.com/photo-1477587458883-47145ed6a800?w=600", title: "राजस्थान किला" },
  { url: "https://images.unsplash.com/photo-1548013146-72479768bada?w=600", title: "आमेर किला जयपुर" },
  { url: "https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=600", title: "राजस्थान संस्कृति" },
  { url: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600", title: "मंदिर प्रांगण" },
  { url: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=600", title: "मंदिर द्वार" },
  { url: "https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=600", title: "माँ की आरती" },
  { url: "https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=600", title: "नवरात्रि उत्सव" },
  { url: "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=600", title: "चित्तौड़गढ़ किला" },
  { url: "https://images.unsplash.com/photo-1568454537842-d933259bb258?w=600", title: "माँ भवानी" },
  { url: "https://images.unsplash.com/photo-1609766418204-94aae0ecfdfc?w=600", title: "मंदिर घंटी" },
  { url: "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600", title: "जयपुर हवा महल" },
];

/** Hero banner. Rendered above the Gallery content.
 *  Kept separate so the parent page can inline the body only.
 */
function GalleryHero() {
  const { t } = useLanguage();

  return (
    <section
      className="py-10 sm:py-14 px-4 text-center"
      style={{ background: "linear-gradient(135deg, var(--maroon), #5A0E0E)" }}
    >
      <div className="text-3xl sm:text-4xl mb-2.5">📷</div>
      <h1
        className="text-3xl md:text-4xl font-bold mb-2"
        style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
      >
        {t.gallery.title}
      </h1>
    </section>
  );
}

/**
 * All Gallery content below the hero.
 *
 * Exported so Virasat (/temple) can render it inline as one continuous page.
 * Nothing is removed: the /gallery route still renders exactly this
 * content, unchanged and fully functional.
 */
export function GalleryContent() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(null);
  const [dbImages, setDbImages] = useState([]);

  useEffect(() => {
    supabase
      .from("gallery_images")
      .select("url, title")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) setDbImages(data);
      });
  }, []);

  /**
   * The authentic temple photograph supplied by the trust.
   * Shown first with a caption. It is NEVER replaced by generated or stock
   * imagery — when `MEDIA.templeEntrance` is null the slot simply isn't rendered.
   */
  const featured = MEDIA.templeEntrance
    ? {
        url: MEDIA.templeEntrance,
        title: t.gallery.featuredCaption,
        featured: true,
      }
    : null;

  const allImages = [...(featured ? [featured] : []), ...dbImages, ...DEFAULT_IMAGES];

  return (
    <>

      {/* Gallery Grid */}
      <section className="py-12 px-4" style={{ backgroundColor: "var(--cream)" }}>
        <div className="max-w-6xl mx-auto">
          {/* Masonry Grid */}
          <div className="masonry-grid">
            {allImages.map((img, idx) => (
              <div
                key={idx}
                className="masonry-item"
                onClick={() => setSelected(img)}
                style={{
                  border: img.featured
                    ? "3px solid var(--gold)"
                    : "2px solid transparent",
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--gold)")}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = img.featured
                    ? "var(--gold)"
                    : "transparent")
                }
              >
                <img
                  src={img.url}
                  alt={img.title}
                  loading="lazy"
                  decoding="async"
                />
                {img.featured && (
                  <p
                    className="text-[11px] font-bold px-2 py-1 text-center"
                    style={{ backgroundColor: "var(--maroon)", color: "var(--gold)" }}
                  >
                    ⭐ {t.gallery.featuredLabel}
                  </p>
                )}
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
                new URL(selected.url).hostname === "images.unsplash.com"
                  ? selected.url.replace("w=600", "w=1200")
                  : selected.url
              }
              alt={selected.title}
              className="w-full rounded-2xl shadow-2xl"
              style={{ maxHeight: "80vh", objectFit: "contain" }}
            />
            <p className="text-center mt-3 text-sm opacity-80" style={{ color: "#FFF8F0" }}>
              {selected.title}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default function Gallery() {
  return (
    <main>
      <GalleryHero />
      <GalleryContent />
    </main>
  );
}
