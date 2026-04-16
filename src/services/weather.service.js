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
 * @param {Object} criteria - Critères de filtrage issus de l'API OpenWeatherMap
 *   weather     : 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy' | ''
 *   temperature : 'tropical' | 'hot' | 'mild' | 'cool' | 'cold' | ''
 *   humidity    : 'dry' | 'normal' | 'humid' | ''
 *   wind        : 'calm' | 'moderate' | 'windy' | ''
 * @returns {Promise<Array>} Destinations filtrées avec les données météo
 */
/**
 * Calcule un score de correspondance pour une destination selon les critères
 * Retourne un nombre entre 0 et 4 (un point par critère satisfait)
 */
function scoreDestination(dest, criteria) {
  const { weather } = dest;
  let score = 0;
  let total = 0;

  if (criteria.weather) {
    total++;
    const wt = weather.weatherType;
    const t  = weather.temperature;
    const cloudyTypes  = ['Clouds', 'Mist', 'Fog', 'Dust', 'Sand', 'Ash', 'Squall'];
    const rainyTypes   = ['Rain', 'Drizzle'];
    const snowyTypes   = ['Snow'];
    const stormyTypes  = ['Thunderstorm'];
    // 'sunny' = ciel dégagé ET température confortable (≥ 16°C)
    // évite de retourner Paris en hiver avec ciel clair mais 4°C
    if (criteria.weather === 'sunny'  && ['Clear', 'Haze', 'Smoke'].includes(wt) && t >= 16) score++;
    if (criteria.weather === 'cloudy' && cloudyTypes.includes(wt)) score++;
    if (criteria.weather === 'rainy'  && rainyTypes.includes(wt))  score++;
    if (criteria.weather === 'snowy'  && snowyTypes.includes(wt))  score++;
    if (criteria.weather === 'stormy' && stormyTypes.includes(wt)) score++;
  }

  if (criteria.temperature) {
    total++;
    const t = weather.temperature;
    if (criteria.temperature === 'tropical' && t >= 28)                score++;
    if (criteria.temperature === 'hot'      && t >= 20 && t < 28)      score++;
    if (criteria.temperature === 'mild'     && t >= 12 && t < 20)      score++;
    if (criteria.temperature === 'cool'     && t >= 5  && t < 12)      score++;
    if (criteria.temperature === 'cold'     && t < 5)                  score++;
  }

  if (criteria.humidity) {
    total++;
    const h = weather.humidity;
    if (criteria.humidity === 'dry'    && h < 40)          score++;
    if (criteria.humidity === 'normal' && h >= 40 && h <= 70) score++;
    if (criteria.humidity === 'humid'  && h > 70)          score++;
  }

  if (criteria.wind) {
    total++;
    const kmh = weather.windSpeed * 3.6;
    if (criteria.wind === 'calm'     && kmh < 10)            score++;
    if (criteria.wind === 'moderate' && kmh >= 10 && kmh < 30) score++;
    if (criteria.wind === 'windy'    && kmh >= 30)           score++;
  }

  return { score, total };
}

const filterDestinationsByWeather = async (destinations, criteria) => {
  // Shuffler toutes les destinations pour la variété (pas de troncature)
  const shuffled = [...destinations].sort(() => 0.5 - Math.random());

  // Récupérer la météo pour toutes les destinations en parallèle
  const weatherPromises = shuffled.map(async (dest) => {
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

  // Si aucun critère, retourner toutes les destinations mélangées
  const hasAnyCriteria = criteria.weather || criteria.temperature ||
                         criteria.humidity || criteria.wind;
  if (!hasAnyCriteria) return destinationsWithWeather;

  // Scorer chaque destination et trier par score décroissant
  const scored = destinationsWithWeather.map(dest => {
    const { score, total } = scoreDestination(dest, criteria);
    return { ...dest, _score: score, _total: total };
  }).sort((a, b) => b._score - a._score);

  // Garder uniquement les destinations qui matchent TOUS les critères actifs
  const perfectMatches = scored.filter(d => d._score === d._total && d._total > 0);

  // Si suffisamment de résultats parfaits (≥ 5), les retourner
  if (perfectMatches.length >= 5) {
    return perfectMatches.map(({ _score, _total, ...d }) => d);
  }

  // Sinon : retourner les meilleurs scores disponibles (au moins score > 0 si possible)
  const partialMatches = scored.filter(d => d._score > 0);
  const fallback = partialMatches.length >= 3 ? partialMatches : scored;

  return fallback.slice(0, 15).map(({ _score, _total, ...d }) => d);
};

module.exports = {
  getCurrentWeather,
  filterDestinationsByWeather
};
