// ============================================================
// GET /api/config — expõe configurações PÚBLICAS ao front.
// Função serverless da Vercel (Node, ESM).
//
// É por aqui que a public key do Uploadcare, definida na env
// da Vercel (UPLOADCARE_PUBLIC_KEY), chega ao navegador.
// Nunca devolver segredos aqui: tudo que sai daqui é público.
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido. Use GET.' });
    return;
  }

  res.status(200).json({
    ok: true,
    uploadcarePubkey: process.env.UPLOADCARE_PUBLIC_KEY || '',
  });
}
