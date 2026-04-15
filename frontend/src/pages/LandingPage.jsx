import React, { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useNavigate } from "react-router-dom";
import { Sparkles, Brain, ArrowRight, Search } from "lucide-react";
import Globe3D from "../components/Globe3D";
import { CITY_NAMES } from "../utils/destinations";

const LandingPage = () => {
  const navigate = useNavigate();
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [zoomToDestination, setZoomToDestination] = useState(null);
  const [isInspirationMode, setIsInspirationMode] = useState(false);
  const [showInspirationModal, setShowInspirationModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [inspirationCriteria, setInspirationCriteria] = useState({
    weather: "",
    temperature: "",
    budget: "",
    activities: [],
  });

  const handleCountryClick = (countryName) => {
    setSelectedCountry(countryName);
    setZoomToDestination(countryName);
    setSearchQuery(countryName);
  };

  const handleExplore = () => {
    navigate("/home");
  };

  const handleSearchSelect = (destination) => {
    setSearchQuery(destination);
    setShowSuggestions(false);
    setZoomToDestination(destination);
  };

  const handleZoomComplete = () => {
    // Afficher la modale de confirmation au lieu de rediriger directement
    setShowConfirmationModal(true);
  };

  const handleConfirmNavigation = () => {
    navigate("/home", { state: { destination: searchQuery } });
  };

  const handleCancelNavigation = () => {
    setShowConfirmationModal(false);
    setZoomToDestination(null);
    setSearchQuery("");
    setSelectedCountry(null);
  };

  const handleInspirationMode = () => {
    setShowInspirationModal(true);
  };

  const handleInspirationSubmit = async () => {
    setShowInspirationModal(false);
    setIsInspirationMode(true);

    try {
      // Appel API avec les critères météo
      const response = await fetch("http://localhost:3000/api/inspiration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inspirationCriteria),
      });

      const data = await response.json();

      if (data.success && data.destinations.length > 0) {
        // Sélectionner la première destination suggérée
        const suggestedCity = data.destinations[0].city;
        setSearchQuery(suggestedCity);
        setZoomToDestination(suggestedCity);
      } else {
        // Fallback si aucune destination trouvée
        const randomDestination =
          CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)];
        setSearchQuery(randomDestination);
        setZoomToDestination(randomDestination);
      }
    } catch (error) {
      console.error("Erreur API inspiration:", error);
      // Fallback en cas d'erreur
      const randomDestination =
        CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)];
      setSearchQuery(randomDestination);
      setZoomToDestination(randomDestination);
    } finally {
      setIsInspirationMode(false);
    }
  };

  const filteredDestinations = CITY_NAMES.filter((dest) =>
    dest.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-b from-black via-gray-900 to-black">
      {/* Canvas Three.js avec le globe 3D */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 8], fov: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
        >
          <Suspense fallback={null}>
            <Globe3D
              onCountryClick={handleCountryClick}
              zoomToDestination={zoomToDestination}
              onZoomComplete={handleZoomComplete}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Notification de sélection de pays */}
      {selectedCountry && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-30 bg-primary-600 text-white px-6 py-3 rounded-full shadow-2xl animate-bounce">
          <span className="font-semibold">
            🌍 {selectedCountry} sélectionné !
          </span>
        </div>
      )}

      {/* Overlay gradient subtil pour améliorer la lisibilité */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70 pointer-events-none z-10" />

      {/* Logo et Stats en haut à gauche */}
      <div className="absolute top-8 left-8 z-20 space-y-6">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-primary-500 to-purple-600 p-3 rounded-xl shadow-2xl">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              SMART TRIP
            </h1>
            <p className="text-sm text-gray-300 tracking-wide">Powered by AI</p>
          </div>
        </div>

        {/* Stats déplacées ici */}
        <div className="flex gap-6">
          <div className="text-left space-y-1">
            <div className="text-2xl font-bold text-primary-400">500+</div>
            <div className="text-gray-400 text-xs">Compagnies</div>
          </div>
          <div className="text-left space-y-1">
            <div className="text-2xl font-bold text-purple-400">1M+</div>
            <div className="text-gray-400 text-xs">Vols/jour</div>
          </div>
          <div className="text-left space-y-1">
            <div className="text-2xl font-bold text-pink-400">98%</div>
            <div className="text-gray-400 text-xs">Satisfaction</div>
          </div>
        </div>
      </div>

      {/* Barre de recherche en haut à droite */}
      <div className="absolute top-8 right-8 z-20 w-96">
        <div className="space-y-4">
          {/* Slogan */}
          <p className="text-gray-300 text-sm font-light italic text-right">
            "Voyagez intelligent,{" "}
            <span className="text-primary-400 font-semibold">
              voyagez avec nous"
            </span>
          </p>

          {/* Bouton Mode Inspiration */}
          <button
            onClick={() => navigate('/inspiration')}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <Brain className="h-5 w-5" />
            <span>Mode Inspiration</span>
          </button>

          {/* Barre de recherche avec suggestions */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
            <input
              type="text"
              placeholder="Rechercher une destination..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(e.target.value.length > 0);
              }}
              onFocus={() => searchQuery && setShowSuggestions(true)}
              className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
            {/* Suggestions dropdown */}
            {showSuggestions && filteredDestinations.length > 0 && (
              <div className="absolute top-full mt-2 w-full max-h-80 overflow-y-auto bg-gray-900/95 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl">
                {filteredDestinations.map((dest) => (
                  <button
                    key={dest}
                    onClick={() => handleSearchSelect(dest)}
                    className="w-full text-left px-4 py-3 text-white hover:bg-primary-600/50 transition-colors border-b border-white/10 last:border-b-0"
                  >
                    {dest}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bouton CTA en bas de page */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-12">
        <div className="text-center">
          <button
            onClick={handleExplore}
            className="group relative inline-flex items-center space-x-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-semibold text-lg px-10 py-5 rounded-full shadow-2xl hover:shadow-primary-500/50 transition-all duration-300 transform hover:scale-105"
          >
            <span>Commencer l'exploration</span>
            <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />

            {/* Effet de brillance */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </button>
        </div>
      </div>

      {/* Modal Mode Inspiration */}
      {showInspirationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/20 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Brain className="h-6 w-6 text-purple-400" />
                Mode Inspiration
              </h2>
              <button
                onClick={() => setShowInspirationModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-6">
              Décrivez vos préférences et laissez l'IA vous suggérer la
              destination parfaite
            </p>

            <div className="space-y-4">
              {/* Météo préférée */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Météo souhaitée
                </label>
                <select
                  value={inspirationCriteria.weather}
                  onChange={(e) =>
                    setInspirationCriteria({
                      ...inspirationCriteria,
                      weather: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Peu importe</option>
                  <option value="sunny">Ensoleillé ☀️</option>
                  <option value="mild">Doux 🌤️</option>
                  <option value="cold">Froid ❄️</option>
                </select>
              </div>

              {/* Température */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Température
                </label>
                <select
                  value={inspirationCriteria.temperature}
                  onChange={(e) =>
                    setInspirationCriteria({
                      ...inspirationCriteria,
                      temperature: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Peu importe</option>
                  <option value="hot">Chaud (25°C+)</option>
                  <option value="warm">Tempéré (15-25°C)</option>
                  <option value="cool">Frais (5-15°C)</option>
                  <option value="cold">Froid (-5°C)</option>
                </select>
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Budget
                </label>
                <select
                  value={inspirationCriteria.budget}
                  onChange={(e) =>
                    setInspirationCriteria({
                      ...inspirationCriteria,
                      budget: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Peu importe</option>
                  <option value="low">Économique 💰</option>
                  <option value="medium">Moyen 💳</option>
                  <option value="high">Luxe 💎</option>
                </select>
              </div>

              {/* Type d'activités */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type d'activités
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Plage",
                    "Culture",
                    "Aventure",
                    "Gastronomie",
                    "Nature",
                    "Shopping",
                  ].map((activity) => (
                    <button
                      key={activity}
                      onClick={() => {
                        const activities =
                          inspirationCriteria.activities.includes(activity)
                            ? inspirationCriteria.activities.filter(
                                (a) => a !== activity
                              )
                            : [...inspirationCriteria.activities, activity];
                        setInspirationCriteria({
                          ...inspirationCriteria,
                          activities,
                        });
                      }}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        inspirationCriteria.activities.includes(activity)
                          ? "bg-primary-600 text-white"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      {activity}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowInspirationModal(false)}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleInspirationSubmit}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-lg transition-all transform hover:scale-105"
              >
                Trouver ma destination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation de navigation */}
      {showConfirmationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/20 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl transform transition-all scale-100">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-primary-600/20 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Destination trouvée !
              </h2>
              <p className="text-gray-300">
                Vous avez sélectionné{" "}
                <span className="font-bold text-primary-400">
                  {searchQuery}
                </span>
                . Souhaitez-vous voir les vols disponibles pour cette
                destination ?
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirmNavigation}
                className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2"
              >
                <span>Voir les vols disponibles</span>
                <ArrowRight className="h-5 w-5" />
              </button>

              <button
                onClick={handleCancelNavigation}
                className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Search className="h-4 w-4" />
                <span>Faire une autre recherche</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
