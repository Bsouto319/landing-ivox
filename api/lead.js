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

  console.log(`[iVox Lead] Recebido: ${email} | ${phone} | ${currency} | ${source}`);

  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const currencyLabel = currency === 'usd' ? 'USD ($)' : 'BRL (R$)';
  const tasks = [];

  /* 1. Email via Resend */
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    tasks.push(
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
      })
        .then(async (r) => {
          const body = await r.text();
          console.log(`[iVox Lead] Resend: ${r.status} ${body.slice(0, 200)}`);
          return { channel: 'resend', ok: r.ok };
        })
        .catch((e) => {
          console.error(`[iVox Lead] Resend FALHOU: ${e.message}`);
          return { channel: 'resend', ok: false };
        })
    );
  } else {
    console.warn('[iVox Lead] RESEND_API_KEY não configurada — email pulado');
  }

  /* 2. WhatsApp via UAZAPI — envia para o lead se informou telefone */
  const uazapiToken = process.env.UAZAPI_TOKEN;
  const cleanPhone = phone.replace(/\D/g, '');
  if (uazapiToken && cleanPhone.length > 7) {
    const waMensagem = currency === 'usd'
      ? `Hi! This is iVox team. We saw you're interested in iVox to make calls in English in the USA. We'd love to help you activate your free credit. Reply here anytime!`
      : `Oi! Aqui e a equipe iVox. Vimos que voce tem interesse no iVox para fazer ligacoes em ingles nos EUA. Podemos te ajudar a ativar seu credito gratis agora. Responda aqui!`;

    tasks.push(
      fetch('https://btechsoutoshop.uazapi.com/send/text', {
        method: 'POST',
        headers: { 'token': uazapiToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: cleanPhone, message: waMensagem }),
      })
        .then(async (r) => {
          const body = await r.text();
          console.log(`[iVox Lead] UAZAPI: ${r.status} ${body.slice(0, 200)}`);
          return { channel: 'uazapi', ok: r.ok };
        })
        .catch((e) => {
          console.error(`[iVox Lead] UAZAPI FALHOU: ${e.message}`);
          return { channel: 'uazapi', ok: false };
        })
    );
  } else if (!uazapiToken) {
    console.warn('[iVox Lead] UAZAPI_TOKEN não configurada — WhatsApp pulado');
  }

  /* 3. LeadPilot kanban — cria card no B2B Prospector */
  const leadpilotSecret = process.env.IVOX_WEBHOOK_SECRET || 'ivox-lp-2026';
  tasks.push(
    fetch('https://leads.btechsouto.shop/webhook/ivox-lp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ivox-secret': leadpilotSecret,
      },
      body: JSON.stringify({ email, phone, currency, source }),
    })
      .then(async (r) => {
        const body = await r.text();
        console.log(`[iVox Lead] LeadPilot: ${r.status} ${body.slice(0, 200)}`);
        return { channel: 'leadpilot', ok: r.ok };
      })
      .catch((e) => {
        console.error(`[iVox Lead] LeadPilot FALHOU: ${e.message}`);
        return { channel: 'leadpilot', ok: false };
      })
  );

  /* AGUARDA todos os canais ANTES de responder — fix do bug de fire-and-forget */
  const results = await Promise.allSettled(tasks);
  const summary = results.map((r) => (r.status === 'fulfilled' ? r.value : { ok: false }));
  console.log(`[iVox Lead] Resumo: ${JSON.stringify(summary)}`);

  return res.status(200).json({ ok: true, channels: summary });
}
