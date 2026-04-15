const express = require('express');
const router = express.Router();
const { filterDestinationsByWeather } = require('../services/weather.service');
const { DESTINATIONS } = require('../utils/destinations');

/**
 * POST /api/inspiration
 * Retourne des suggestions de destinations basées sur les critères météo + filtres
 *
 * Body : { origin, departureDate, weather, temperature, humidity, wind, budget, activities }
 *
 * Valeurs attendues (alignées avec l'app Android) :
 *   weather     : 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy'
 *   temperature : 'tropical' | 'hot' | 'mild' | 'cool' | 'cold'
 *   humidity    : 'dry' | 'normal' | 'humid'
 *   wind        : 'calm' | 'moderate' | 'windy'
 *   budget      : '200' | '500' | '1000' | '2000'  (valeur max en €)
 */
router.post('/', async (req, res) => {
  try {
    const { weather, temperature, humidity, wind, budget } = req.body;

    // 1. Filtrage météo + température côté backend
    const weatherCriteria = { weather, temperature };
    let filteredDestinations = await filterDestinationsByWeather(DESTINATIONS, weatherCriteria);

    // 2. Filtrage humidité
    if (humidity) {
      filteredDestinations = filteredDestinations.filter(dest => {
        const h = dest.weather?.humidity;
        if (h == null) return true;
        switch (humidity) {
          case 'dry':    return h < 40;
          case 'normal': return h >= 40 && h <= 70;
          case 'humid':  return h > 70;
          default: return true;
        }
      });
    }

    // 3. Filtrage vent (windSpeed en m/s → km/h = * 3.6)
    if (wind) {
      filteredDestinations = filteredDestinations.filter(dest => {
        const wKmh = (dest.weather?.windSpeed ?? 0) * 3.6;
        switch (wind) {
          case 'calm':     return wKmh < 10;
          case 'moderate': return wKmh >= 10 && wKmh <= 30;
          case 'windy':    return wKmh > 30;
          default: return true;
        }
      });
    }

    // 4. Ajout d'un prix estimatif basé sur la distance (Paris = référence)
    const PARIS_LAT = 48.8566, PARIS_LON = 2.3522;
    const BASE_PRICE = 80; // base €
    const PRICE_PER_KM = 0.065;
    const toRad = d => d * Math.PI / 180;
    const haversine = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    filteredDestinations = filteredDestinations.map(dest => {
      const dist = haversine(PARIS_LAT, PARIS_LON, dest.lat, dest.lon);
      const rawPrice = BASE_PRICE + dist * PRICE_PER_KM;
      // Varier légèrement le prix pour le réalisme
      const jitter = 0.85 + Math.random() * 0.30;
      const minPrice = Math.round(rawPrice * jitter);
      return { ...dest, minPrice };
    });

    // 5. Filtrage budget
    if (budget) {
      const maxBudget = parseInt(budget, 10);
      if (!isNaN(maxBudget)) {
        filteredDestinations = filteredDestinations.filter(dest => dest.minPrice <= maxBudget);
      }
    }

    res.json({
      success: true,
      destinations: filteredDestinations.slice(0, 10),
      count: filteredDestinations.length
    });
  } catch (error) {
    console.error('Erreur route inspiration:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche de destinations',
      error: error.message
    });
  }
});

module.exports = router;
