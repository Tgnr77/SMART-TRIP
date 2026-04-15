const db = require('../database/connection');
const logger = require('../utils/logger');

// Obtenir le profil de l'utilisateur
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, 
              u.date_of_birth, u.nationality, u.avatar_url, u.email_verified,
              u.created_at, u.updated_at
       FROM users u
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Mettre à jour le profil
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, phone, dateOfBirth, nationality, avatarUrl } = req.body;

    const result = await db.query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone),
           date_of_birth = COALESCE($4, date_of_birth),
           nationality = COALESCE($5, nationality),
           avatar_url = COALESCE($6, avatar_url)
       WHERE id = $7
       RETURNING id, email, first_name, last_name, phone, date_of_birth, nationality, avatar_url`,
      [firstName, lastName, phone, dateOfBirth, nationality, avatarUrl, userId]
    );

    logger.info(`Profil mis à jour pour l'utilisateur ${userId}`);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Erreur lors de la mise à jour du profil:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Obtenir les préférences de voyage
exports.getPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Préférences introuvables' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Erreur lors de la récupération des préférences:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Mettre à jour les préférences
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      budgetRange,
      preferredClass,
      preferredAirlines,
      comfortLevel,
      travelStyle,
      maxStops,
      seatPreference,
      mealPreference,
      accessibilityNeeds,
      newsletterSubscribed
    } = req.body;

    const result = await db.query(
      `UPDATE user_profiles 
       SET budget_range = COALESCE($1, budget_range),
           preferred_class = COALESCE($2, preferred_class),
           preferred_airlines = COALESCE($3, preferred_airlines),
           comfort_level = COALESCE($4, comfort_level),
           travel_style = COALESCE($5, travel_style),
           max_stops = COALESCE($6, max_stops),
           seat_preference = COALESCE($7, seat_preference),
           meal_preference = COALESCE($8, meal_preference),
           accessibility_needs = COALESCE($9, accessibility_needs),
           newsletter_subscribed = COALESCE($10, newsletter_subscribed)
       WHERE user_id = $11
       RETURNING *`,
      [
        budgetRange, preferredClass, preferredAirlines, comfortLevel,
        travelStyle, maxStops, seatPreference, mealPreference,
        accessibilityNeeds, newsletterSubscribed, userId
      ]
    );

    logger.info(`Préférences mises à jour pour l'utilisateur ${userId}`);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Erreur lors de la mise à jour des préférences:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Supprimer le compte
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    logger.info(`Compte supprimé pour l'utilisateur ${userId}`);
    res.json({ message: 'Compte supprimé avec succès' });
  } catch (error) {
    logger.error('Erreur lors de la suppression du compte:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Auto-suppression du compte (pour comptes non vérifiés qui expirent côté app)
exports.deleteMe = async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    logger.info(`Auto-suppression du compte non vérifié: ${userId}`);
    res.json({ message: 'Compte supprimé' });
  } catch (error) {
    logger.error('Erreur lors de l\'auto-suppression du compte:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
