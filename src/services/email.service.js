const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Générer un code de vérification à 6 chiffres
exports.generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Transporter SMTP Brevo (utilise les credentials SMTP du .env)
const createTransporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Envoyer un email via SMTP Brevo
const sendBrevoEmail = async ({ to, subject, html }) => {
  const transporter = createTransporter();
  const result = await transporter.sendMail({
    from: `"SMART TRIP" <${process.env.SMTP_FROM}>`,
    to,
    subject,
    html
  });
  return result;
};

// Envoyer un email de vérification
exports.sendVerificationEmail = async (email, code, firstName) => {
  try {
    await sendBrevoEmail({
      to: email,
      subject: 'Vérification de votre compte SMART TRIP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Bienvenue sur SMART TRIP, ${firstName} !</h2>
          <p>Pour activer votre compte, veuillez utiliser le code de vérification suivant :</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #2563eb; font-size: 32px; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p>Ce code est valable pendant <strong>5 minutes</strong>.</p>
          <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #6b7280; font-size: 12px;">SMART TRIP - Votre comparateur de vols intelligent</p>
        </div>
      `
    });
    logger.info(`Email de vérification envoyé à ${email} via Brevo API`);
    return true;
  } catch (error) {
    logger.error(`Erreur envoi email à ${email}:`, error.response?.data || error.message);
    throw error;
  }
};

// Envoyer un email de réinitialisation de mot de passe
exports.sendPasswordResetEmail = async (email, token, firstName) => {
  try {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    await sendBrevoEmail({
      to: email,
      subject: 'Réinitialisation de votre mot de passe SMART TRIP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Réinitialisation de mot de passe</h2>
          <p>Bonjour ${firstName},</p>
          <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour continuer :</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p>Ou copiez ce lien dans votre navigateur :</p>
          <p style="color: #2563eb; word-break: break-all;">${resetLink}</p>
          <p style="color: #ef4444; margin-top: 20px;">Ce lien expire dans 1 heure.</p>
          <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #6b7280; font-size: 12px;">SMART TRIP - Votre comparateur de vols intelligent</p>
        </div>
      `
    });
    logger.info(`Email de réinitialisation envoyé à ${email} via Brevo API`);
    return true;
  } catch (error) {
    logger.error(`Erreur envoi email reset à ${email}:`, error.response?.data || error.message);
    return false;
  }
};
