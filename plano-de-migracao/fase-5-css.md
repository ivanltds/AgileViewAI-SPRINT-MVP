# FASE 5: CSS e Design System — Tarefas

> **Risco**: Médio | **Dependências**: FASES 2-4 concluídas | **Agente Principal**: AG-EXT

---

## Pré-requisitos

- [ ] FASES 2, 3 e 4 concluídas
- [ ] Todos os módulos JS extraídos e testados
- [ ] Diretório `src/styles/` criado
- [ ] `npm test` — todos os testes passando

---

## Tarefa 5.1: Extrair Variáveis CSS

**Agentes**: AG-EXT → AG-DOC → AG-REG

### 5.1.1 — Criar `src/styles/variables.css`
- **Agente**: `AG-EXT`
- **Ação**: Extrair bloco `:root` do monolito (linha ~7)
- **Conteúdo**:
  ```css
  :root {
    --blue: #257DD9;
    --blue-l: #EBF4FF;
    --slate: #1E2A3A;
    --gray: #6B7A8D;
    --border: #E4E9F0;
    --bg: #FBFCFD;
    --red: #D9534F;
    --amber: #D9A06F;
    --green: #2A9D8F;
    --red-l: #FEF0F0;
    --amber-l: #FDF3E7;
    --green-l: #E8F7F5;
  }
  ```
- [ ] Concluída

### 5.1.2 — Validar conformidade visual (AG-DOC)
- **Ação**: Comparar variáveis com `docs/00_identidade_visual.md`
- [ ] Concluída

---

## Tarefa 5.2: Extrair CSS Base

**Agentes**: AG-EXT → AG-REG

### 5.2.1 — Criar `src/styles/base.css`
- **Conteúdo**: Reset, *, body, button, input, select, textarea, a, .badge, .sb, .btn, .btn-sm, .btn-red, .btn-blue
- [ ] Concluída

### 5.2.2 — Criar `src/styles/layout.css`
- **Conteúdo**: #app, #sidebar, .slogo, .nav-item, .nav-icon, .nav-label, #main-content, .panel, .db-topbar, .db-body, .db-left, .db-right
- [ ] Concluída

---

## Tarefa 5.3: Extrair CSS por Componente

**Agentes**: AG-EXT → AG-REG

### 5.3.1 — `src/styles/vault.css`
- **Classes**: #vault-overlay, .vbox, .vtab, .vinput, .vbtn, .verr
- [ ] Concluída

### 5.3.2 — `src/styles/dashboard.css`
- **Classes**: .kpi-grid, .kpi-card, .kpi-val, .kpi-sub, .bl-table, .bl-row, .children-*, .task-card, .filter-tabs, .ftab, .sort-th, .pbar-*, .prog-*, .vel-*, .act-*, .sp-*, .mem-*, .avatar, .dayoff-*, .badge-*, .xicon
- [ ] Concluída

### 5.3.3 — `src/styles/insights.css`
- **Classes**: .ins-grid, .ins-card, .ins-head, .ins-body, .ins-icon, .ins-rm, .ins-fb-*, .spinner-*
- [ ] Concluída

### 5.3.4 — `src/styles/chat.css`
- **Classes**: .fc-fab, .fc-panel, .fc-header, .fc-body, .fc-sidebar, .fc-messages, .fc-msg-*, .fc-input-area, .fc-textarea, .fc-send-btn, .fc-conv-*, .fc-welcome, @keyframes fcIn
- [ ] Concluída

### 5.3.5 — `src/styles/eficiencia.css`
- **Classes**: .ef-filter-bar, .ef-kpi-*, .ef-charts-grid, .ef-chart-*, .ef-toggle-*, .ef-pct-*, .ef-qbtn, .ef-bl-*, .ef-sprint-*
- [ ] Concluída

### 5.3.6 — `src/styles/qualidade.css`
- **Classes**: .qual-header, .qual-filter-*, .qual-kpi-*, .qkpi*, .qual-charts-*, .qual-chart-*, .qual-tbl*, .qual-llm-*, .tl-*
- [ ] Concluída

### 5.3.7 — `src/styles/components.css`
- **Classes**: .panel-header, .panel-content, .panel-actions, .form-row, .form-grid-2, .form-hint, .modal-overlay, .modal, .mhdr, .mbody, .mfooter, .team-card, .llm-card, .rag-card, .settings-section, .srow, #toast, .toast-item, .mod-tabs, .mod-tab, .mod-panel, .mod-empty, .train-*, .fb-*, .ul-*, .conv-*, .db-team-*
- [ ] Concluída

### 5.3.8 — `src/styles/responsive.css`
- **Conteúdo**: @media(max-width:900px), @media(max-width:768px), #mobile-bottom-nav, .mbn-*, @media print
- [ ] Concluída

---

## Tarefa 5.4: Criar Index CSS

**Agente**: AG-EXT

### 5.4.1 — Criar `src/styles/index.css`
```css
@import './variables.css';
@import './base.css';
@import './layout.css';
@import './vault.css';
@import './dashboard.css';
@import './insights.css';
@import './chat.css';
@import './eficiencia.css';
@import './qualidade.css';
@import './components.css';
@import './responsive.css';
```
- [ ] Concluída

---

## Tarefa 5.5: Verificação Visual

**Agente**: AG-REG

### 5.5.1 — Comparação visual desktop (1280px)
- [ ] Layout geral idêntico
- [ ] Cores e espaçamentos idênticos
- [ ] KPIs, tabelas, cards

### 5.5.2 — Comparação visual tablet (768px)
- [ ] Sidebar com ícones only
- [ ] KPIs 3 colunas
- [ ] Tooltips na sidebar

### 5.5.3 — Comparação visual mobile (375px)
- [ ] Sidebar oculto, bottom nav visível
- [ ] KPIs 2 colunas
- [ ] Modal como bottom sheet
- [ ] Chat FAB posicionado corretamente

---

## Gate de Fase

- [ ] CSS completo extraído em `src/styles/`
- [ ] `index.css` importa todos os arquivos
- [ ] AG-REG aprovou paridade visual em 3 viewports
- [ ] AG-DOC confirmou identidade visual conforme docs
- [ ] Nenhum `!important` adicionado desnecessariamente
