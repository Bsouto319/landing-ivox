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
  const isUSD = currency === 'usd';
  const tasks = [];
  const resendKey = process.env.RESEND_API_KEY;

  /* 1a. Email de NOTIFICAÇÃO interna (para o Bruno) */
  if (resendKey) {
    tasks.push(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'iVox <noreply@btechsouto.shop>',
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
          console.log(`[iVox Lead] Resend (notificação): ${r.status} ${(await r.text()).slice(0, 200)}`);
          return { channel: 'resend_notify', ok: r.ok };
        })
        .catch((e) => {
          console.error(`[iVox Lead] Resend (notificação) FALHOU: ${e.message}`);
          return { channel: 'resend_notify', ok: false };
        })
    );

    /* 1b. Email de LIBERAÇÃO DO TESTE GRÁTIS (para o LEAD) */
    const leadSubject = isUSD
      ? '🎉 Your free iVox call is unlocked!'
      : '🎉 Sua ligação grátis no iVox está liberada!';

    const leadHtml = isUSD
      ? `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
          <div style="text-align:center;padding:28px 0 8px">
            <span style="font-size:30px;font-weight:900">i<span style="color:#1d4ed8">Vox</span></span>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
            <h2 style="margin:0 0 12px;font-size:22px">Your free credit is unlocked! 🎉</h2>
            <p style="font-size:15px;line-height:1.7;color:#475569">
              Welcome to iVox! You now have <strong>1 free call</strong> to try it out:
              record your message in Portuguese and our AI makes the call in English for you —
              restaurants, DMV, hotels, lawyers, anything.
            </p>
            <p style="font-size:15px;line-height:1.7;color:#475569">
              <strong>How to activate:</strong> our team will reach out on WhatsApp
              ${phone ? `(<strong>${phone}</strong>)` : ''} shortly to set up your first call.
              Want it faster? Just message us:
            </p>
            <div style="text-align:center;margin:22px 0">
              <a href="https://wa.me/5561982025951?text=Hi!%20I%20want%20to%20activate%20my%20free%20iVox%20call"
                 style="background:#16a34a;color:#fff;text-decoration:none;font-weight:800;padding:14px 28px;border-radius:12px;display:inline-block">
                💬 Activate on WhatsApp
              </a>
            </div>
            <p style="font-size:13px;color:#94a3b8;line-height:1.6">
              After your free call, plans start at just $9.90/month — cancel anytime.
            </p>
          </div>
          <p style="text-align:center;font-size:12px;color:#94a3b8;margin-top:16px">
            iVox by BTechSouto · <a href="https://landing-ivox.vercel.app" style="color:#94a3b8">landing-ivox.vercel.app</a>
          </p>
        </div>
      `
      : `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
          <div style="text-align:center;padding:28px 0 8px">
            <span style="font-size:30px;font-weight:900">i<span style="color:#1d4ed8">Vox</span></span>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
            <h2 style="margin:0 0 12px;font-size:22px">Seu crédito grátis está liberado! 🎉</h2>
            <p style="font-size:15px;line-height:1.7;color:#475569">
              Bem-vindo ao iVox! Você ganhou <strong>1 ligação grátis</strong> para testar:
              grave seu recado em português e nossa IA faz a ligação em inglês por você —
              restaurantes, DMV, hotéis, advogados, o que precisar.
            </p>
            <p style="font-size:15px;line-height:1.7;color:#475569">
              <strong>Como ativar:</strong> nossa equipe vai te chamar no WhatsApp
              ${phone ? `(<strong>${phone}</strong>)` : ''} em breve para configurar sua primeira ligação.
              Quer agilizar? Manda mensagem pra gente:
            </p>
            <div style="text-align:center;margin:22px 0">
              <a href="https://wa.me/5561982025951?text=Oi!%20Quero%20ativar%20minha%20liga%C3%A7%C3%A3o%20gr%C3%A1tis%20do%20iVox"
                 style="background:#16a34a;color:#fff;text-decoration:none;font-weight:800;padding:14px 28px;border-radius:12px;display:inline-block">
                💬 Ativar pelo WhatsApp
              </a>
            </div>
            <p style="font-size:13px;color:#94a3b8;line-height:1.6">
              Depois da ligação grátis, planos a partir de R$57,90/mês — cancele quando quiser.
            </p>
          </div>
          <p style="text-align:center;font-size:12px;color:#94a3b8;margin-top:16px">
            iVox by BTechSouto · <a href="https://landing-ivox.vercel.app" style="color:#94a3b8">landing-ivox.vercel.app</a>
          </p>
        </div>
      `;

    tasks.push(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'iVox <noreply@btechsouto.shop>',
          to: email,
          subject: leadSubject,
          html: leadHtml,
        }),
      })
        .then(async (r) => {
          console.log(`[iVox Lead] Resend (lead): ${r.status} ${(await r.text()).slice(0, 200)}`);
          return { channel: 'resend_lead', ok: r.ok };
        })
        .catch((e) => {
          console.error(`[iVox Lead] Resend (lead) FALHOU: ${e.message}`);
          return { channel: 'resend_lead', ok: false };
        })
    );
  } else {
    console.warn('[iVox Lead] RESEND_API_KEY não configurada — emails pulados');
  }

  /* 2. WhatsApp via UAZAPI — envia para o lead se informou telefone */
  const uazapiToken = process.env.UAZAPI_TOKEN;
  const cleanPhone = phone.replace(/\D/g, '');
  if (uazapiToken && cleanPhone.length > 7) {
    const waMensagem = isUSD
      ? `Hi! This is iVox team. Your free call credit is unlocked! We'd love to help you set up your first call in English. Reply here anytime!`
      : `Oi! Aqui e a equipe iVox. Seu credito de ligacao gratis esta liberado! Podemos te ajudar a configurar sua primeira ligacao em ingles agora. Responda aqui!`;

    tasks.push(
      fetch('https://btechsoutoshop.uazapi.com/send/text', {
        method: 'POST',
        headers: { 'token': uazapiToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: cleanPhone, message: waMensagem }),
      })
        .then(async (r) => {
          console.log(`[iVox Lead] UAZAPI: ${r.status} ${(await r.text()).slice(0, 200)}`);
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
        console.log(`[iVox Lead] LeadPilot: ${r.status} ${(await r.text()).slice(0, 200)}`);
        return { channel: 'leadpilot', ok: r.ok };
      })
      .catch((e) => {
        console.error(`[iVox Lead] LeadPilot FALHOU: ${e.message}`);
        return { channel: 'leadpilot', ok: false };
      })
  );

  /* Aguarda todos os canais antes de responder */
  const results = await Promise.allSettled(tasks);
  const summary = results.map((r) => (r.status === 'fulfilled' ? r.value : { ok: false }));
  console.log(`[iVox Lead] Resumo: ${JSON.stringify(summary)}`);

  return res.status(200).json({ ok: true, channels: summary });
}
