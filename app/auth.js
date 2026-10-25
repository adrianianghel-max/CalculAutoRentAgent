/* Password and derived key exist only in page memory. No authentication service requests. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const status = message => { el('auth-status').textContent = message; };
  let config, busy = false, authenticated = false;
  const lock = () => window.location.reload();
  function update() {
    el('auth-unlock').disabled = !config || busy;
    el('auth-password').disabled = busy;
  }
  el('auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!config || busy || !el('auth-password').value) return;
    busy = true; update(); status('Se verifică parola…');
    let password = el('auth-password').value.normalize('NFC');
    el('auth-password').value = '';
    let blobUrl;
    try {
      const salt = Uint8Array.from(atob(config.salt), c => c.charCodeAt(0));
      const passwordBytes = new TextEncoder().encode(password);
      password = '';
      let material;
      try { material = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveKey']); }
      finally { passwordBytes.fill(0); }
      const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: config.iterations }, material,
        { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      material = null;
      const response = await fetch(config.bundle, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw Error('Aplicația nu a putut fi încărcată de pe GitHub. Reîncarcă pagina.');
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
      authenticated = true;
      el('root').hidden = false;
      el('auth-panel').hidden = true;
      el('auth-logout').hidden = false;
    } catch (error) {
      status(error.name === 'OperationError'
        ? 'Parolă incorectă. Dacă ai schimbat recent parola, reîncarcă pagina și încearcă din nou.'
        : (error.message || 'Aplicația nu a putut fi deblocată.'));
    } finally {
      password = '';
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      busy = false; update();
      if (!authenticated) el('auth-password').focus();
    }
  });
  el('auth-logout').addEventListener('click', () => { el('root').hidden = true; lock(); });
  window.addEventListener('pagehide', () => {
    el('root').hidden = true;
    el('auth-logout').hidden = true;
    el('auth-panel').hidden = false;
    el('auth-password').value = '';
  });
  window.addEventListener('pageshow', event => { if (event.persisted || authenticated) lock(); });
  fetch('./auth-config.json', { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(15000) })
    .then(response => { if (!response.ok) throw Error(); return response.json(); })
    .then(value => {
      if (!crypto?.subtle || value.mode !== 'password-v1' || value.kdf !== 'PBKDF2-SHA256' || value.iterations !== 600000 ||
        !/^[A-Za-z0-9+/]{22}==$/.test(value.salt) || !/^\.\/static\/js\/main\.[a-f0-9]+\.js\.enc$/.test(value.bundle)) throw Error();
      config = value; update(); status('Introdu parola pentru a deschide aplicația.');
    }).catch(() => status('Configurația nu a putut fi încărcată. Reîncarcă pagina și verifică accesul la GitHub.'));
})();
