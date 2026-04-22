import { Vault } from '../core/vault.js';

export class VaultUI {
  static init() {
    this.bindEvents();
    
    // Auto-login para testes E2E
    if (localStorage.getItem('avai_test_auto_session') === 'true') {
      console.log('[VaultUI] Auto-session test flag detected. Unlocking...');
      this.startSession();
      return;
    }

    if (Vault.isSetup()) {
      document.getElementById('vsub').textContent = 'Digite seu PIN para desbloquear';
      document.getElementById('vbtn').textContent = 'Entrar';
    } else {
      document.getElementById('vsub').textContent = 'Crie um PIN para proteger seus tokens';
      document.getElementById('vbtn').textContent = 'Criar vault';
    }
  }

  static bindEvents() {
    const tabPin = document.getElementById('tab-pin');
    const tabSession = document.getElementById('tab-session');
    const btnEnter = document.getElementById('vbtn'); // Pin Enter
    const btnSession = document.getElementById('vbtn-session'); // Session start
    const pinInput = document.getElementById('vpin');

    if (tabPin) tabPin.addEventListener('click', () => this.switchTab('pin'));
    if (tabSession) tabSession.addEventListener('click', () => this.switchTab('session'));
    if (btnEnter) btnEnter.addEventListener('click', () => this.handleAction());
    if (btnSession) btnSession.addEventListener('click', () => this.startSession());
    
    if (pinInput) {
      pinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleAction();
      });
    }
  }

  static switchTab(tab) {
    document.getElementById('tab-pin').classList.toggle('active', tab === 'pin');
    document.getElementById('tab-session').classList.toggle('active', tab === 'session');
    document.getElementById('vault-pin-area').style.display = tab === 'pin' ? '' : 'none';
    document.getElementById('vault-session-area').style.display = tab === 'session' ? '' : 'none';
    document.getElementById('verr').textContent = '';
  }

  static async handleAction() {
    const pin = document.getElementById('vpin').value.trim();
    const errEl = document.getElementById('verr');
    const btnEl = document.getElementById('vbtn');
    
    errEl.textContent = '';
    if (pin.length < 4) { 
      errEl.textContent = 'PIN deve ter 4 a 8 dígitos.'; 
      return; 
    }
    
    btnEl.disabled = true;
    btnEl.textContent = 'Aguarde…';
    
    try {
      let key;
      if (!Vault.isSetup()) {
        key = await Vault.setupPin(pin);
        document.getElementById('vsub').textContent = 'Vault criado com sucesso!';
      } else {
        key = await Vault.verifyPin(pin);
        if (!key) { 
          errEl.textContent = 'PIN incorreto.'; 
          btnEl.disabled = false; 
          btnEl.textContent = 'Entrar'; 
          return; 
        }
      }
      
      // Dispatch success event for orchestrator
      document.dispatchEvent(new CustomEvent('vault-unlocked', { 
        detail: { mode: 'pin', key: key } 
      }));
      
    } catch(e) { 
      errEl.textContent = 'Erro: ' + e.message; 
    }
    
    btnEl.disabled = false;
    btnEl.textContent = 'Entrar';
  }

  static startSession() {
    console.log('[VaultUI] Starting session mode...');
    document.dispatchEvent(new CustomEvent('vault-unlocked', { 
      detail: { mode: 'session', key: null } 
    }));
  }
}
