/**
 * AgileViewAI UI Components: Vault Overlay
 * Camada de segurança inicial para desbloqueio de tokens.
 */

import { Vault } from '../../core/vault.js';
import { Store } from '../../core/store.js';
import { Toast } from './toast.js';

export const VaultUI = {
  /**
   * Inicializa o overlay do Vault.
   * @param {Element} container - O elemento de destino para renderização.
   * @param {Function} onUnlock - Callback disparada após o desbloqueio com sucesso.
   */
  async init(container, onUnlock) {
    this.container = container;
    this.onUnlock = onUnlock;
    this.render();
    this.setupEvents();
  },

  render() {
    this.container.innerHTML = `
      <div class="vbox">
        <div style="margin-bottom:12px;display:flex;justify-content:center">
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1E2A3A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div style="font-size:22px;font-weight:700;margin-bottom:6px">AgileViewAI</div>
        <div style="font-size:13px;color:#64748b;margin-bottom:24px">Proteja seus tokens com um PIN</div>
        
        <div style="display:flex;gap:8px;margin-bottom:20px;justify-content:center">
          <button class="vtab active" id="tab-pin">Vault (PIN)</button>
          <button class="vtab" id="tab-session">Sessão</button>
        </div>

        <div id="vault-pin-area">
          <input type="password" class="vinput" id="vpin" maxlength="8" placeholder="••••" autocomplete="off">
          <button class="vbtn" id="vbtn-unlock">Entrar</button>
          <div class="verr" id="verr"></div>
          <div style="font-size:11px;color:#94a3b8;margin-top:10px">4 a 8 dígitos · tokens cifrados com AES-256-GCM</div>
        </div>

        <div id="vault-session-area" style="display:none">
          <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:10px;font-size:12px;color:#854d0e;text-align:left;margin-bottom:14px">
            Modo sessão: tokens ficam apenas na memória e são apagados ao fechar o navegador.
          </div>
          <button class="vbtn" id="vbtn-session">Continuar sem salvar tokens</button>
        </div>
      </div>
    `;
  },

  setupEvents() {
    const pinBtn = document.getElementById('tab-pin');
    const sessBtn = document.getElementById('tab-session');
    const pinArea = document.getElementById('vault-pin-area');
    const sessArea = document.getElementById('vault-session-area');
    const unlockBtn = document.getElementById('vbtn-unlock');
    const sessionBtn = document.getElementById('vbtn-session');
    const pinInput = document.getElementById('vpin');

    pinBtn.addEventListener('click', () => {
      pinBtn.classList.add('active');
      sessBtn.classList.remove('active');
      pinArea.style.display = 'block';
      sessArea.style.display = 'none';
    });

    sessBtn.addEventListener('click', () => {
      sessBtn.classList.add('active');
      pinBtn.classList.remove('active');
      pinArea.style.display = 'none';
      sessArea.style.display = 'block';
    });

    const handleUnlock = async () => {
      const pin = pinInput.value.trim();
      const errEl = document.getElementById('verr');
      errEl.textContent = '';

      if (pin.length < 4) {
        errEl.textContent = 'O PIN deve ter pelo menos 4 dígitos.';
        return;
      }

      try {
        const key = await Vault.verifyPin(pin);
        if (key) {
          window.vaultKey = key; // Singleton temporário na window para os serviços
          this.onUnlock('pin');
        } else {
          errEl.textContent = 'PIN incorreto ou erro na derivação de chave.';
        }
      } catch (e) {
        errEl.textContent = 'Erro ao processar PIN.';
        console.error(e);
      }
    };

    unlockBtn.addEventListener('click', handleUnlock);
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleUnlock();
    });

    sessionBtn.addEventListener('click', () => {
      window.vaultKey = null; // Modo sessão nulo
      this.onUnlock('session');
    });
  }
};
