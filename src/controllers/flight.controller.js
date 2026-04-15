const db = require("../database/connection");
const logger = require("../utils/logger");
const flightAggregator = require("../services/flight-aggregator.service");
const amadeusService = require("../services/amadeus.service");

// Diagnostic : test de la connexion Amadeus (force un nouveau token, ignore le cache)
exports.testAmadeusAuth = async (req, res) => {
  const keyPrefix = process.env.AMADEUS_API_KEY
    ? process.env.AMADEUS_API_KEY.substring(0, 8) + "..."
    : "(non défini)";
  try {
    // Forcer un nouveau token (bypass le cache)
    amadeusService.accessToken = null;
    amadeusService.tokenExpiry = null;
    const token = await amadeusService.getAccessToken();
    res.json({
      success: true,
      message: "Amadeus auth OK (fresh token)",
      keyPrefix,
      tokenLength: token?.length,
      tokenPrefix: token?.substring(0, 10) + "...",
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      amadeusDetail: error.response?.data,
      keyPrefix,
    });
  }
};

// Diagnostic : test de recherche Amadeus directe (retourne l'erreur brute au lieu du mock)
exports.testAmadeusSearch = async (req, res) => {
  const { origin = "CDG", destination = "LHR", departureDate = "2026-06-01" } = req.query;
  try {
    const token = await amadeusService.getAccessToken();
    const axios = require("axios");
    const response = await axios.get(
      `${process.env.AMADEUS_BASE_URL || "https://test.api.amadeus.com"}/v2/shopping/flight-offers`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          originLocationCode: origin,
          destinationLocationCode: destination,
          departureDate,
          adults: 1,
          travelClass: "ECONOMY",
          nonStop: false,
          max: 10,
        },
      }
    );
    res.json({
      success: true,
      count: response.data.data?.length || 0,
      firstFlight: response.data.data?.[0] || null,
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      httpStatus: error.response?.status,
      amadeusError: error.response?.data,
    });
  }
};

// Recherche intelligente de vols avec IA
exports.searchFlights = async (req, res) => {
  try {
    const {
      origin,
      destination,
      departureDate,
      returnDate,
      adults = 1,
      children = 0,
      infants = 0,
      travelClass = "ECONOMY",
      cabinClass = "economy",
      nonStop = false,
      maxResults = 250,
    } = req.body;

    const user = req.user;

    // Valider les paramètres obligatoires
    if (!origin || !destination || !departureDate) {
      return res.status(400).json({
        success: false,
        message:
          "Paramètres manquants: origin, destination et departureDate sont requis",
      });
    }

    logger.info(
      `Smart flight search: ${origin} -> ${destination} for user ${
        user?.id || "anonymous"
      }`
    );

    // Recherche intelligente avec agrégation multi-sources et scoring IA
    const searchParams = {
      origin,
      destination,
      departureDate,
      returnDate,
      adults,
      children,
      infants,
      travelClass,
      cabinClass,
      nonStop,
      maxResults,
    };

    const results = await flightAggregator.smartSearch(user, searchParams);

    // Enregistrer la recherche dans l'historique si l'utilisateur est connecté
    if (user && user.id) {
      try {
        await db.query(
          `INSERT INTO user_search_history (user_id, origin_code, destination_code, departure_date, return_date, adults, children, infants, travel_class)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [user.id, origin, destination, departureDate, returnDate, adults, children, infants, travelClass]
        );
        logger.info(`Search history saved for user ${user.id}`);
      } catch (historyError) {
        logger.error("Error saving search history:", historyError);
        // Ne pas bloquer la recherche si l'enregistrement échoue
      }
    }

    res.json({
      success: true,
      data: results,
      message: "Recherche effectuée avec succès",
    });
  } catch (error) {
    logger.error("Erreur lors de la recherche de vols:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la recherche",
      details: error.message,
    });
  }
};

// Recherche avec VPN multi-pays
exports.searchWithVPN = async (req, res) => {
  try {
    const {
      origin,
      destination,
      departureDate,
      returnDate,
      adults = 1,
      countries = ["FR", "US", "GB", "DE"],
    } = req.body;

    const user = req.user;

    if (!origin || !destination || !departureDate) {
      return res.status(400).json({
        success: false,
        message: "Paramètres manquants",
      });
    }

    logger.info(`VPN flight search across ${countries.length} countries`);

    const searchParams = {
      origin,
      destination,
      departureDate,
      returnDate,
      adults,
    };

    const results = await flightAggregator.searchWithVPN(
      user,
      searchParams,
      countries
    );

    res.json({
      success: true,
      data: results,
      message: "Recherche VPN multi-pays effectuée",
    });
  } catch (error) {
    logger.error("Erreur VPN search:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la recherche VPN",
    });
  }
};

// Prédiction de prix
exports.predictPrices = async (req, res) => {
  try {
    const { origin, destination, departureDate, returnDate } = req.body;

    if (!origin || !destination || !departureDate) {
      return res.status(400).json({
        success: false,
        message: "Paramètres manquants",
      });
    }

    const searchParams = {
      origin,
      destination,
      departureDate,
      returnDate,
    };

    const prediction = await flightAggregator.predictPrices(searchParams);

    res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    logger.error("Erreur prédiction prix:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la prédiction",
    });
  }
};

// Détails d'un vol
exports.getFlightDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "SELECT * FROM flight_results WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vol introuvable" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error("Erreur lors de la récupération du vol:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// Réserver un vol
exports.bookFlight = async (req, res) => {
  try {
    const userId = req.user.id;
    const { flightResultId, tripId, passengers } = req.body;

    // TODO: Implémenter la logique de réservation réelle

    const bookingRef = `ST${Date.now()}`;

    const result = await db.query(
      `INSERT INTO flight_bookings 
       (user_id, flight_result_id, trip_id, booking_reference, passengers, total_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        userId,
        flightResultId,
        tripId || null,
        bookingRef,
        JSON.stringify(passengers),
        0,
      ]
    );

    logger.info(`Réservation de vol créée: ${bookingRef}`);

    res.status(201).json({
      message: "Réservation en cours de traitement",
      booking: result.rows[0],
    });
  } catch (error) {
    logger.error("Erreur lors de la réservation:", error);
    res.status(500).json({ error: "Erreur lors de la réservation" });
  }
};

// Historique des recherches
exports.getUserSearches = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM flight_searches 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error("Erreur lors de la récupération de l'historique:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};
