const db = require("../database/connection");
const logger = require("../utils/logger");

/**
 * Enregistrer une recherche dans l'historique
 */
exports.recordSearch = async (req, res) => {
  try {
    const userId = req.user?.id || null; // Peut être null pour les utilisateurs non connectés
    const {
      originCode,
      originCity,
      destinationCode,
      destinationCity,
      departureDate,
      returnDate,
      adults = 1,
      children = 0,
      infants = 0,
      travelClass,
      resultsCount = 0,
    } = req.body;

    const searchType = returnDate ? 'round-trip' : 'one-way';
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await db.query(
      `INSERT INTO user_search_history (
        user_id, origin_code, origin_city, destination_code, destination_city,
        departure_date, return_date, adults, children, infants, travel_class,
        search_type, results_count, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (user_id, origin_code, destination_code, departure_date, searched_at) 
      DO NOTHING
      RETURNING id`,
      [
        userId, originCode, originCity, destinationCode, destinationCity,
        departureDate, returnDate, adults, children, infants, travelClass,
        searchType, resultsCount, ipAddress, userAgent
      ]
    );

    if (result.rows.length > 0) {
      logger.info(`Recherche enregistrée: ${originCode} → ${destinationCode}`);
    }

    res.status(201).json({ success: true });
  } catch (error) {
    logger.error("Erreur lors de l'enregistrement de la recherche:", error);
    // Ne pas bloquer l'utilisateur si l'historique ne peut pas être enregistré
    res.status(200).json({ success: false });
  }
};

/**
 * Récupérer l'historique de recherche de l'utilisateur
 */
exports.getUserHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT 
        id, origin_code, origin_city, destination_code, destination_city,
        departure_date, return_date, adults, children, infants, travel_class,
        search_type, searched_at
      FROM user_search_history
      WHERE user_id = $1
      ORDER BY searched_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) FROM user_search_history WHERE user_id = $1`,
      [userId]
    );

    res.json({
      history: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error("Erreur lors de la récupération de l'historique:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
  }
};

/**
 * Supprimer une entrée de l'historique
 */
exports.deleteHistoryEntry = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM user_search_history WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }

    res.json({ message: "Entrée supprimée avec succès" });
  } catch (error) {
    logger.error("Erreur lors de la suppression de l'entrée:", error);
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
};

/**
 * Effacer tout l'historique de l'utilisateur
 */
exports.clearHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query(`DELETE FROM user_search_history WHERE user_id = $1`, [userId]);

    logger.info(`Historique effacé pour l'utilisateur ${userId}`);
    res.json({ message: "Historique effacé avec succès" });
  } catch (error) {
    logger.error("Erreur lors de l'effacement de l'historique:", error);
    res.status(500).json({ error: "Erreur lors de l'effacement de l'historique" });
  }
};

/**
 * Obtenir les tendances globales (pour admin ou suggestions)
 */
exports.getSearchTrends = async (req, res) => {
  try {
    const { days = 7, limit = 20 } = req.query;

    const result = await db.query(
      `SELECT 
        origin_code, origin_city, destination_code, destination_city,
        COUNT(*) as search_count,
        COUNT(DISTINCT user_id) as unique_users,
        MAX(searched_at) as last_searched
      FROM user_search_history
      WHERE searched_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY origin_code, origin_city, destination_code, destination_city
      ORDER BY search_count DESC
      LIMIT $1`,
      [limit]
    );

    res.json({ trends: result.rows });
  } catch (error) {
    logger.error("Erreur lors de la récupération des tendances:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des tendances" });
  }
};

/**
 * Obtenir les destinations populaires (basé sur l'historique de recherche global)
 */
exports.getPopularDestinations = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Requête sur l'historique réel (toutes recherches, connectés + anonymes)
    let result;
    try {
      result = await db.query(
        `SELECT
           destination_code,
           destination_city,
           COUNT(*) as search_count
         FROM user_search_history
         WHERE destination_code IS NOT NULL
           AND searched_at >= NOW() - INTERVAL '90 days'
         GROUP BY destination_code, destination_city
         ORDER BY search_count DESC
         LIMIT $1`,
        [limit]
      );
    } catch (_) { result = { rows: [] }; }

    // Fallback statique si pas encore de données
    if (!result.rows.length) {
      const fallback = [
        { destination_code: 'DXB', destination_city: 'Dubai',      search_count: 0 },
        { destination_code: 'BKK', destination_city: 'Bangkok',     search_count: 0 },
        { destination_code: 'JFK', destination_city: 'New York',    search_count: 0 },
        { destination_code: 'BCN', destination_city: 'Barcelona',   search_count: 0 },
        { destination_code: 'NRT', destination_city: 'Tokyo',       search_count: 0 },
        { destination_code: 'SIN', destination_city: 'Singapore',   search_count: 0 },
        { destination_code: 'SYD', destination_city: 'Sydney',      search_count: 0 },
        { destination_code: 'MIA', destination_city: 'Miami',       search_count: 0 },
        { destination_code: 'RAK', destination_city: 'Marrakech',   search_count: 0 },
        { destination_code: 'DPS', destination_city: 'Bali',        search_count: 0 },
      ];
      return res.json({ success: true, destinations: fallback.slice(0, parseInt(limit)) });
    }

    res.json({ success: true, destinations: result.rows });
  } catch (error) {
    logger.error("Erreur lors de la récupération des destinations populaires:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des destinations" });
  }
};
