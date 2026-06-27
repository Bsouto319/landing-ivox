export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, source = 'landing-page' } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'noreply@btechsouto.shop',
        to: 'brunosouto1108@gmail.com',
        subject: `[iVox] Novo lead: ${email}`,
        html: `
          <p><strong>Novo lead na LP do iVox!</strong></p>
          <p>Email: <strong>${email}</strong></p>
          <p>Fonte: ${source}</p>
          <p>Data: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
          <hr>
          <p style="font-size:12px;color:#999">iVox Landing Page — landing-ivox.vercel.app</p>
        `,
      }),
    }).catch(() => {});
  }

  return res.status(200).json({ ok: true });
}
