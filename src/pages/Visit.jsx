import { useLanguage } from "../context/LanguageContext";

function Visit() {
  const { t } = useLanguage();
  const v = t.visit;

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl md:text-4xl font-bold text-orange-700 text-center mb-10">
        🗺️ {v.title}
      </h1>

      {/* Google Maps Embed */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-orange-600 mb-4">
          📍 {v.mapTitle}
        </h2>
        <div className="rounded-2xl overflow-hidden shadow-lg border border-orange-200">
          <iframe
            title="Khemaj Mata Temple Location"
            src="https://maps.google.com/maps?q=25.6769,75.9398&z=15&output=embed"
            width="100%"
            height="400"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>

      {/* Routes */}
      <section>
        <h2 className="text-xl font-semibold text-orange-600 mb-6">
          🛣️ {v.routesTitle}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {v.routes.map((route, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl shadow p-5 border-l-4 border-orange-400"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">🚗</span>
                <h3 className="font-bold text-gray-800">{route.from}</h3>
              </div>
              <p className="text-orange-600 font-semibold text-sm mb-2">
                {route.distance}
              </p>
              <p className="text-gray-600 text-sm leading-relaxed">{route.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default Visit;
