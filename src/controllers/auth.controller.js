const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../database/connection");
const logger = require("../utils/logger");
const emailService = require("../services/email.service");

// Inscription
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, dateOfBirth } =
      req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "Cet email est déjà utilisé" });
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, date_of_birth)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, created_at`,
      [
        email,
        passwordHash,
        firstName,
        lastName,
        phone || null,
        dateOfBirth || null,
      ]
    );

    const user = result.rows[0];

    // Créer un profil par défaut
    await db.query(
      `INSERT INTO user_profiles (user_id)
       VALUES ($1)`,
      [user.id]
    );

    // Générer et envoyer le code de vérification
    const verificationCode = emailService.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await db.query(
      `INSERT INTO email_verifications (user_id, email, code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, email, verificationCode, expiresAt]
    );

    // Envoyer l'email (ne pas bloquer si ça échoue)
    emailService.sendVerificationEmail(email, verificationCode, firstName).catch(err => {
      logger.error('Erreur envoi email de vérification:', err);
    });

    // Générer un token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );

    logger.info(`Nouvel utilisateur inscrit: ${email}`);

    res.status(201).json({
      message:
        "Inscription réussie. Un code de vérification a été envoyé à votre email.",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        emailVerified: false,
      },
      token,
    });
  } catch (error) {
    logger.error("Erreur lors de l'inscription:", error);
    res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
};

// Connexion
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Trouver l'utilisateur
    const result = await db.query(
      "SELECT id, email, password_hash, first_name, last_name, is_active, email_verified FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const user = result.rows[0];

    // Vérifier si le compte est actif
    if (!user.is_active) {
      return res.status(403).json({ error: "Compte désactivé" });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    // Vérifier si l'email est vérifié
    if (!user.email_verified) {
      // Vérifier si un code valide existe déjà (non expiré)
      const existingCode = await db.query(
        `SELECT code, expires_at FROM email_verifications
         WHERE user_id = $1 AND verified = false AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      );

      let secondsRemaining;

      if (existingCode.rows.length > 0) {
        // Code valide existant : on le réutilise sans envoyer un nouvel email
        const expiresAt = existingCode.rows[0].expires_at;
        secondsRemaining = Math.max(1, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
        logger.info(`Code de vérification existant réutilisé pour: ${email} (${secondsRemaining}s restantes)`);
      } else {
        // Aucun code valide : générer un nouveau et envoyer l'email
        const verificationCode = emailService.generateVerificationCode();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        secondsRemaining = 300;

        await db.query(`DELETE FROM email_verifications WHERE user_id = $1`, [user.id]);
        await db.query(
          `INSERT INTO email_verifications (user_id, email, code, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [user.id, email, verificationCode, expiresAt]
        );

        emailService.sendVerificationEmail(email, verificationCode, user.first_name).catch(err => {
          logger.error('Erreur envoi email de vérification lors du login:', err);
        });
        logger.info(`Nouveau code de vérification envoyé lors du login: ${email}`);
      }

      return res.status(403).json({
        error: "Email non vérifié",
        requiresVerification: true,
        email: email,
        secondsRemaining,
        message: secondsRemaining < 300
          ? "Utilisez le code de vérification déjà envoyé à votre email"
          : "Un nouveau code de vérification a été envoyé à votre email"
      });
    }

    // Générer un token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );

    logger.info(`Connexion réussie: ${email}`);

    res.json({
      message: "Connexion réussie",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        email_verified: user.email_verified,
      },
      token,
    });
  } catch (error) {
    logger.error("Erreur lors de la connexion:", error);
    res.status(500).json({ error: "Erreur lors de la connexion" });
  }
};

// Vérifier le token
exports.verifyToken = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Token manquant" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Vérifier que l'utilisateur existe toujours
    const result = await db.query(
      "SELECT id, email, first_name, last_name FROM users WHERE id = $1 AND is_active = true",
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    res.json({
      valid: true,
      user: result.rows[0],
    });
  } catch (error) {
    res.status(403).json({ error: "Token invalide ou expiré" });
  }
};

// Déconnexion (côté client principalement)
exports.logout = (req, res) => {
  res.json({ message: "Déconnexion réussie" });
};

// Récupérer le profil utilisateur
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT 
        u.id, u.email, u.first_name, u.last_name, u.phone, 
        u.date_of_birth, u.nationality, u.avatar_url, u.created_at,
        p.budget_preference, p.preferred_airlines, 
        p.comfort_preference, p.max_layovers, p.seat_preference,
        p.meal_preference
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = $1 AND u.is_active = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const user = result.rows[0];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        dateOfBirth: user.date_of_birth,
        nationality: user.nationality,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
        profile: {
          budgetPreference: user.budget_preference,
          preferredAirlines: user.preferred_airlines,
          comfortPreference: user.comfort_preference,
          maxLayovers: user.max_layovers,
          seatPreference: user.seat_preference,
          mealPreference: user.meal_preference,
        },
      },
    });
  } catch (error) {
    logger.error("Erreur lors de la récupération du profil:", error);
    res.status(500).json({ error: "Erreur lors de la récupération du profil" });
  }
};

// Mettre à jour le profil utilisateur
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      nationality,
      budgetPreference,
      preferredAirlines,
      comfortPreference,
      maxLayovers,
      seatPreference,
      mealPreference,
    } = req.body;

    // Mettre à jour les infos de base
    await db.query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone),
           date_of_birth = COALESCE($4, date_of_birth),
           nationality = COALESCE($5, nationality),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [firstName, lastName, phone, dateOfBirth, nationality, userId]
    );

    // Mettre à jour le profil
    await db.query(
      `UPDATE user_profiles 
       SET budget_preference = COALESCE($1, budget_preference),
           preferred_airlines = COALESCE($2, preferred_airlines),
           comfort_preference = COALESCE($3, comfort_preference),
           max_layovers = COALESCE($4, max_layovers),
           seat_preference = COALESCE($5, seat_preference),
           meal_preference = COALESCE($6, meal_preference),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $7`,
      [
        budgetPreference,
        preferredAirlines,
        comfortPreference,
        maxLayovers,
        seatPreference,
        mealPreference,
        userId,
      ]
    );

    logger.info(`Profil mis à jour pour l'utilisateur: ${userId}`);

    // Récupérer le profil mis à jour
    const result = await db.query(
      `SELECT 
        u.id, u.email, u.first_name, u.last_name, u.phone, 
        u.date_of_birth, u.nationality, u.avatar_url,
        p.budget_preference, p.preferred_airlines, 
        p.comfort_preference, p.max_layovers, p.seat_preference,
        p.meal_preference
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = $1`,
      [userId]
    );

    const user = result.rows[0];
    res.json({
      message: "Profil mis à jour avec succès",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        dateOfBirth: user.date_of_birth,
        nationality: user.nationality,
        avatarUrl: user.avatar_url,
        profile: {
          budgetPreference: user.budget_preference,
          preferredAirlines: user.preferred_airlines,
          comfortPreference: user.comfort_preference,
          maxLayovers: user.max_layovers,
          seatPreference: user.seat_preference,
          mealPreference: user.meal_preference,
        },
      },
    });
  } catch (error) {
    logger.error("Erreur lors de la mise à jour du profil:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du profil" });
  }
};

// Vérifier le code email
exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    // Trouver le code de vérification valide
    const result = await db.query(
      `SELECT * FROM email_verifications 
       WHERE email = $1 AND code = $2 AND verified = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Code invalide ou expiré' });
    }

    const verification = result.rows[0];

    // Marquer l'email comme vérifié
    await db.query('UPDATE users SET email_verified = true WHERE id = $1', [verification.user_id]);
    await db.query('UPDATE email_verifications SET verified = true WHERE id = $1', [verification.id]);

    logger.info(`Email vérifié: ${email}`);

    res.json({ message: 'Email vérifié avec succès' });
  } catch (error) {
    logger.error('Erreur lors de la vérification email:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification' });
  }
};

// Renvoyer le code de vérification
exports.resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    // Vérifier que l'utilisateur existe
    const userResult = await db.query(
      'SELECT id, first_name, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const user = userResult.rows[0];

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email déjà vérifié' });
    }

    // Générer un nouveau code
    const verificationCode = emailService.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await db.query(
      `INSERT INTO email_verifications (user_id, email, code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, email, verificationCode, expiresAt]
    );

    // Envoyer l'email
    await emailService.sendVerificationEmail(email, verificationCode, user.first_name);

    logger.info(`Code de vérification renvoyé à: ${email}`);

    res.json({ message: 'Un nouveau code a été envoyé à votre email' });
  } catch (error) {
    logger.error('Erreur lors du renvoi du code:', error);
    res.status(500).json({ error: 'Erreur lors du renvoi du code' });
  }
};

// Demander la réinitialisation du mot de passe
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    // Vérifier que l'utilisateur existe
    const userResult = await db.query(
      'SELECT id, first_name FROM users WHERE email = $1',
      [email]
    );

    // Ne pas révéler si l'email existe ou non (sécurité)
    if (userResult.rows.length === 0) {
      return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
    }

    const user = userResult.rows[0];

    // Générer un token sécurisé
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, resetToken, expiresAt]
    );

    // Envoyer l'email
    await emailService.sendPasswordResetEmail(email, resetToken, user.first_name);

    logger.info(`Demande de réinitialisation mot de passe pour: ${email}`);

    res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
  } catch (error) {
    logger.error('Erreur lors de la demande de réinitialisation:', error);
    res.status(500).json({ error: 'Erreur lors de la demande' });
  }
};

// Réinitialiser le mot de passe
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Vérifier le token
    const tokenResult = await db.query(
      `SELECT * FROM password_reset_tokens 
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }

    const resetToken = tokenResult.rows[0];

    // Hasher le nouveau mot de passe
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Mettre à jour le mot de passe
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, resetToken.user_id]
    );

    // Marquer le token comme utilisé
    await db.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetToken.id]);

    logger.info(`Mot de passe réinitialisé pour user_id: ${resetToken.user_id}`);

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    logger.error('Erreur lors de la réinitialisation:', error);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
  }
};
