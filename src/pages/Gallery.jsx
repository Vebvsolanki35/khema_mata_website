import { useState, useEffect } from "react";
import { useLanguage } from "../context/useLanguage";
import { supabase } from "../lib/supabase";
import { MEDIA } from "../config/media";

/**
 * Photo gallery — verified temple photographs only.
 *
 * WHY THERE ARE NO DEFAULT/STOCK IMAGES
 * The gallery used to fall back to twelve Unsplash photographs of Rajasthan
 * forts, Hawa Mahal and generic temples. None of them showed this temple, so
 * they were removed rather than replaced: inventing or substituting imagery of
 * a place of worship misleads devotees.
 *
 * Only two sources are rendered now:
 *   1. `MEDIA.templeEntrance` — the original photograph supplied by the trust.
 *   2. Rows in the `gallery_images` table, which the trust adds through the
 *      admin dashboard (Admin → गैलरी). That is the approval workflow.
 *
 * When neither exists the section shows a calm, honest empty state instead of
 * an empty grid or broken images.
 */

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
      <div className="text-3xl sm:text-4xl mb-2.5" aria-hidden="true">
        📷
      </div>
      <h1
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2"
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
 */
export function GalleryContent() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(null);
  const [dbImages, setDbImages] = useState([]);

  useEffect(() => {
    supabase
      .from("gallery_images")
      .select("url, image_url, title")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data || [])
          // The admin tab writes `image_url`; older rows may carry `url`.
          // Accept either so an approved photo is never silently dropped.
          .map((row) => ({
            url: row.url || row.image_url || "",
            title: row.title || "",
          }))
          .filter((row) => Boolean(row.url));
        if (rows.length > 0) setDbImages(rows);
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

  const allImages = [...(featured ? [featured] : []), ...dbImages];

  return (
    <>
      <section
        className="py-8 sm:py-12 px-3.5 sm:px-4"
        style={{ backgroundColor: "var(--cream)" }}
        aria-labelledby="gallery-heading"
      >
        <div className="max-w-5xl mx-auto">
          <h2
            id="gallery-heading"
            className="text-lg sm:text-xl font-bold mb-1 text-center"
            style={{
              color: "var(--maroon)",
              fontFamily: "'Tiro Devanagari Hindi', serif",
            }}
          >
            {t.gallery.title}
          </h2>
          <p
            className="text-[11px] sm:text-xs text-center mb-4"
            style={{ color: "#6B5B4B" }}
          >
            {t.gallery.provenanceNote}
          </p>

          {allImages.length > 0 ? (
            <div className="masonry-grid" data-testid="gallery-grid">
              {allImages.map((img, idx) => (
                <button
                  key={`${img.url}-${idx}`}
                  type="button"
                  className="masonry-item cursor-pointer"
                  onClick={() => setSelected(img)}
                  aria-label={`${t.gallery.title}: ${img.title}`}
                  style={{
                    border: img.featured
                      ? "3px solid var(--gold)"
                      : "2px solid transparent",
                    transition: "border-color 0.2s",
                    padding: 0,
                    background: "none",
                  }}
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
                </button>
              ))}
            </div>
          ) : (
            <div
              className="rounded-2xl bg-white px-5 py-8 text-center max-w-xl mx-auto"
              style={{ border: "1.5px dashed var(--gold)" }}
              data-testid="gallery-empty-state"
            >
              <div className="text-3xl mb-2" aria-hidden="true">
                📷
              </div>
              <h3
                className="font-bold text-base mb-1.5"
                style={{ color: "var(--maroon)" }}
              >
                {t.gallery.emptyTitle}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "#4A3728" }}>
                {t.gallery.emptyBody}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.9)" }}
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
        >
          <div
            className="relative max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute -top-12 right-0 font-bold text-base cursor-pointer"
              style={{ color: "var(--gold)", minHeight: "44px", minWidth: "44px" }}
            >
              ✕ {t.gallery.close}
            </button>
            <img
              src={selected.url}
              alt={selected.title}
              className="w-full rounded-2xl shadow-2xl"
              style={{ maxHeight: "80vh", objectFit: "contain" }}
            />
            <p
              className="text-center mt-3 text-sm opacity-80"
              style={{ color: "#FFF8F0" }}
            >
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
