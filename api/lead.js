export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, phone = '', source = 'landing-page', currency = 'brl' } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const currencyLabel = currency === 'usd' ? 'USD ($)' : 'BRL (R$)';

  /* Email via Resend */
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'noreply@btechsouto.shop',
        to: 'brunosouto1108@gmail.com',
        subject: `[iVox] Novo lead: ${email}`,
        html: `
          <p><strong>Novo lead na LP do iVox!</strong></p>
          <p>Email: <strong>${email}</strong></p>
          <p>WhatsApp: <strong>${phone || 'não informado'}</strong></p>
          <p>Moeda: ${currencyLabel}</p>
          <p>Fonte: ${source}</p>
          <p>Data: ${now}</p>
          <hr>
          <p style="font-size:12px;color:#999">iVox Landing Page — landing-ivox.vercel.app</p>
        `,
      }),
    }).catch(() => {});
  }

  /* WhatsApp via UAZAPI — envia para o lead se informou telefone */
  const uazapiToken = process.env.UAZAPI_TOKEN;
  if (uazapiToken && phone && phone.length > 7) {
    const cleanPhone = phone.replace(/\D/g, '');
    const waMensagem = currency === 'usd'
      ? `Hi! This is iVox team. We saw you're interested in iVox to make calls in English in the USA. We'd love to help you activate your free credit. Reply here anytime!`
      : `Oi! Aqui e a equipe iVox. Vimos que voce tem interesse no iVox para fazer ligacoes em ingles nos EUA. Podemos te ajudar a ativar seu credito gratis agora. Responda aqui!`;

    fetch(`https://btechsoutoshop.uazapi.com/send/text`, {
      method: 'POST',
      headers: { 'token': uazapiToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: cleanPhone, message: waMensagem }),
    }).catch(() => {});
  }

  /* LeadPilot kanban — cria card no B2B Prospector */
  const leadpilotSecret = process.env.IVOX_WEBHOOK_SECRET || 'ivox-lp-2026';
  fetch('https://leads.btechsouto.shop/webhook/ivox-lp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ivox-secret': leadpilotSecret,
    },
    body: JSON.stringify({ email, phone, currency, source }),
  }).catch(() => {});

  return res.status(200).json({ ok: true });
}
