import React, { Suspense, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Sparkles, Thermometer, Wind, Droplets, Sun,
  Cloud, CloudRain, CloudSnow, Zap, MapPin, Plane, Loader2,
  ChevronRight, RefreshCw, Globe, X, Search
} from "lucide-react";
import Globe3D from "../components/Globe3D";
import { DESTINATIONS, CITY_NAMES } from "../utils/destinations";

// ─── Constantes des critères ────────────────────────────────────────────────
const WEATHER_OPTIONS = [
  { value: "",           label: "Peu importe",   icon: Globe,       color: "text-gray-400" },
  { value: "sunny",      label: "Ensoleillé",    icon: Sun,         color: "text-yellow-400" },
  { value: "cloudy",     label: "Nuageux",       icon: Cloud,       color: "text-blue-300" },
  { value: "rainy",      label: "Pluvieux",      icon: CloudRain,   color: "text-blue-500" },
  { value: "snowy",      label: "Enneigé",       icon: CloudSnow,   color: "text-cyan-300" },
  { value: "stormy",     label: "Orageux",       icon: Zap,         color: "text-purple-400" },
];

const TEMP_OPTIONS = [
  { value: "",       label: "Peu importe",   range: "",           color: "text-gray-400" },
  { value: "tropical", label: "Tropical",   range: "> 28 °C",    color: "text-red-400" },
  { value: "hot",    label: "Chaud",         range: "20 – 28 °C", color: "text-orange-400" },
  { value: "mild",   label: "Doux",          range: "12 – 20 °C", color: "text-green-400" },
  { value: "cool",   label: "Frais",         range: "5 – 12 °C",  color: "text-blue-300" },
  { value: "cold",   label: "Froid",         range: "< 5 °C",     color: "text-cyan-400" },
];

const HUMIDITY_OPTIONS = [
  { value: "",       label: "Peu importe", desc: "",         color: "text-gray-400" },
  { value: "dry",    label: "Sèche",       desc: "< 40 %",  color: "text-yellow-300" },
  { value: "normal", label: "Normale",     desc: "40–70 %", color: "text-green-300" },
  { value: "humid",  label: "Humide",      desc: "> 70 %",  color: "text-blue-400" },
];

const WIND_OPTIONS = [
  { value: "",         label: "Peu importe", desc: "",            color: "text-gray-400" },
  { value: "calm",     label: "Calme",       desc: "< 10 km/h",  color: "text-green-300" },
  { value: "moderate", label: "Modéré",      desc: "10–30 km/h", color: "text-yellow-300" },
  { value: "windy",    label: "Venteux",     desc: "> 30 km/h",  color: "text-red-300" },
];

// ─── Chip de sélection ───────────────────────────────────────────────────────
const Chip = ({ selected, onClick, children, colorClass }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border
      ${selected
        ? "bg-white/20 border-white/60 text-white shadow-inner"
        : "bg-white/5 border-white/15 text-gray-400 hover:bg-white/10 hover:text-white"
      } ${colorClass ?? ""}`}
  >
    {children}
  </button>
);

// ─── Icône météo depuis code OWM ─────────────────────────────────────────────
const WeatherIcon = ({ icon, description }) =>
  icon ? (
    <img
      src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
      alt={description}
      className="w-10 h-10 -my-1"
    />
  ) : null;

// ─── Carte d'une destination suggérée ───────────────────────────────────────
const DestCard = ({ dest, isSelected, isTop, onSelect }) => {
  const w = dest.weather;
  return (
    <div
      onClick={() => onSelect(dest.city)}
      className={`relative cursor-pointer rounded-xl p-3 transition-all border
        ${isSelected
          ? "bg-white/20 border-white/50 shadow-lg shadow-white/10"
          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30"
        }`}
    >
      {isTop && (
        <span className="absolute -top-2 left-3 text-[10px] font-bold bg-amber-400 text-black px-2 py-0.5 rounded-full">
          ★ Top match
        </span>
      )}
      <div className="flex items-start gap-2 mt-1">
        {/* Code aéroport */}
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center">
          <span className="text-white text-xs font-bold">{dest.code}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{dest.city}</p>
          <p className="text-gray-400 text-xs truncate">{dest.country}</p>
          {w && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-orange-300 text-xs font-bold">{Math.round(w.temperature)}°C</span>
              <span className="text-gray-400 text-xs capitalize">{w.description}</span>
            </div>
          )}
        </div>
        {w && <WeatherIcon icon={w.icon} description={w.description} />}
      </div>
      {w && (
        <div className="flex gap-3 mt-2 pt-2 border-t border-white/10">
          <div className="flex items-center gap-1 text-xs text-blue-300">
            <Droplets className="w-3 h-3" /> {w.humidity}%
          </div>
          <div className="flex items-center gap-1 text-xs text-cyan-300">
            <Wind className="w-3 h-3" /> {Math.round(w.windSpeed * 3.6)} km/h
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Thermometer className="w-3 h-3" /> {Math.round(w.feelsLike)}°C ressenti
          </div>
        </div>
      )}
      {isSelected && (
        <div className="mt-2 flex items-center justify-end gap-1 text-xs text-indigo-300 font-medium">
          <MapPin className="w-3 h-3" /> Sélectionné
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
export default function InspirationGlobePage() {
  const navigate = useNavigate();

  // Filtres météo
  const [weather, setWeather] = useState("");
  const [temperature, setTemperature] = useState("");
  const [humidity, setHumidity] = useState("");
  const [wind, setWind] = useState("");

  // États de la page
  const [phase, setPhase] = useState("idle"); // idle | searching | results | zoomedIn
  const [results, setResults] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [zoomTarget, setZoomTarget] = useState(null);
  const [error, setError] = useState(null);

  // Recherche manuelle (clic globe ou barre)
  const [manualQuery, setManualQuery] = useState("");
  const [manualSuggestions, setManualSuggestions] = useState([]);
  const [showManual, setShowManual] = useState(false);

  // ─── Recherche inspiration ─────────────────────────────────────────────
  const handleSearch = async () => {
    setError(null);
    setPhase("searching");
    setResults([]);
    setSelectedCity(null);
    setZoomTarget(null);

    try {
      const res = await fetch("http://localhost:3000/api/inspiration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weather, temperature, humidity, wind }),
      });
      const data = await res.json();

      if (!data.success || !data.destinations?.length) {
        setError("Aucune destination ne correspond à ces critères. Essaie d'assouplir les filtres !");
        setPhase("idle");
        return;
      }

      setResults(data.destinations);
      setPhase("results");

      // Zoom automatique sur le top résultat
      const top = data.destinations[0];
      setSelectedCity(top.city);
      setZoomTarget(top.city);
    } catch (e) {
      console.error(e);
      setError("Erreur de connexion au serveur.");
      setPhase("idle");
    }
  };

  // ─── Sélection d'une destination depuis la liste ───────────────────────
  const handleSelectCity = useCallback((city) => {
    setSelectedCity(city);
    setZoomTarget(city);
    setPhase("zoomedIn");
  }, []);

  // ─── Clic sur un marqueur du globe ────────────────────────────────────
  const handleGlobeClick = useCallback((city) => {
    setSelectedCity(city);
    setZoomTarget(city);
    if (phase === "results") setPhase("zoomedIn");
  }, [phase]);

  // ─── Zoom terminé ─────────────────────────────────────────────────────
  const handleZoomComplete = useCallback(() => {
    if (phase !== "results") setPhase("zoomedIn");
  }, [phase]);

  // ─── Recherche manuelle ───────────────────────────────────────────────
  const handleManualInput = (val) => {
    setManualQuery(val);
    if (val.length >= 1) {
      setManualSuggestions(
        CITY_NAMES.filter((c) => c.toLowerCase().includes(val.toLowerCase())).slice(0, 6)
      );
      setShowManual(true);
    } else {
      setShowManual(false);
    }
  };

  const handleManualSelect = (city) => {
    setManualQuery(city);
    setShowManual(false);
    setSelectedCity(city);
    setZoomTarget(city);
    if (phase === "idle") setPhase("zoomedIn");
  };

  // ─── Destination sélectionnée ─────────────────────────────────────────
  const selectedDest = results.find((d) => d.city === selectedCity)
    || DESTINATIONS.find((d) => d.city === selectedCity);

  // ─── Marqueurs à mettre en évidence ──────────────────────────────────
  const highlighted = results.map((d, i) => ({ city: d.city, isTop: i === 0 }));

  // ─── Lancer la recherche de vols ─────────────────────────────────────
  const handleBookFlight = () => {
    if (!selectedDest) return;
    const today = new Date();
    const dep = new Date(today);
    dep.setDate(dep.getDate() + 30);
    const ret = new Date(dep);
    ret.setDate(ret.getDate() + 7);
    navigate(
      `/home?destination=${selectedDest.code}&destinationCity=${selectedDest.city}&departureDate=${dep.toISOString().split("T")[0]}`
    );
  };

  // ─── Réinitialiser ────────────────────────────────────────────────────
  const handleReset = () => {
    setPhase("idle");
    setResults([]);
    setSelectedCity(null);
    setZoomTarget(null);
    setError(null);
    setManualQuery("");
    setShowManual(false);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">

      {/* ══ Globe Three.js ══════════════════════════════════════════════ */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 8], fov: 50 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        >
          <Suspense fallback={null}>
            <Globe3D
              onCountryClick={handleGlobeClick}
              inspirationMode={phase === "searching"}
              zoomToDestination={zoomTarget}
              onZoomComplete={handleZoomComplete}
              highlightedDestinations={highlighted}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* ══ Barre de navigation supérieure ══════════════════════════════ */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <button
          onClick={() => navigate(-1)}
          className="pointer-events-auto flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 py-2 rounded-full text-sm transition-all backdrop-blur-md"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <span className="text-white font-bold text-lg tracking-wide">Mode Inspiration</span>
        </div>

        {/* Barre de recherche manuelle */}
        <div className="pointer-events-auto relative">
          <div className="flex items-center bg-white/10 border border-white/20 rounded-full px-3 py-2 gap-2 backdrop-blur-md">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={manualQuery}
              onChange={(e) => handleManualInput(e.target.value)}
              placeholder="Destination manuelle..."
              className="bg-transparent text-white text-sm placeholder-gray-400 outline-none w-40"
            />
            {manualQuery && (
              <button onClick={() => { setManualQuery(""); setShowManual(false); }}>
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>
          {showManual && manualSuggestions.length > 0 && (
            <div className="absolute right-0 top-full mt-1 bg-gray-900/95 border border-white/20 rounded-xl overflow-hidden shadow-xl w-52 backdrop-blur-xl z-30">
              {manualSuggestions.map((city) => (
                <button
                  key={city}
                  onClick={() => handleManualSelect(city)}
                  className="w-full text-left px-4 py-2 text-white text-sm hover:bg-white/10 flex items-center gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" /> {city}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ Panneau gauche : Filtres ════════════════════════════════════ */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-68">
        <div className="bg-black/60 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl w-64">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-white font-semibold text-sm">Critères météo</span>
          </div>

          {/* Météo */}
          <div className="mb-3">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Cloud className="w-3 h-3" /> Conditions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {WEATHER_OPTIONS.map((o) => {
                const Icon = o.icon;
                return (
                  <Chip key={o.value} selected={weather === o.value} onClick={() => setWeather(o.value)}>
                    <Icon className={`inline w-3 h-3 mr-1 ${o.color}`} />
                    {o.label}
                  </Chip>
                );
              })}
            </div>
          </div>

          {/* Température */}
          <div className="mb-3">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Thermometer className="w-3 h-3" /> Température
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TEMP_OPTIONS.map((o) => (
                <Chip key={o.value} selected={temperature === o.value} onClick={() => setTemperature(o.value)}>
                  <span className={o.color}>{o.label}</span>
                  {o.range && <span className="text-gray-500 ml-1">{o.range}</span>}
                </Chip>
              ))}
            </div>
          </div>

          {/* Humidité */}
          <div className="mb-3">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Droplets className="w-3 h-3" /> Humidité
            </p>
            <div className="flex flex-wrap gap-1.5">
              {HUMIDITY_OPTIONS.map((o) => (
                <Chip key={o.value} selected={humidity === o.value} onClick={() => setHumidity(o.value)}>
                  <span className={o.color}>{o.label}</span>
                  {o.desc && <span className="text-gray-500 ml-1">{o.desc}</span>}
                </Chip>
              ))}
            </div>
          </div>

          {/* Vent */}
          <div className="mb-4">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Wind className="w-3 h-3" /> Vent
            </p>
            <div className="flex flex-wrap gap-1.5">
              {WIND_OPTIONS.map((o) => (
                <Chip key={o.value} selected={wind === o.value} onClick={() => setWind(o.value)}>
                  <span className={o.color}>{o.label}</span>
                  {o.desc && <span className="text-gray-500 ml-1">{o.desc}</span>}
                </Chip>
              ))}
            </div>
          </div>

          {/* Bouton recherche */}
          <button
            onClick={handleSearch}
            disabled={phase === "searching"}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg text-sm"
          >
            {phase === "searching" ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Trouver ma destination</>
            )}
          </button>

          {error && (
            <p className="mt-2 text-red-400 text-xs text-center">{error}</p>
          )}

          {(phase === "results" || phase === "zoomedIn") && (
            <button
              onClick={handleReset}
              className="w-full mt-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white text-xs py-2 rounded-xl flex items-center justify-center gap-1 transition-all"
            >
              <RefreshCw className="w-3 h-3" /> Nouvelle recherche
            </button>
          )}
        </div>

        {/* Légende des marqueurs */}
        {results.length > 0 && (
          <div className="mt-3 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 text-xs space-y-1">
            <div className="flex items-center gap-2 text-gray-400">
              <span className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" /> Top résultat
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <span className="w-3 h-3 rounded-full bg-cyan-400 flex-shrink-0" /> Destination suggérée
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <span className="w-3 h-3 rounded-full bg-pink-400 flex-shrink-0" /> Sélectionné
            </div>
          </div>
        )}
      </div>

      {/* ══ Panneau droit : Résultats ════════════════════════════════════ */}
      {results.length > 0 && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-72">
          <div className="bg-black/60 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-sm">{results.length} destinations trouvées</p>
                <p className="text-gray-400 text-xs">Météo en temps réel · Cliquez pour zoomer</p>
              </div>
              <button onClick={handleReset}>
                <X className="w-4 h-4 text-gray-500 hover:text-white transition-colors" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[55vh] p-3 space-y-2">
              {results.map((dest, i) => (
                <DestCard
                  key={dest.city}
                  dest={dest}
                  isSelected={selectedCity === dest.city}
                  isTop={i === 0}
                  onSelect={handleSelectCity}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ Bandeau bas : CTA réservation ═══════════════════════════════ */}
      {selectedCity && selectedDest && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-4">
          <div className="bg-black/70 backdrop-blur-xl border border-white/20 rounded-2xl px-5 py-4 shadow-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold">{selectedDest.city}</p>
                <p className="text-gray-400 text-xs">{selectedDest.country}
                  {selectedDest.weather && (
                    <span className="ml-2 text-orange-300 font-medium">
                      {Math.round(selectedDest.weather.temperature)}°C · {selectedDest.weather.description}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleBookFlight}
              className="flex-shrink-0 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg text-sm"
            >
              <Plane className="w-4 h-4" /> Rechercher des vols
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ══ Overlay de chargement ════════════════════════════════════════ */}
      {phase === "searching" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-full bg-purple-600/20 border-2 border-purple-500/50 flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7 text-purple-400 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-purple-400/30 animate-ping" />
            </div>
            <p className="text-white font-bold text-lg">Analyse météo mondiale…</p>
            <p className="text-gray-400 text-sm mt-1">Interrogation de {">"}50 destinations</p>
          </div>
        </div>
      )}
    </div>
  );
}
