/**
 * AgileViewAI - Vault Core (ESM)
 * Responsável pela criptografia (AES-256-GCM + PBKDF2) e proteção de tokens.
 */

import { AppState } from './app-state.js';
import { Store } from './store.js';

const RealVault = {
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
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
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
    AppState.vaultKey = key;
    return key;
  },

  async verifyPin(pin) {
    const key = await this.deriveKey(pin, this.getSalt());
    const check = localStorage.getItem('avai_vault_check');
    if (!check) return key;
    try {
      const ok = (await this.decrypt(key, check)) === 'avai_ok';
      if (ok) AppState.vaultKey = key;
      return ok ? key : null;
    } catch {
      return null;
    }
  },

  async encryptToken(plain) {
    const key = AppState.vaultKey;
    if (!key) return plain;
    return this.encrypt(key, plain);
  },

  async decryptToken(cipher) {
    const key = AppState.vaultKey;
    if (!key) return cipher;
    try {
      return await this.decrypt(key, cipher);
    } catch {
      return '';
    }
  },

  async reencryptAll(oldKey, newKey) {
    const teams = Store.getTeams();
    for (const t of teams) {
      if (t.patEnc) {
        const plain = await this.decrypt(oldKey, t.patEnc);
        t.patEnc = await this.encrypt(newKey, plain);
      }
    }
    Store.saveTeams(teams);

    const llms = Store.getLlmList();
    for (const l of llms) {
      if (l.tokenEnc) {
        const plain = await this.decrypt(oldKey, l.tokenEnc);
        l.tokenEnc = await this.encrypt(newKey, plain);
      }
    }
    Store.saveLlmList(llms);
  }
};

// Exporta um Proxy que prefere o Mock Global se existir (para testes Jest)
export const Vault = new Proxy(RealVault, {
  get(target, prop) {
    if (globalThis.Vault !== undefined && globalThis.Vault !== null && globalThis.Vault[prop] !== undefined) {
      return globalThis.Vault[prop];
    }
    return target[prop];
  }
});
