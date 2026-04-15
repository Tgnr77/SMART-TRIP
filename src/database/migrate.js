require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("./connection");
const logger = require("../utils/logger");

async function runMigrations() {
  try {
    logger.info("🔄 Démarrage des migrations de base de données...");

    // Migration 001: Schema principal (skip si déjà exécutée)
    logger.info("📝 Migration 001: Schema principal...");
    try {
      const schemaPath = path.join(__dirname, "schema.sql");
      const schema = fs.readFileSync(schemaPath, "utf8");
      await db.query(schema);
      logger.info("✅ Migration 001 terminée");
    } catch (error) {
      if (error.message.includes("already exists")) {
        logger.info("⏭️  Migration 001 déjà appliquée, passage ignoré");
      } else {
        throw error;
      }
    }

    // Migration 002: AI Features
    logger.info(
      "📝 Migration 002: AI Features (profils utilisateurs, prédictions, VPN)..."
    );
    const migrationPath = path.join(
      __dirname,
      "migrations",
      "002_ai_features.sql"
    );
    if (fs.existsSync(migrationPath)) {
      try {
        const migration = fs.readFileSync(migrationPath, "utf8");
        await db.query(migration);
        logger.info("✅ Migration 002 terminée");
      } catch (error) {
        if (error.message.includes("already exists")) {
          logger.info("⏭️  Migration 002 déjà appliquée, passage ignoré");
        } else {
          throw error;
        }
      }
    } else {
      logger.warn("⚠️ Migration 002 introuvable, passage ignoré");
    }

    // Migration 003: Trending real prices columns
    logger.info(
      "📝 Migration 003: Trending real prices (min_price, last_price_update)..."
    );
    const migrationPath003 = path.join(
      __dirname,
      "migrations",
      "003_trending_real_prices.sql"
    );
    if (fs.existsSync(migrationPath003)) {
      try {
        const migration003 = fs.readFileSync(migrationPath003, "utf8");
        await db.query(migration003);
        logger.info("✅ Migration 003 terminée");
      } catch (error) {
        if (
          error.message.includes("already exists") ||
          error.message.includes("IF NOT EXISTS")
        ) {
          logger.info("⏭️  Migration 003 déjà appliquée, passage ignoré");
        } else {
          throw error;
        }
      }
    } else {
      logger.warn("⚠️ Migration 003 introuvable, passage ignoré");
    }

    // Migration 004a: Email verification
    logger.info("📝 Migration 004a: Email verification...");
    const migrationPath004a = path.join(__dirname, "migrations", "004_email_verification.sql");
    if (fs.existsSync(migrationPath004a)) {
      try {
        const migration004a = fs.readFileSync(migrationPath004a, "utf8");
        await db.query(migration004a);
        logger.info("✅ Migration 004a terminée");
      } catch (error) {
        if (error.message.includes("already exists")) {
          logger.info("⏭️  Migration 004a déjà appliquée, passage ignoré");
        } else {
          throw error;
        }
      }
    } else {
      logger.warn("⚠️ Migration 004a introuvable, passage ignoré");
    }

    // Migration 004b: Favorites
    logger.info("📝 Migration 004b: Favorites...");
    const migrationPath004b = path.join(__dirname, "migrations", "004_favorites.sql");
    if (fs.existsSync(migrationPath004b)) {
      try {
        const migration004b = fs.readFileSync(migrationPath004b, "utf8");
        await db.query(migration004b);
        logger.info("✅ Migration 004b terminée");
      } catch (error) {
        if (error.message.includes("already exists")) {
          logger.info("⏭️  Migration 004b déjà appliquée, passage ignoré");
        } else {
          throw error;
        }
      }
    } else {
      logger.warn("⚠️ Migration 004b introuvable, passage ignoré");
    }

    // Migration 005: Search history
    logger.info("📝 Migration 005: Search history...");
    const migrationPath005 = path.join(__dirname, "migrations", "005_search_history.sql");
    if (fs.existsSync(migrationPath005)) {
      try {
        const migration005 = fs.readFileSync(migrationPath005, "utf8");
        await db.query(migration005);
        logger.info("✅ Migration 005 terminée");
      } catch (error) {
        if (error.message.includes("already exists")) {
          logger.info("⏭️  Migration 005 déjà appliquée, passage ignoré");
        } else {
          throw error;
        }
      }
    } else {
      logger.warn("⚠️ Migration 005 introuvable, passage ignoré");
    }

    logger.info("✅ Toutes les migrations terminées avec succès !");
    logger.info("📊 Base de données à jour");

    // Afficher la liste des tables
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    logger.info("📋 Tables créées :");
    result.rows.forEach((row) => {
      logger.info(`   - ${row.table_name}`);
    });

    // process.exit uniquement si exécuté directement (pas importé comme module)
    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    logger.error("❌ Erreur lors des migrations:", error.message);
    logger.error(error.stack);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;
