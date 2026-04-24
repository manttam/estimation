/**
 * Endpoint serverless — vérifie un token de partage (JWT) émis par
 * /api/share-token.
 *
 * Input  : POST { token: string }
 * Output : { valid: true, reportId, expiresAt } ou
 *          { valid: false, reason: "expired" | "invalid" }
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
  if (!secret) {
    res.status(500).json({ error: 'JWT_SECRET non configuré côté serveur.' });
    return;
  }

  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    res.status(400).json({ valid: false, reason: 'missing' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'estimation-v2',
    });

    res.status(200).json({
      valid: true,
      reportId: payload.reportId,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    });
  } catch (err) {
    const reason =
      err.name === 'TokenExpiredError' ? 'expired' : 'invalid';
    res.status(200).json({ valid: false, reason });
  }
}
