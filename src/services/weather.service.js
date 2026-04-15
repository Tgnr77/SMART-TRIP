const axios = require('axios');

const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Récupérer la météo actuelle d'une ville
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise} Données météo
 */
const getCurrentWeather = async (lat, lon) => {
  try {
    const response = await axios.get(`${BASE_URL}/weather`, {
      params: {
        lat,
        lon,
        appid: API_KEY,
        units: 'metric', // Pour Celsius
        lang: 'fr'
      }
    });

    return {
      temperature: response.data.main.temp,
      feelsLike: response.data.main.feels_like,
      humidity: response.data.main.humidity,
      description: response.data.weather[0].description,
      icon: response.data.weather[0].icon,
      windSpeed: response.data.wind.speed,
      weatherType: response.data.weather[0].main // Clear, Clouds, Rain, etc.
    };
  } catch (error) {
    console.error('Erreur récupération météo:', error.message);
    throw error;
  }
};

/**
 * Filtrer les destinations selon les critères météo
 * @param {Array} destinations - Liste des destinations avec lat/lon
 * @param {Object} criteria - Critères de filtrage (weather, temperature)
 * @returns {Promise<Array>} Destinations filtrées avec données météo
 *
 * Valeurs attendues (alignées avec l'app Android) :
 *   weather     : 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy'
 *   temperature : 'tropical' | 'hot' | 'mild' | 'cool' | 'cold'
 */
const filterDestinationsByWeather = async (destinations, criteria) => {
  // Limiter à 50 destinations pour obtenir plus de variété
  const sample = destinations.sort(() => 0.5 - Math.random()).slice(0, 50);
  
  const weatherPromises = sample.map(async (dest) => {
    try {
      const weather = await getCurrentWeather(dest.lat, dest.lon);
      return { ...dest, weather };
    } catch (error) {
      console.error(`Erreur météo pour ${dest.city}:`, error.message);
      return null;
    }
  });

  const destinationsWithWeather = (await Promise.all(weatherPromises))
    .filter(d => d !== null);

  // Si aucun critère, retourner toutes les destinations
  if (!criteria.weather && !criteria.temperature) {
    return destinationsWithWeather;
  }

  return destinationsWithWeather.filter(dest => {
    const { weather } = dest;

    // ── Filtre météo — valeurs alignées avec l'app Android ───────────────
    if (criteria.weather) {
      const wType = weather.weatherType; // Clear, Clouds, Rain, Drizzle, Snow, Thunderstorm…
      switch (criteria.weather) {
        case 'sunny':
          // Clair ou légèrement nuageux
          if (!['Clear', 'Clouds'].includes(wType)) return false;
          if (wType === 'Clouds' && weather.description && weather.description.toLowerCase().includes('convert')) return false;
          break;
        case 'cloudy':
          if (!['Clouds', 'Mist', 'Fog', 'Haze', 'Dust', 'Sand', 'Smoke'].includes(wType)) return false;
          break;
        case 'rainy':
          if (!['Rain', 'Drizzle', 'Squall'].includes(wType)) return false;
          break;
        case 'snowy':
          if (wType !== 'Snow') return false;
          break;
        case 'stormy':
          if (!['Thunderstorm', 'Tornado'].includes(wType)) return false;
          break;
      }
    }

    // ── Filtre température — valeurs alignées avec l'app Android ─────────
    if (criteria.temperature) {
      const t = weather.temperature;
      switch (criteria.temperature) {
        case 'tropical': if (t < 28) return false; break;
        case 'hot':      if (t < 20 || t >= 28) return false; break;
        case 'mild':     if (t < 12 || t >= 20) return false; break;
        case 'cool':     if (t < 5  || t >= 12) return false; break;
        case 'cold':     if (t >= 5) return false; break;
      }
    }

    return true;
  });
};

module.exports = {
  getCurrentWeather,
  filterDestinationsByWeather
};
