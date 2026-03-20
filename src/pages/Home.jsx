import { useLanguage } from "../context/LanguageContext";

function Home() {
  const { t } = useLanguage();

  return (
    <main>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-orange-500 via-amber-400 to-yellow-300 text-white py-20 px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-3 drop-shadow-md">
          {t.hero.title}
        </h1>
        <p className="text-xl md:text-2xl font-medium mb-4 opacity-90">
          {t.hero.subtitle}
        </p>
        <p className="max-w-xl mx-auto text-base md:text-lg mb-8 opacity-85">
          {t.hero.description}
        </p>
        <a
          href="/visit"
          className="inline-block bg-white text-orange-600 font-bold px-8 py-3 rounded-full shadow-lg hover:bg-orange-50 transition-colors"
        >
          {t.hero.cta}
        </a>
      </section>

      {/* Darshan Timings Card */}
      <section className="py-12 px-4 bg-amber-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-orange-700 text-center mb-8">
            🕐 {t.darshan.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow p-6 border-l-4 border-orange-400 text-center">
              <div className="text-4xl mb-2">🌅</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-1">
                {t.darshan.morning}
              </h3>
              <p className="text-orange-600 text-xl font-bold">
                {t.darshan.morningTime}
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow p-6 border-l-4 border-amber-500 text-center">
              <div className="text-4xl mb-2">🌇</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-1">
                {t.darshan.evening}
              </h3>
              <p className="text-amber-600 text-xl font-bold">
                {t.darshan.eveningTime}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* History Summary */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-orange-700 mb-6">
            📜 {t.history.title}
          </h2>
          <p className="text-gray-700 text-base md:text-lg leading-relaxed">
            {t.history.summary}
          </p>
          <a
            href="/temple"
            className="inline-block mt-6 text-orange-600 font-semibold underline hover:text-orange-800 transition-colors"
          >
            {t.nav.temple} →
          </a>
        </div>
      </section>
    </main>
  );
}

export default Home;
