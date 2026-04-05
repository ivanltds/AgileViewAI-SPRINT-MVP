/**
 * AgileViewAI UI Components: Sidebar
 * Gerencia a barra de navegação principal.
 */

export const Sidebar = {
  /**
   * Inicializa a sidebar.
   * @param {Element} container - O elemento de destino para a navegação.
   * @param {Function} onNav - Callback disparada ao trocar de painel.
   */
  init(container, onNav) {
    this.container = container;
    this.onNav = onNav;
    this.render();
    this.setupEvents();
  },

  render() {
    this.container.innerHTML = `
      <div class="slogo">
        <div style="width:32px;height:32px;background:var(--blue);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </div>
        <div>
          <div style="font-size:15px;font-weight:700;color:#fff">AgileViewAI</div>
          <div style="font-size:10px;color:var(--gray-light)">v2.3 (ESM)</div>
        </div>
      </div>
      <div style="flex:1;padding:8px 0" id="sidebar-nav">
        <div class="nav-item active" data-panel="dashboard">
          <span class="nav-icon">📊</span>
          <span class="nav-label">Dashboard</span>
        </div>
        <div class="nav-item" data-panel="teams">
          <span class="nav-icon">👥</span>
          <span class="nav-label">Times</span>
        </div>
        <div class="nav-item" data-panel="llm">
          <span class="nav-icon">🤖</span>
          <span class="nav-label">IA & Tokens</span>
        </div>
        <div class="nav-item" data-panel="rag">
          <span class="nav-icon">📖</span>
          <span class="nav-label">Treinamento</span>
        </div>
        <div class="nav-item" data-panel="settings">
          <span class="nav-icon">⚙️</span>
          <span class="nav-label">Configurações</span>
        </div>
      </div>
    `;
  },

  setupEvents() {
    const navItems = this.container.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const panel = item.getAttribute('data-panel');
        this.setActive(panel);
        this.onNav(panel);
      });
    });
  },

  /**
   * Define o item ativo visualmente na sidebar.
   * @param {string} panelId - ID do painel correspondente.
   */
  setActive(panelId) {
    const items = this.container.querySelectorAll('.nav-item');
    items.forEach(i => {
      const isTarget = i.getAttribute('data-panel') === panelId;
      i.classList.toggle('active', isTarget);
    });
  }
};
