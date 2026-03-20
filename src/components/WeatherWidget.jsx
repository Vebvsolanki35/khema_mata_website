import { useState, useEffect } from "react";

const OPEN_METEO_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=25.4358&longitude=75.6475&current_weather=true&hourly=relative_humidity_2m&timezone=Asia%2FKolkata";

function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(OPEN_METEO_URL, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Weather fetch failed");
        return res.json();
      })
      .then((data) => {
        const cw = data.current_weather;
        const hour = new Date(cw.time).getHours();
        const humidity = data.hourly?.relative_humidity_2m?.[hour] ?? "—";
        setWeather({
          temp: Math.round(cw.temperature),
          windspeed: Math.round(cw.windspeed),
          weathercode: cw.weathercode,
          humidity,
        });
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("मौसम जानकारी उपलब्ध नहीं");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const getIcon = (code) => {
    if (code === 0) return "☀️";
    if (code <= 3) return "⛅";
    if (code <= 67) return "🌧️";
    if (code <= 77) return "❄️";
    return "🌩️";
  };

  const getCondition = (code) => {
    if (code === 0) return "साफ आसमान";
    if (code <= 3) return "आंशिक बादल";
    if (code <= 48) return "धुंध / कोहरा";
    if (code <= 67) return "वर्षा";
    if (code <= 77) return "हिमपात";
    return "तूफान";
  };

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
        style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#FFF8F0" }}
      >
        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        <span>मौसम लोड हो रहा है…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm opacity-70"
        style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#FFF8F0" }}
      >
        🌡️ {error}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#FFF8F0" }}
      title={`बूंदी, राजस्थान – ${getCondition(weather.weathercode)}`}
    >
      <span className="text-2xl">{getIcon(weather.weathercode)}</span>
      <div>
        <div className="font-bold text-lg leading-none" style={{ color: "var(--gold)" }}>
          {weather.temp}°C
        </div>
        <div className="text-xs opacity-80 mt-0.5">
          💨 {weather.windspeed} km/h · 💧 {weather.humidity}%
        </div>
      </div>
      <div className="text-xs leading-tight opacity-90 hidden sm:block">
        <div className="font-semibold">{getCondition(weather.weathercode)}</div>
        <div className="opacity-70">बूंदी, राजस्थान</div>
      </div>
    </div>
  );
}

export default WeatherWidget;
