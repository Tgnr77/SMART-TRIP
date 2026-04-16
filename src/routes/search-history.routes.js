const express = require("express");
const router = express.Router();
const searchHistoryController = require("../controllers/search-history.controller");
const { authenticateToken, optionalAuth } = require("../middleware/auth.middleware");

/**
 * @route   POST /api/search/history
 * @desc    Enregistrer une recherche (optionnel pour utilisateurs non connectés)
 * @access  Public/Private
 */
router.post("/history", optionalAuth, searchHistoryController.recordSearch);

/**
 * @route   GET /api/search/history
 * @desc    Récupérer l'historique de recherche de l'utilisateur
 * @access  Private
 */
router.get("/history", authenticateToken, searchHistoryController.getUserHistory);

/**
 * @route   DELETE /api/search/history/:id
 * @desc    Supprimer une entrée de l'historique
 * @access  Private
 */
router.delete("/history/:id", authenticateToken, searchHistoryController.deleteHistoryEntry);

/**
 * @route   DELETE /api/search/history
 * @desc    Effacer tout l'historique
 * @access  Private
 */
router.delete("/history", authenticateToken, searchHistoryController.clearHistory);

/**
 * @route   GET /api/search/trends
 * @desc    Obtenir les tendances de recherche globales
 * @access  Public
 */
router.get("/trends", searchHistoryController.getSearchTrends);

/**
 * @route   GET /api/search/popular
 * @route   GET /api/search/popular-destinations  (alias pour compatibilité Android)
 * @desc    Obtenir les destinations populaires
 * @access  Public
 */
router.get("/popular", searchHistoryController.getPopularDestinations);
router.get("/popular-destinations", searchHistoryController.getPopularDestinations);

module.exports = router;
