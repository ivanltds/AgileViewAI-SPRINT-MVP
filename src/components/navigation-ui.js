export class NavigationUI {
  static init() {
    this.bindEvents();
  }

  static bindEvents() {
    const navs = document.querySelectorAll('.nav-item, .mbn-item');
    navs.forEach(item => {
      item.addEventListener('click', () => {
        let panelId = item.id.replace('nav-', '').replace('mbn-', '');
        this.showPanel(panelId);
      });
    });
  }

  static showPanel(name) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.mbn-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById('panel-'+name)?.classList.add('active');
    document.getElementById('nav-'+name)?.classList.add('active');
    document.getElementById('mbn-'+name)?.classList.add('active');
    
    document.getElementById('main-content')?.scrollTo({top:0, behavior:'instant'});

    if (window.innerWidth <= 768) {
      document.getElementById('sidebar')?.classList.remove('open');
    }

    document.dispatchEvent(new CustomEvent('nav-changed', {
      detail: { panel: name }
    }));
  }
}
