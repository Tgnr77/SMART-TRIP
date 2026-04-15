require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const logger = require("./src/utils/logger");
const db = require("./src/database/connection");
const cleanupService = require("./src/services/cleanup.service");

// Import des routes
const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const flightRoutes = require("./src/routes/flight.routes");
const hotelRoutes = require("./src/routes/hotel.routes");
const tripRoutes = require("./src/routes/trip.routes");
const searchRoutes = require("./src/routes/search.routes");
const searchHistoryRoutes = require("./src/routes/search-history.routes");
const alertRoutes = require("./src/routes/alert.routes");
const favoriteRoutes = require("./src/routes/favorite.routes");
const inspirationRoutes = require("./src/routes/inspiration.routes");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de sécurité
app.use(helmet());
app.use(compression());

// CORS - apps mobiles (Android/iOS) n'envoient pas d'Origin → toujours autorisé
const corsOriginEnv = process.env.CORS_ORIGIN;
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  corsOriginEnv,
].filter(o => o && o !== '*');

app.use(
  cors({
    origin: (origin, callback) => {
      // Pas d'origin = app mobile (Android/iOS) ou Postman → autorisé
      if (!origin) return callback(null, true);
      // CORS_ORIGIN=* → tout autoriser
      if (corsOriginEnv === '*') return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requêtes par IP
});
app.use("/api/", limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger des requêtes
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Route de santé
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/flights", flightRoutes);
app.use("/api/hotels", hotelRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/search", searchHistoryRoutes); // Routes d'historique de recherche
app.use("/api/alerts", alertRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/inspiration", inspirationRoutes);

// Route par défaut
app.get("/", (req, res) => {
  res.json({
    message: "Bienvenue sur SMART TRIP API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      users: "/api/users",
      flights: "/api/flights",
      hotels: "/api/hotels",
      trips: "/api/trips",
      search: "/api/search",
      alerts: "/api/alerts",
      favorites: "/api/favorites",
    },
  });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    error: "Route non trouvée",
    path: req.path,
  });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  logger.error(err.stack);

  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === "development" ? err.message : "Erreur serveur",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Démarrage du serveur avec migrations automatiques
async function startServer() {
  // Exécuter les migrations en production (Railway)
  if (process.env.NODE_ENV === 'production') {
    try {
      const runMigrations = require('./src/database/migrate');
      await runMigrations();
    } catch (err) {
      logger.error('Migrations échouées, arrêt:', err.message);
      process.exit(1);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Serveur SMART TRIP démarré sur http://0.0.0.0:${PORT}`);
    logger.info(`📊 Environnement: ${process.env.NODE_ENV}`);

    db.testConnection();
    cleanupService.startCleanupScheduler();
  });
}

startServer();

// Gestion de l'arrêt gracieux
process.on("SIGTERM", () => {
  logger.info("SIGTERM reçu, arrêt du serveur...");
  db.closeConnection();
  process.exit(0);
});

module.exports = app;
