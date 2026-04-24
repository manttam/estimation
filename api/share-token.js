/**
 * Endpoint serverless — génère un lien de partage signé (JWT) pour le
 * rapport mandant. Le lien est valide 7 jours par défaut.
 *
 * Input  : POST { reportId?: string, expiresInDays?: number }
 * Output : { url, token, expiresAt }
 *
 * Variable d'env requise : JWT_SECRET (32+ caractères, configurée dans
 * Vercel Settings > Environment Variables).
 */
import jwt from 'jsonwebtoken';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    res.status(500).json({
      error:
        "JWT_SECRET manquant ou trop court. Ajoutez une chaîne de 32+ caractères dans Vercel Settings > Environment Variables.",
    });
    return;
  }

  const { reportId = 'default', expiresInDays = 7 } = req.body || {};

  const days = Math.min(Math.max(Number(expiresInDays) || 7, 1), 90);
  const expiresInSeconds = days * 24 * 60 * 60;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  try {
    const token = jwt.sign(
      {
        reportId,
        // scope identifie la ressource partagée — pour de futures évolutions
        scope: 'report:read',
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: expiresInSeconds,
        issuer: 'estimation-v2',
      }
    );

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const url = `${origin}/#/report?t=${encodeURIComponent(token)}`;

    res.status(200).json({ url, token, expiresAt });
  } catch (err) {
    console.error('share-token error:', err);
    res.status(500).json({ error: 'Token generation failed' });
  }
}
