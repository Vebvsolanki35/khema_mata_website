import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

const IMAGES = [
  { src: "https://placehold.co/400x300/f97316/ffffff?text=Temple+Front", alt: "Temple Front View" },
  { src: "https://placehold.co/400x300/ea580c/ffffff?text=Main+Shrine", alt: "Main Shrine" },
  { src: "https://placehold.co/400x300/d97706/ffffff?text=Mata+Idol", alt: "Mata Idol" },
  { src: "https://placehold.co/400x300/b45309/ffffff?text=Temple+Gate", alt: "Temple Gate" },
  { src: "https://placehold.co/400x300/92400e/ffffff?text=Aarti+View", alt: "Aarti View" },
  { src: "https://placehold.co/400x300/f97316/ffffff?text=Prasad+Hall", alt: "Prasad Hall" },
  { src: "https://placehold.co/400x300/ea580c/ffffff?text=Festival+Decor", alt: "Festival Decoration" },
  { src: "https://placehold.co/400x300/d97706/ffffff?text=Navratri+2023", alt: "Navratri 2023" },
  { src: "https://placehold.co/400x300/b45309/ffffff?text=Courtyard", alt: "Temple Courtyard" },
  { src: "https://placehold.co/400x300/92400e/ffffff?text=Evening+Aarti", alt: "Evening Aarti" },
  { src: "https://placehold.co/400x300/f97316/ffffff?text=Pilgrims", alt: "Pilgrims Visiting" },
  { src: "https://placehold.co/400x300/ea580c/ffffff?text=Temple+Night", alt: "Temple at Night" },
];

function Gallery() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(null);

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl md:text-4xl font-bold text-orange-700 text-center mb-10">
        📷 {t.gallery.title}
      </h1>

      {/* 12-image grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {IMAGES.map((img, idx) => (
          <button
            key={idx}
            onClick={() => setSelected(img)}
            className="overflow-hidden rounded-xl shadow hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <img
              src={img.src}
              alt={img.alt}
              className="w-full h-40 object-cover hover:scale-105 transition-transform duration-300"
            />
          </button>
        ))}
      </div>

      {/* Lightbox modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute -top-10 right-0 text-white font-bold text-lg hover:text-orange-300 transition-colors"
            >
              ✕ {t.gallery.close}
            </button>
            <img
              src={selected.src}
              alt={selected.alt}
              className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
            <p className="text-white text-center mt-2 opacity-80">{selected.alt}</p>
          </div>
        </div>
      )}
    </main>
  );
}

export default Gallery;
