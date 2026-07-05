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
  const resendKey = process.env.RESEND_API_KEY;
  const leadpilotSecret = process.env.IVOX_WEBHOOK_SECRET || 'ivox-lp-2026';

  /* ═══ PASSO 1: Cria a conta + magic link no ivox-api (SEQUENCIAL, precisa do link pro email) ═══ */
  let accessLink = null;
  try {
    const signupRes = await fetch('https://ivox-api.btechsouto.shop/api/auth/lead-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ivox-secret': leadpilotSecret },
      body: JSON.stringify({ email, phone }),
    });
    const signupBody = await signupRes.json().catch(() => ({}));
    console.log(`[iVox Lead] lead-signup: ${signupRes.status} ${JSON.stringify(signupBody).slice(0, 200)}`);
    if (signupRes.ok && signupBody.action_link) accessLink = signupBody.action_link;
  } catch (e) {
    console.error(`[iVox Lead] lead-signup FALHOU: ${e.message}`);
  }

  /* ═══ PASSO 2: Todos os canais em paralelo ═══ */
  const tasks = [];

  /* 2a. Email de notificação interna (para o Bruno) */
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
            <p>Conta criada: <strong>${accessLink ? 'SIM ✅ (magic link enviado)' : 'NÃO ❌ (verificar lead-signup)'}</strong></p>
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

    /* 2b. Email de ACESSO para o LEAD — botão entra direto no app logado */
    const ctaUrl = accessLink || 'https://wa.me/5561982025951?text=' + (isUSD
      ? 'Hi!%20I%20want%20to%20activate%20my%20free%20iVox%20call'
      : 'Oi!%20Quero%20ativar%20minha%20liga%C3%A7%C3%A3o%20gr%C3%A1tis%20do%20iVox');

    const ctaText = accessLink
      ? (isUSD ? '🎙️ Open the app & make my free call' : '🎙️ Acessar o app e fazer minha ligação grátis')
      : (isUSD ? '💬 Activate on WhatsApp' : '💬 Ativar pelo WhatsApp');

    const leadSubject = isUSD
      ? '🎉 Your free iVox call is ready — tap to start'
      : '🎉 Sua ligação grátis no iVox está pronta — clique para começar';

    const introTxt = isUSD
      ? `Welcome to iVox! Your account is ready with <strong>1 free call credit</strong>. Tap the button below to open the app — you'll be logged in automatically. Record your message in Portuguese and our AI makes the call in English for you.`
      : `Bem-vindo ao iVox! Sua conta já está criada com <strong>1 crédito de ligação grátis</strong>. Clique no botão abaixo para abrir o app — você entra logado automaticamente. Grave seu recado em português e nossa IA faz a ligação em inglês por você.`;

    const tipTxt = isUSD
      ? `💡 Tip: on your phone, open the link and use "Add to Home Screen" to install the iVox app.`
      : `💡 Dica: no celular, abra o link e use "Adicionar à Tela de Início" para instalar o app do iVox.`;

    const footTxt = isUSD
      ? `After your free call, plans start at $9.90/month — cancel anytime. Need help? Just reply to this email.`
      : `Depois da ligação grátis, planos a partir de R$57,90/mês — cancele quando quiser. Precisa de ajuda? É só responder este email.`;

    tasks.push(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'iVox <noreply@btechsouto.shop>',
          to: email,
          subject: leadSubject,
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
              <div style="text-align:center;padding:28px 0 8px">
                <span style="font-size:30px;font-weight:900">i<span style="color:#1d4ed8">Vox</span></span>
              </div>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
                <h2 style="margin:0 0 12px;font-size:22px">${isUSD ? 'Your free credit is ready! 🎉' : 'Seu crédito grátis está pronto! 🎉'}</h2>
                <p style="font-size:15px;line-height:1.7;color:#475569">${introTxt}</p>
                <div style="text-align:center;margin:24px 0">
                  <a href="${ctaUrl}"
                     style="background:#16a34a;color:#fff;text-decoration:none;font-weight:800;padding:16px 30px;border-radius:12px;display:inline-block;font-size:16px">
                    ${ctaText}
                  </a>
                </div>
                <p style="font-size:13px;line-height:1.6;color:#64748b">${tipTxt}</p>
                <p style="font-size:13px;color:#94a3b8;line-height:1.6">${footTxt}</p>
              </div>
              <p style="text-align:center;font-size:12px;color:#94a3b8;margin-top:16px">
                iVox by BTechSouto · <a href="https://landing-ivox.vercel.app" style="color:#94a3b8">landing-ivox.vercel.app</a>
              </p>
            </div>
          `,
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

  /* 2c. WhatsApp via UAZAPI — também manda o link de acesso */
  const uazapiToken = process.env.UAZAPI_TOKEN;
  const cleanPhone = phone.replace(/\D/g, '');
  if (uazapiToken && cleanPhone.length > 7) {
    const waLink = accessLink ? `\n\nAcesse aqui: ${accessLink}` : '';
    const waMensagem = isUSD
      ? `Hi! This is iVox team. Your free call credit is ready! Open the app and make your first call in English.${accessLink ? `\n\nAccess here: ${accessLink}` : ''}`
      : `Oi! Aqui e a equipe iVox. Seu credito de ligacao gratis esta pronto! Abra o app e faca sua primeira ligacao em ingles.${waLink}`;

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

  /* 2d. LeadPilot kanban */
  tasks.push(
    fetch('https://leads.btechsouto.shop/webhook/ivox-lp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ivox-secret': leadpilotSecret },
      body: JSON.stringify({ email, phone, currency, source, account_created: !!accessLink }),
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

  const results = await Promise.allSettled(tasks);
  const summary = results.map((r) => (r.status === 'fulfilled' ? r.value : { ok: false }));
  console.log(`[iVox Lead] Resumo: ${JSON.stringify(summary)} | conta=${!!accessLink}`);

  return res.status(200).json({ ok: true, account_created: !!accessLink, channels: summary });
}
