/**
 * AgileViewAI UI Components: Modals
 * Gerenciador central de modais da aplicação.
 */

export const Modals = {
  /**
   * Inicializa o container global de modais, caso não exista no HTML base.
   */
  init() {
    this.overlay = document.getElementById('global-modal-overlay');
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.id = 'global-modal-overlay';
      this.overlay.className = 'modal-overlay';
      document.body.appendChild(this.overlay);

      // Fecha ao clicar fora do modal principal (na overlay escura)
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });
    }
  },

  /**
   * Abre um modal na tela.
   * @param {Object} options - Configurações do modal.
   * @param {string} options.title - Título do modal.
   * @param {string} options.content - HTML ou texto para o corpo.
   * @param {Array<Object>} [options.buttons] - Botões para o footer. 
   *    Ex { label: 'Salvar', class: 'btn', onClick: () => {} }
   */
  open({ title, content, buttons = [] }) {
    if (!this.overlay) this.init();

    // Montar os botões do footer
    const footerHtml = buttons.length === 0 
      ? `<button class="btn btn-close" id="mbtn-close-def">Fechar</button>`
      : buttons.map((b, i) => `<button class="${b.class || 'btn'}" id="mbtn-${i}">${b.label}</button>`).join('');

    this.overlay.innerHTML = `
      <div class="modal">
        <div class="mhdr">
          <div style="font-weight: 600; font-size: 16px; color: var(--slate);">${title}</div>
          <button class="btn-close" style="background:none; border:none; font-size:18px; cursor:pointer;" id="mbtn-x">&times;</button>
        </div>
        <div class="mbody">
          ${content}
        </div>
        <div class="mfooter">
          ${footerHtml}
        </div>
      </div>
    `;

    this.overlay.classList.add('open');

    // Mapear eventos
    document.getElementById('mbtn-x').addEventListener('click', () => this.close());
    
    if (buttons.length === 0) {
      document.getElementById('mbtn-close-def').addEventListener('click', () => this.close());
    } else {
      buttons.forEach((b, i) => {
        const btnEl = document.getElementById(`mbtn-${i}`);
        btnEl.addEventListener('click', () => {
          if (b.onClick) b.onClick(this);
          if (b.autoClose !== false) this.close();
        });
      });
    }
  },

  /**
   * Fecha o modal ativo.
   */
  close() {
    if (this.overlay) {
      this.overlay.classList.remove('open');
      // Limpa após animação
      setTimeout(() => { if (this.overlay) this.overlay.innerHTML = ''; }, 200);
    }
  }
};
