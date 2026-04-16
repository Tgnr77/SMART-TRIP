const express = require('express');
const router = express.Router();
const { filterDestinationsByWeather } = require('../services/weather.service');
const { DESTINATIONS } = require('../utils/destinations');
const { pool } = require('../database/connection');

/**
 * POST /api/inspiration
 * Critères acceptés :
 *   weather     : 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy' | ''
 *   temperature : 'tropical' | 'hot' | 'mild' | 'cool' | 'cold' | ''
 *   humidity    : 'dry' | 'normal' | 'humid' | ''
 *   wind        : 'calm' | 'moderate' | 'windy' | ''
 *   budget      : '' | '200' | '500' | '1000' | '2000'  (prix max en €)
 */
router.post('/', async (req, res) => {
  try {
    const { weather, temperature, humidity, wind, budget } = req.body;

    const weatherCriteria = { weather, temperature, humidity, wind };
    const suggestedDestinations = await filterDestinationsByWeather(
      DESTINATIONS,
      weatherCriteria
    );

    // Tri par température
    let sorted = suggestedDestinations;
    if (temperature === 'tropical' || temperature === 'hot') {
      sorted = suggestedDestinations.sort((a, b) =>
        (b.weather?.temperature ?? 0) - (a.weather?.temperature ?? 0)
      );
    } else if (temperature === 'cold' || temperature === 'cool') {
      sorted = suggestedDestinations.sort((a, b) =>
        (a.weather?.temperature ?? 0) - (b.weather?.temperature ?? 0)
      );
    }

    const slice = sorted.slice(0, 15);

    // ── Enrichir avec les prix réels depuis trending_destinations ────────────
    let priceMap = {};
    try {
      const cityNames = slice.map(d => d.city);
      const priceRows = await pool.query(
        `SELECT DISTINCT ON (city) city, COALESCE(min_price, average_price) AS price
         FROM trending_destinations
         WHERE city = ANY($1)
         ORDER BY city, last_price_update DESC NULLS LAST`,
        [cityNames]
      );
      priceRows.rows.forEach(r => {
        if (r.price != null) priceMap[r.city] = Number(r.price);
      });
    } catch (_) { /* Prix non critiques, on continue */ }

    let destinations = slice.map(d => ({
      ...d,
      minPrice: priceMap[d.city] ?? null
    }));

    // ── Filtre budget : exclut les destinations dont le prix connu dépasse le max ──
    const maxBudget = budget ? parseInt(budget, 10) : null;
    if (maxBudget && !isNaN(maxBudget)) {
      destinations = destinations.filter(d => d.minPrice == null || d.minPrice <= maxBudget);
    }

    res.json({
      success: true,
      destinations,
      count: destinations.length,
      criteria: weatherCriteria
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

/**
 * GET /api/inspiration/surprise-trending
 * Retourne des destinations basées sur les tendances de recherche globales.
 * Si pas assez de données historiques, complète avec des destinations aléatoires.
 */
router.get('/surprise-trending', async (req, res) => {
  try {
    // Destinations les plus recherchées ces 90 derniers jours
    let trendRows = [];
    try {
      const trendResult = await pool.query(
        `SELECT destination_code as code, destination_city as city, COUNT(*) as search_count
         FROM user_search_history
         WHERE destination_code IS NOT NULL
           AND searched_at >= NOW() - INTERVAL '90 days'
         GROUP BY destination_code, destination_city
         ORDER BY search_count DESC
         LIMIT 20`
      );
      trendRows = trendResult.rows;
    } catch (_) {}

    // Mapper les codes trending vers les objets DESTINATIONS (avec lat/lon pour météo)
    const trendCodes = trendRows.map(r => r.code);
    let trendDests = DESTINATIONS.filter(d => trendCodes.includes(d.code));

    // Compléter avec des destinations populaires hardcodées si pas assez de données
    const popularFallback = ['DXB','BKK','JFK','BCN','NRT','SIN','SYD','MIA','RAK','DPS','CDG','IST','LHR','GRU','HND'];
    if (trendDests.length < 8) {
      const extras = DESTINATIONS.filter(
        d => popularFallback.includes(d.code) && !trendCodes.includes(d.code)
      ).slice(0, 12 - trendDests.length);
      trendDests = [...trendDests, ...extras];
    }

    // Mélanger légèrement pour éviter l'effet "toujours les mêmes en top"
    trendDests = trendDests.sort(() => 0.5 - Math.random());

    // Récupérer la météo pour ces destinations
    const withWeather = await filterDestinationsByWeather(trendDests, {});

    // Ajouter le score tendance à chaque destination
    const destinations = withWeather.slice(0, 8).map(d => ({
      ...d,
      trendScore: trendRows.find(t => t.code === d.code)?.search_count || 0,
      isTrending: trendCodes.includes(d.code)
    }));

    res.json({ success: true, destinations, count: destinations.length });
  } catch (error) {
    console.error('Erreur surprise-trending:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
