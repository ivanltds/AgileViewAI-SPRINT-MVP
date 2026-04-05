/**
 * AgileViewAI UI Components: Toast
 * Sistema de notificações não-obstrutivas.
 */

export const Toast = {
  /**
   * Exibe uma mensagem na tela por um tempo determinado.
   * @param {string} msg - Texto da mensagem.
   * @param {'ok'|'err'|'warn'} type - Tipo da notificação.
   * @param {number} duration - Duração em ms (default 3000).
   */
  show(msg, type = 'ok', duration = 3000) {
    let container = document.getElementById('toast');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast';
      document.body.appendChild(container);
    }

    const item = document.createElement('div');
    item.className = `toast-item ${type}`;
    
    // Ícones simples baseados no tipo
    const icon = type === 'ok' ? '✓' : type === 'err' ? '✕' : '⚠';
    item.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
    
    container.appendChild(item);

    // Trigger de animação de entrada
    requestAnimationFrame(() => {
      item.classList.add('show');
    });

    // Remoção automática
    setTimeout(() => {
      item.classList.remove('show');
      setTimeout(() => item.remove(), 300); // Espera a transição de saída
    }, duration);
  }
};

// Atalhos globais para facilitar o uso (opcional, main.js pode atribuir ao window)
export const toast = Toast.show;
