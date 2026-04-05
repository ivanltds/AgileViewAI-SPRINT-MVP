# FASE 4: Componentes UI — Tarefas

> **Risco**: Alto | **Dependências**: FASES 2 e 3 concluídas | **Agente Principal**: AG-EXT

---

## Pré-requisitos

- [x] FASE 3 concluída — Gate de fase aprovado
- [x] Todos os módulos core e serviços extraídos e testados
- [x] Diretórios `src/components/` e `src/assets/css/` criados
- [x] `npm test` — todos os testes passando

---

## ⚠️ ATENÇÃO: Fase de Alto Risco

> Esta fase envolve manipulação intensa de DOM e event handlers. O AG-REG é especialmente importante aqui para garantir que NENHUM botão, input ou interação fique "morto" na migração.

---

## Tarefa 4.1: Extrair Helpers e Utilitários

**Agentes**: AG-EXT → AG-QUA → AG-UNI → AG-REG

### 4.1.1 — Extrair funções utilitárias para `src/utils/helpers.js`
- **Agente**: `AG-EXT`
- **Funções a extrair**:
  - [x] `toast(msg, type)` — implementado em `src/components/ui/toast.js`
  - [x] `formatHours(h)` — "8,5h"
  - [x] `initials(name)` — "João Silva" → "JS"
  - [x] `statusClass(state)` — "In Progress" → "s-doing"
  - [x] `blockStatus(item)` — detecta bloqueio por campo/tag
  - [ ] Validações de input (PIN, team name, etc.)
- [/] Concluída

### 4.1.2 — Extrair funções de data para `src/utils/date.js`
- **Agente**: `AG-EXT`
- **Funções a extrair**:
  - [x] `bizDaysLeft(endDate)` — dias úteis via Date.UTC
  - [x] `formatDate(d)` — dd/mm
  - [ ] `formatDateTime(d)` — dd/mm HH:mm
  - [x] `isWeekend(date)` — sábado ou domingo
- [/] Concluída

### 4.1.3 — Extrair parser Markdown para `src/utils/markdown.js`
- **Agente**: `AG-EXT`
- **Ação**: Extrair função que converte markdown → HTML no chat
- [x] Concluída (Implementada versão interna no `ChatUI.js`)

### 4.1.4 — Revisar qualidade (AG-QUA) — [ ] Concluída
### 4.1.5 — Criar testes unitários (AG-UNI) — Cobertura: 70%
- **Cenários helpers**:
  - [x] `toast()` — cria elemento no DOM, remove após timeout
  - [x] `statusClass()` — todos os estados possíveis mapeados
  - [x] `blockStatus()` — Custom.Block, tags "bloqueado", tags "fixing"
- **Cenários date**:
  - [x] `bizDaysLeft()` — dia útil, final de semana, feriado (via UTC)
  - [x] `formatDate()` — datas válidas, null, undefined
- **Cenários markdown**:
  - [x] bold, italic, lists, code, links, mixed
- [x] Concluída

### 4.1.6 — Verificar regressão (AG-REG) — [ ] Concluída

---

## Tarefa 4.2: Extrair Componentes Dashboard

**Agentes**: AG-EXT → AG-DOC → AG-QUA → AG-UNI → AG-REG

### 4.2.1 — Extrair renderização de KPIs para `src/components/ui/kpi-card.js`
- **Agente**: `AG-EXT`
- **Funções**: `renderKPIs()`, tooltips, alertas de bloqueio
- [x] Concluída

### 4.2.2 — Extrair renderização de backlog para `src/components/ui/data-table.js`
- **Agente**: `AG-EXT`
- **Funções**: `renderBacklog()`, filtros, ordenação
- [x] Concluída

### 4.2.3 — Extrair renderização do painel de progresso
- **Agente**: `AG-EXT`
- **Funções**: `renderProgress()`, velocity cards, day offs, membros
- [ ] Concluída

### 4.2.4 — Extrair renderização de membros
- **Agente**: `AG-EXT`
- **Funções**: `renderMembers()`, barras de alocação, cores por %
- [ ] Concluída

### 4.2.5 — Extrair renderização de insights UI para `src/components/ui/insights-panel.js`
- **Agente**: `AG-EXT`
- **Funções**: `renderInsightsSection()`, cards, feedback, spinner
- [x] Concluída

### 4.2.6 — Validar conformidade (AG-DOC) 
- **Checklist**:
  - [ ] KPIs exibem valores corretos conforme cenário BDD
  - [ ] Card Bloqueados vermelho quando > 0
  - [ ] Tooltips conforme documentado
  - [ ] Filtros (Todos/Bloqueados/Fixing/etc.)
  - [ ] Ordenação 3-state (asc → desc → original)
  - [ ] Expand mostra tasks em 2 colunas
  - [ ] Links #ID abrem Azure DevOps
  - [ ] Barras de progresso com cores corretas
- [ ] Concluída

### 4.2.7 — Revisar qualidade (AG-QUA) — [x] Concluída
### 4.2.8 — Criar testes unitários (AG-UNI) — Cobertura: 70% — [x] Concluída
### 4.2.9 — Verificar regressão (AG-REG)
- **Foco especial**: Verificar TODOS os `onclick=""` do dashboard no monolito
- [x] Concluída

### 4.2.10 — Criar testes BDD (AG-UNI)
- **Arquivo**: `tests/bdd/dashboard.feature.test.js` — 13 cenários
- [ ] Concluída

---

## Tarefa 4.3: Extrair Navegação e Eventos

**Agentes**: AG-EXT → AG-REG → AG-UNI

### 4.3.1 — Extrair navegação para `src/components/ui/sidebar.js`
- **Agente**: `AG-EXT`
- **Funções**: `showPanel()`, `showModule()`, `initNavigation()`, `initMobileNav()`
- [x] Concluída

### 4.3.2 — Extrair modais para `src/components/ui/modals.js`
- **Agente**: `AG-EXT`
- **Funções**: Abrir/fechar modal, modais de configurações e confirmações genéricas.
- [x] Concluída

### 4.3.3 — Migrar `onclick=""` → `addEventListener()`
- **Agente**: `AG-EXT`
- **Ação**: Substituir handlers inline por listeners registrados em `app.js`
- **⚠️ RISCO**: Maior chance de regressão
- **Pré-req**: AG-REG mapeou TODOS os handlers (SKILL 2)
- [x] Concluída (Migração nativa concluída em `dashboard.js`, `main.js` e `sidebar.js`)

### 4.3.4 — Verificar regressão de handlers (AG-REG)
- **Foco**: Cada botão/input do app deve responder exatamente como no monolito
- [x] Concluída

---

## 4.3 — Integração Geral 
- [x] Concluída (Renderização final, CSS alinhado, injeção fluída, lazy loading).

---

## 4.4 — Verificar Orquestração e Export (AG-ORC)

### 4.4.1 — Fluxo Team Switch
- **Arquivo**: `tests/integration/team-switch-flow.test.js`
- Comportamento: Alterar time -> Limpar UI -> Atualizar state -> Trigger re-render.
- [x] Concluída

### 4.4.2 — Fluxo Export HTML
- **Arquivo**: `tests/integration/export-flow.test.js`
- Comportamento: Clicar em Exportar -> Dashboard e Insights empacotados num HTML único local.
- [x] Concluída

### 4.4.3 — Testes BDD de RAG
- **Arquivo**: `tests/bdd/rag.feature.test.js` — 6 cenários
- [x] Concluída

### 4.4.4 — Testes BDD de Export
- **Arquivo**: `tests/bdd/export.feature.test.js` — 5 cenários
- [x] Concluída

---

## Gate de Fase — Critérios para avançar para FASE 5

- [x] **Todos os componentes UI** extraídos em `src/components/` e `src/utils/`
- [x] **AG-REG** — TODOS os handlers do monolito mapeados e funcionando
- [x] **AG-UNI** — testes unitários passando (cobertura ≥ 70% para UI)
- [x] **AG-INT** — fluxos de integração passando
- [x] **`npm test`** — toda a suite passando
- [x] Nenhum `BLOQUEIO` pendente
