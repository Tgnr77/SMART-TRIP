const amadeusService = require("./amadeus.service");
const aiService = require("./ai.service");
const logger = require("../utils/logger");
const pool = require("../database/connection");

/**
 * Service d'agrégation intelligent de vols
 * Combine plusieurs sources et utilise l'IA pour recommander les meilleurs vols
 */
class FlightAggregatorService {
  /**
   * Recherche intelligente de vols
   * Agrège les résultats de plusieurs APIs et les score avec l'IA
   */
  async smartSearch(user, searchParams) {
    const startTime = Date.now();

    try {
      // 1. Rechercher uniquement sur Amadeus (API réelle)
      const userId = user?.id || "anonymous";
      logger.info(`Starting smart flight search for user ${userId}`);

      const amadeusResults = await amadeusService.searchFlights(searchParams);

      // 2. Combiner les résultats (uniquement Amadeus, pas de mock)
      const allFlights = amadeusResults || [];

      logger.info(`Found ${allFlights.length} flights from Amadeus`);

      // 2.1 Filtrer les compagnies de fret (non-passagers)
      const EXCLUDED_CARRIERS = ['6X']; // AmeriJet International (fret)
      const passengerFlights = allFlights.filter(flight => {
        const hasExcludedCarrier = 
          flight.outbound?.segments?.some(seg => EXCLUDED_CARRIERS.includes(seg.carrier)) ||
          flight.inbound?.segments?.some(seg => EXCLUDED_CARRIERS.includes(seg.carrier)) ||
          flight.validatingAirlineCodes?.some(code => EXCLUDED_CARRIERS.includes(code));
        
        return !hasExcludedCarrier;
      });

      logger.info(`Filtered to ${passengerFlights.length} passenger flights (excluded ${allFlights.length - passengerFlights.length} freight flights)`);

      if (passengerFlights.length === 0) {
        throw new Error("Aucun vol trouvé sur les sources disponibles");
      }

      // 3. Dédupliquer les vols similaires (désactivé temporairement pour garder tous les vols)
      // const uniqueFlights = this.deduplicateFlights(passengerFlights);
      const uniqueFlights = passengerFlights; // Garder tous les vols sans déduplication

      // 4. Scorer avec l'IA
      const scoredFlights = await aiService.scoreFlights(
        user,
        uniqueFlights,
        searchParams
      );

      // 5. Sauvegarder la recherche dans l'historique (seulement si user authentifié)
      if (user?.id) {
        await this.saveSearchHistory(
          user.id,
          searchParams,
          scoredFlights.length
        );
      }

      // 6. Sauvegarder les résultats en cache pour le suivi des prix
      await this.cacheFlightResults(searchParams, scoredFlights);

      // 7. Sauvegarder dans price_history pour les prédictions ML
      await this.savePriceHistory(searchParams, scoredFlights);

      const duration = Date.now() - startTime;
      logger.info(
        `Smart search completed in ${duration}ms, returning ${scoredFlights.length} flights`
      );

      return {
        flights: scoredFlights,
        meta: {
          totalResults: scoredFlights.length,
          sources: ["amadeus"],
          searchTime: duration,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error("Smart search error:", error.message);
      throw error;
    }
  }

  /**
   * Rechercher avec comparaison multi-pays (VPN)
   * Utilise différentes géolocalisations pour trouver les meilleurs prix
   */
  async searchWithVPN(
    user,
    searchParams,
    countries = ["FR", "US", "GB", "DE"]
  ) {
    if (process.env.VPN_ENABLED !== "true") {
      logger.warn("VPN search requested but VPN is disabled");
      return this.smartSearch(user, searchParams);
    }

    logger.info(`VPN search across ${countries.length} countries`);

    const results = [];

    // Simuler une recherche depuis différents pays
    // En production, cela nécessiterait un vrai service VPN
    for (const country of countries) {
      try {
        // Modifier les paramètres de recherche pour simuler une origine différente
        const vpnSearchParams = {
          ...searchParams,
          market: country,
          currency: this.getCurrencyForCountry(country),
        };

        const countryResults = await this.smartSearch(user, vpnSearchParams);

        results.push({
          country,
          flights: countryResults.flights.slice(0, 5), // Top 5 par pays
          cheapestPrice: Math.min(
            ...countryResults.flights.map((f) => f.price.total)
          ),
        });
      } catch (error) {
        logger.error(`VPN search failed for ${country}:`, error.message);
      }
    }

    // Trouver le meilleur prix global
    const allFlights = results.flatMap((r) =>
      r.flights.map((f) => ({
        ...f,
        vpnCountry: r.country,
      }))
    );

    // Trier par prix
    allFlights.sort((a, b) => a.price.total - b.price.total);

    return {
      flights: allFlights,
      vpnComparison: results.map((r) => ({
        country: r.country,
        cheapestPrice: r.cheapestPrice,
        savings: results[0].cheapestPrice - r.cheapestPrice,
      })),
      meta: {
        totalResults: allFlights.length,
        countries: countries,
        bestCountry: results.sort(
          (a, b) => a.cheapestPrice - b.cheapestPrice
        )[0]?.country,
      },
    };
  }

  /**
   * Obtenir la monnaie d'un pays
   */
  getCurrencyForCountry(country) {
    const currencies = {
      FR: "EUR",
      US: "USD",
      GB: "GBP",
      DE: "EUR",
      ES: "EUR",
      IT: "EUR",
      CA: "CAD",
      AU: "AUD",
      JP: "JPY",
    };
    return currencies[country] || "EUR";
  }

  /**
   * Dédupliquer les vols similaires de différentes sources
   */
  deduplicateFlights(flights) {
    const uniqueMap = new Map();

    for (const flight of flights) {
      // Créer une clé unique basée sur les caractéristiques du vol
      const key = this.createFlightKey(flight);

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, flight);
      } else {
        // Garder le vol le moins cher
        const existing = uniqueMap.get(key);
        if (flight.price.total < existing.price.total) {
          uniqueMap.set(key, flight);
        }
      }
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * Créer une clé unique pour un vol
   */
  createFlightKey(flight) {
    const outbound = flight.outbound;
    const inbound = flight.inbound;

    const parts = [
      outbound.departure.airport,
      outbound.arrival.airport,
      new Date(outbound.departure.time).toISOString().split("T")[0],
      outbound.stops,
    ];

    if (inbound) {
      parts.push(
        inbound.departure.airport,
        inbound.arrival.airport,
        new Date(inbound.departure.time).toISOString().split("T")[0],
        inbound.stops
      );
    }

    return parts.join("|");
  }

  /**
   * Sauvegarder la recherche dans l'historique
   */
  async saveSearchHistory(userId, searchParams, resultsCount) {
    try {
      await pool.query(
        `
        INSERT INTO flight_searches (
          user_id, origin, destination, departure_date, return_date,
          passengers, cabin_class, results_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          userId,
          searchParams.origin,
          searchParams.destination,
          searchParams.departureDate,
          searchParams.returnDate || null,
          searchParams.adults || 1,
          searchParams.travelClass || searchParams.cabinClass || "economy",
          resultsCount,
        ]
      );
    } catch (error) {
      logger.error("Error saving search history:", error.message);
    }
  }

  /**
   * Sauvegarder les résultats en cache
   */
  async cacheFlightResults(searchParams, flights) {
    try {
      // Sauvegarder les 10 meilleurs résultats
      const topFlights = flights.slice(0, 10);

      for (const flight of topFlights) {
        await pool.query(
          `
          INSERT INTO flight_results (
            search_key, flight_data, price, source, expires_at
          ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')
          ON CONFLICT (search_key, source) 
          DO UPDATE SET 
            flight_data = EXCLUDED.flight_data,
            price = EXCLUDED.price,
            expires_at = EXCLUDED.expires_at,
            updated_at = NOW()
        `,
          [
            this.createSearchKey(searchParams),
            JSON.stringify(flight),
            flight.price.total,
            flight.source,
          ]
        );
      }
    } catch (error) {
      logger.error("Error caching flight results:", error.message);
    }
  }

  /**
   * Sauvegarder dans price_history pour les prédictions ML
   */
  async savePriceHistory(searchParams, flights) {
    try {
      if (!flights || flights.length === 0) return;

      // Calculer le hash de la route
      const routeHash = `${searchParams.origin}-${searchParams.destination}`;

      // Calculer le prix moyen, min et max
      const prices = flights.map((f) => f.price.total);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      // Calculer les jours avant le départ
      const departureDate = new Date(searchParams.departureDate);
      const today = new Date();
      const daysBeforeDeparture = Math.floor(
        (departureDate - today) / (1000 * 60 * 60 * 24)
      );

      // Déterminer le jour de la semaine (0 = dimanche, 6 = samedi)
      const dayOfWeek = departureDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Insérer dans price_history (noms de colonnes corrects)
      await pool.query(
        `
        INSERT INTO price_history (
          route_hash,
          origin_code,
          destination_code,
          date,
          cabin_class,
          avg_price,
          min_price,
          max_price,
          num_flights_sampled,
          currency,
          day_of_week,
          is_weekend,
          days_before_departure,
          data_source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `,
        [
          routeHash,
          searchParams.origin,
          searchParams.destination,
          searchParams.departureDate,
          searchParams.cabinClass || searchParams.travelClass || "economy",
          avgPrice,
          minPrice,
          maxPrice,
          flights.length,
          flights[0]?.price?.currency || "EUR",
          dayOfWeek,
          isWeekend,
          daysBeforeDeparture,
          "amadeus",
        ]
      );

      logger.info(
        `Price history saved for ${routeHash}: avg=${avgPrice.toFixed(
          2
        )} EUR (${flights.length} flights)`
      );
    } catch (error) {
      logger.error("Error saving price history:", error.message, error);
    }
  }

  /**
   * Créer une clé de recherche unique
   */
  createSearchKey(searchParams) {
    return `${searchParams.origin}-${searchParams.destination}-${
      searchParams.departureDate
    }-${searchParams.returnDate || "oneway"}`;
  }

  /**
   * Obtenir l'historique des prix pour une route
   */
  async getPriceHistory(origin, destination, departureDate) {
    try {
      const routeHash = `${origin}-${destination}`;

      const result = await pool.query(
        `
        SELECT 
          date,
          avg_price,
          min_price,
          max_price,
          num_flights_sampled,
          cabin_class
        FROM price_history
        WHERE route_hash = $1
        AND created_at >= NOW() - INTERVAL '90 days'
        ORDER BY date ASC
      `,
        [routeHash]
      );

      return result.rows.map((row) => ({
        date: row.date,
        avgPrice: parseFloat(row.avg_price),
        minPrice: parseFloat(row.min_price),
        maxPrice: parseFloat(row.max_price),
        sampleSize: row.num_flights_sampled,
        cabinClass: row.cabin_class,
      }));
    } catch (error) {
      logger.error("Error fetching price history:", error.message);
      return [];
    }
  }

  /**
   * Prédire l'évolution des prix
   */
  async predictPrices(searchParams) {
    try {
      // 1. Obtenir l'historique des prix
      const priceHistory = await this.getPriceHistory(
        searchParams.origin,
        searchParams.destination,
        searchParams.departureDate
      );

      if (priceHistory.length === 0) {
        return {
          available: false,
          message: "Pas assez de données historiques pour faire une prédiction",
        };
      }

      // 2. Obtenir la prédiction Amadeus
      const amadeusPrediction = await amadeusService.getPricePrediction(
        searchParams
      );

      // 3. Obtenir la prédiction IA
      const aiPrediction = await aiService.predictPriceEvolution(
        searchParams,
        priceHistory
      );

      // 4. Combiner les prédictions
      return {
        available: true,
        currentAvgPrice: priceHistory[priceHistory.length - 1]?.avgPrice,
        trend: aiPrediction.currentTrend,
        predictions: {
          in7Days: aiPrediction.predictedPriceIn7Days,
          in14Days: aiPrediction.predictedPriceIn14Days,
          in30Days: aiPrediction.predictedPriceIn30Days,
        },
        recommendation: aiPrediction.recommendation,
        confidence: aiPrediction.confidence,
        reasoning: aiPrediction.reasoning,
        priceHistory: priceHistory,
        amadeus: amadeusPrediction,
      };
    } catch (error) {
      logger.error("Price prediction error:", error.message);
      return {
        available: false,
        message: "Erreur lors de la prédiction des prix",
      };
    }
  }
}

module.exports = new FlightAggregatorService();
