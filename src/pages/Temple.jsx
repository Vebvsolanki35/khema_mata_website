import { useLanguage } from "../context/LanguageContext";

function Temple() {
  const { t } = useLanguage();
  const tp = t.temple;

  const timeline = [
    {
      year: "940 CE",
      label: tp.founded,
      desc: tp.foundedDesc,
      icon: "🏛️",
      color: "border-orange-400",
    },
    {
      year: "1094 CE",
      label: tp.renovated,
      desc: tp.renovatedDesc,
      icon: "🔨",
      color: "border-amber-500",
    },
    {
      year: "~1600s",
      label: tp.mughal,
      desc: tp.mughalDesc,
      icon: "🛡️",
      color: "border-yellow-500",
    },
  ];

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl md:text-4xl font-bold text-orange-700 text-center mb-10">
        🕌 {tp.title}
      </h1>

      {/* Timeline */}
      <section className="mb-12">
        <div className="relative border-l-4 border-orange-200 ml-4 pl-6 space-y-10">
          {timeline.map((item) => (
            <div key={item.year} className="relative">
              <span className="absolute -left-9 top-0 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {item.year}
              </span>
              <div className={`bg-white rounded-2xl shadow p-5 border-l-4 ${item.color}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{item.icon}</span>
                  <h3 className="text-lg font-bold text-orange-700">{item.label}</h3>
                </div>
                <p className="text-gray-700 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Solanki Kings List */}
      <section>
        <h2 className="text-2xl font-bold text-orange-700 mb-6 text-center">
          👑 {tp.kingsTitle}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tp.kings.map((king, idx) => (
            <div
              key={idx}
              className="bg-amber-50 rounded-xl border border-orange-200 p-4 flex items-center gap-3"
            >
              <span className="text-2xl">👑</span>
              <div>
                <p className="font-semibold text-gray-800">{king.name}</p>
                <p className="text-sm text-orange-600">{king.years}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default Temple;
