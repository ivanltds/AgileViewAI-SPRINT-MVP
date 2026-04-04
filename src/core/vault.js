// src/core/vault.js

/**
 * Vault - Módulo responsável pela criptografia e segurança (AES-256-GCM + PBKDF2)
 *
 * Durante a transição, este módulo acessa globalThis.APP e globalThis.Store
 * para preservar 100% da lógica original. Quando a migração estiver concluída
 * para ESModules, passaremos as dependências via injeção/import.
 */

export const Vault = {
  async deriveKey(pin, saltBuf) {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBuf, iterations: 600000, hash: 'SHA-256' }, 
      km, 
      { name: 'AES-GCM', length: 256 }, 
      false, 
      ['encrypt', 'decrypt']
    );
  },
  
  async encrypt(key, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
    const buf = new Uint8Array(iv.byteLength + ct.byteLength);
    buf.set(iv, 0); 
    buf.set(new Uint8Array(ct), iv.byteLength);
    return btoa(String.fromCharCode(...buf));
  },
  
  async decrypt(key, b64) {
    const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const pt  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
    return new TextDecoder().decode(pt);
  },
  
  getSalt() {
    let s = localStorage.getItem('avai_vault_salt');
    if (!s) { 
      const b = crypto.getRandomValues(new Uint8Array(16)); 
      s = btoa(String.fromCharCode(...b)); 
      localStorage.setItem('avai_vault_salt', s); 
    }
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  },
  
  isSetup() { 
    return !!localStorage.getItem('avai_vault_salt') && !!localStorage.getItem('avai_vault_check'); 
  },
  
  async setupPin(pin) {
    const key = await this.deriveKey(pin, this.getSalt());
    localStorage.setItem('avai_vault_check', await this.encrypt(key, 'avai_ok'));
    return key;
  },
  
  async verifyPin(pin) {
    const key = await this.deriveKey(pin, this.getSalt());
    const check = localStorage.getItem('avai_vault_check');
    if (!check) return key;
    try { 
      return (await this.decrypt(key, check)) === 'avai_ok' ? key : null; 
    } catch { 
      return null; 
    }
  },
  
  async encryptToken(plain) {
    if (!globalThis.APP?.vaultKey) return plain;
    return this.encrypt(globalThis.APP.vaultKey, plain);
  },
  
  async decryptToken(cipher) {
    if (!globalThis.APP?.vaultKey) return cipher;
    try { 
      return await this.decrypt(globalThis.APP.vaultKey, cipher); 
    } catch { 
      return ''; 
    }
  },
  
  // Re-encrypt all stored tokens with a new key
  async reencryptAll(oldKey, newKey) {
    if (!globalThis.Store) return;

    const teams = globalThis.Store.getTeams() || [];
    for (const t of teams) {
      if (t.patEnc) { 
        const plain = await this.decrypt(oldKey, t.patEnc); 
        t.patEnc = await this.encrypt(newKey, plain); 
      }
    }
    globalThis.Store.saveTeams(teams);
    
    const llms = globalThis.Store.getLlmList() || [];
    for (const l of llms) {
      if (l.tokenEnc) { 
        const plain = await this.decrypt(oldKey, l.tokenEnc); 
        l.tokenEnc = await this.encrypt(newKey, plain); 
      }
    }
    globalThis.Store.saveLlmList(llms);
  }
};
