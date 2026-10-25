/* Public login bootstrap. Never persist OTPs, access tokens, refresh tokens, or the bundle key. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const status = message => { el('auth-status').textContent = message; };
  let config;
  let sent = false;
  let busy = false;
  let retryAt = 0;
  let authenticated = false;
  let accessToken = '';
  let expiry;
  let expiresAt = 0;

  function updateButtons() {
    el('auth-send').disabled = !config || busy || Date.now() < retryAt;
    el('auth-verify').disabled = busy;
    el('auth-code').disabled = busy;
  }
  function lock() {
    // A full reload also discards application closures and locally loaded document objects.
    window.location.reload();
  }
  async function jsonRequest(url, body, headers = {}) {
    const response = await fetch(url, {
      method: 'POST', cache: 'no-store', credentials: 'omit',
      headers: { 'Content-Type': 'application/json', apikey: config.publicKey, ...headers },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      if (response.status === 429) throw Error('Prea multe cereri. Așteaptă puțin și încearcă din nou.');
      throw Error('Cererea nu a reușit. Verifică codul sau solicită un cod nou.');
    }
    return response.json();
  }
  el('auth-send').addEventListener('click', async () => {
    if (busy || !config || Date.now() < retryAt) return;
    busy = true; updateButtons(); status('Se trimite codul…');
    try {
      await jsonRequest(config.url + '/auth/v1/otp', { email: config.email, create_user: false });
      sent = true; retryAt = Date.now() + 60000;
      el('auth-form').hidden = false;
      el('auth-send').textContent = 'Trimite un cod nou';
      status('Codul a fost solicitat. Verifică Inbox și Spam. Poți cere alt cod peste un minut.');
    } catch (error) {
      status(error.message || 'Serviciul de e-mail nu este disponibil momentan.');
    } finally {
      busy = false; updateButtons();
      if (sent) el('auth-code').focus();
    }
  });
  el('auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const code = el('auth-code').value.trim();
    if (busy || !sent || !/^[0-9]{6,10}$/.test(code)) return;
    busy = true; updateButtons(); status('Se verifică accesul…');
    let blobUrl;
    try {
      const session = await jsonRequest(config.url + '/auth/v1/verify', { email: config.email, token: code, type: 'email' });
      // The server below validates the access token and the email, not these client-side values.
      accessToken = session.access_token || '';
      if (!accessToken || !Number.isFinite(session.expires_in) || session.expires_in <= 0) throw Error('Sesiune invalidă.');
      expiresAt = Date.now() + Math.min(session.expires_in, 3600) * 1000;
      const grant = await jsonRequest(config.url + '/functions/v1/app-key', {}, { Authorization: 'Bearer ' + accessToken });
      const raw = Uint8Array.from(atob(grant.key), c => c.charCodeAt(0));
      if (raw.length !== 32) throw Error('Configurație de securitate invalidă.');
      const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
      raw.fill(0); grant.key = '';
      const response = await fetch(config.bundle, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw Error('Aplicația nu a putut fi încărcată. Reîncearcă.');
      const payload = new Uint8Array(await response.arrayBuffer());
      const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: payload.slice(0, 12) }, key, payload.slice(12));
      blobUrl = URL.createObjectURL(new Blob([plaintext], { type: 'text/javascript' }));
      new Uint8Array(plaintext).fill(0);
      const script = document.createElement('script');
      script.src = blobUrl;
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () => reject(Error('Aplicația nu a putut porni. Reîncarcă pagina.'));
        document.body.appendChild(script);
      });
      el('auth-code').value = '';
      authenticated = true;
      el('root').hidden = false;
      el('auth-panel').hidden = true;
      el('auth-logout').hidden = false;
      if (Date.now() >= expiresAt) { lock(); return; }
      expiry = setTimeout(lock, expiresAt - Date.now());
    } catch (error) {
      accessToken = '';
      el('auth-code').value = '';
      status(error.name === 'OperationError' ? 'Versiunea aplicației și configurația de acces nu corespund. Contactează administratorul.' : (error.message || 'Autentificarea nu a reușit.'));
    } finally {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      busy = false; updateButtons();
    }
  });
  el('auth-logout').addEventListener('click', async () => {
    clearTimeout(expiry);
    el('root').hidden = true;
    try {
      if (accessToken) await jsonRequest(config.url + '/auth/v1/logout?scope=local', {}, { Authorization: 'Bearer ' + accessToken });
    } catch { /* Reload still discards every local session credential. */ }
    lock();
  });
  // Browser Back/Forward must not restore an authenticated DOM snapshot.
  window.addEventListener('pagehide', () => {
    el('root').hidden = true;
    el('auth-logout').hidden = true;
    el('auth-panel').hidden = false;
    el('auth-code').value = '';
  });
  window.addEventListener('pageshow', event => { if (event.persisted || authenticated) lock(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && authenticated && Date.now() >= expiresAt) lock();
  });
  setInterval(updateButtons, 1000);
  fetch('./auth-config.json', { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(15000) })
    .then(response => { if (!response.ok) throw Error(); return response.json(); })
    .then(value => {
      if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(value.url) || value.email !== 'adrianianghel@yahoo.com' || !/^\.\/static\/js\/main\.[a-f0-9]+\.js\.enc$/.test(value.bundle)) throw Error();
      config = value; updateButtons(); status('Solicită un cod pentru a deschide aplicația.');
    }).catch(() => status('Autentificarea nu este configurată sau serviciul nu poate fi accesat din această rețea.'));
})();
