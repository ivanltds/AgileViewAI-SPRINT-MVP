# FASE 4: Componentes UI — Tarefas

> **Risco**: Alto | **Dependências**: FASES 2 e 3 concluídas | **Agente Principal**: AG-EXT

---

## Pré-requisitos

- [ ] FASE 3 concluída — Gate de fase aprovado
- [ ] Todos os módulos core e serviços extraídos e testados
- [ ] Diretórios `src/components/` e `src/utils/` criados
- [ ] `npm test` — todos os testes passando

---

## ⚠️ ATENÇÃO: Fase de Alto Risco

> Esta fase envolve manipulação intensa de DOM e event handlers. O AG-REG é especialmente importante aqui para garantir que NENHUM botão, input ou interação fique "morto" na migração.

---

## Tarefa 4.1: Extrair Helpers e Utilitários

**Agentes**: AG-EXT → AG-QUA → AG-UNI → AG-REG

### 4.1.1 — Extrair funções utilitárias para `src/utils/helpers.js`
- **Agente**: `AG-EXT`
- **Funções a extrair**:
  - [ ] `toast(msg, type)` — notificação toast
  - [ ] `formatHours(h)` — "8,5h"
  - [ ] `initials(name)` — "João Silva" → "JS"
  - [ ] `statusClass(state)` — "In Progress" → "s-doing"
  - [ ] `blockStatus(item)` — detecta bloqueio por campo/tag
  - [ ] Validações de input (PIN, team name, etc.)
- [ ] Concluída

### 4.1.2 — Extrair funções de data para `src/utils/date.js`
- **Agente**: `AG-EXT`
- **Funções a extrair**:
  - [ ] `bizDaysLeft(endDate)` — dias úteis via Date.UTC
  - [ ] `formatDate(d)` — dd/mm
  - [ ] `formatDateTime(d)` — dd/mm HH:mm
  - [ ] `isWeekend(date)` — sábado ou domingo
- [ ] Concluída

### 4.1.3 — Extrair parser Markdown para `src/utils/markdown.js`
- **Agente**: `AG-EXT`
- **Ação**: Extrair função que converte markdown → HTML no chat
- [ ] Concluída

### 4.1.4 — Revisar qualidade (AG-QUA) — [ ] Concluída
### 4.1.5 — Criar testes unitários (AG-UNI) — Cobertura: 70%
- **Cenários helpers**:
  - [ ] `toast()` — cria elemento no DOM, remove após timeout
  - [ ] `statusClass()` — todos os estados possíveis mapeados
  - [ ] `blockStatus()` — Custom.Block, tags "bloqueado", tags "fixing"
- **Cenários date**:
  - [ ] `bizDaysLeft()` — dia útil, final de semana, feriado (via UTC)
  - [ ] `formatDate()` — datas válidas, null, undefined
- **Cenários markdown**:
  - [ ] bold, italic, lists, code, links, mixed
- [ ] Concluída

### 4.1.6 — Verificar regressão (AG-REG) — [ ] Concluída

---

## Tarefa 4.2: Extrair Componentes Dashboard

**Agentes**: AG-EXT → AG-DOC → AG-QUA → AG-UNI → AG-REG

### 4.2.1 — Extrair renderização de KPIs para `src/components/dashboard.js`
- **Agente**: `AG-EXT`
- **Funções**: `renderKPIs()`, tooltips, alertas de bloqueio
- **Referência BDD**: Feature: Dashboard Sprint (13 cenários)
- [ ] Concluída

### 4.2.2 — Extrair renderização de backlog
- **Agente**: `AG-EXT`
- **Funções**: `renderBacklog()`, filtros, ordenação, expand de tasks filhas
- [ ] Concluída

### 4.2.3 — Extrair renderização do painel de progresso
- **Agente**: `AG-EXT`
- **Funções**: `renderProgress()`, velocity cards, day offs, membros
- [ ] Concluída

### 4.2.4 — Extrair renderização de membros
- **Agente**: `AG-EXT`
- **Funções**: `renderMembers()`, barras de alocação, cores por %
- [ ] Concluída

### 4.2.5 — Extrair renderização de insights UI
- **Agente**: `AG-EXT`
- **Funções**: `renderInsightsSection()`, cards, feedback, spinner
- [ ] Concluída

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

### 4.2.7 — Revisar qualidade (AG-QUA) — [ ] Concluída
### 4.2.8 — Criar testes unitários (AG-UNI) — Cobertura: 70% — [ ] Concluída
### 4.2.9 — Verificar regressão (AG-REG)
- **Foco especial**: Verificar TODOS os `onclick=""` do dashboard no monolito
- [ ] Concluída

### 4.2.10 — Criar testes BDD (AG-UNI)
- **Arquivo**: `tests/bdd/dashboard.feature.test.js` — 13 cenários
- [ ] Concluída

---

## Tarefa 4.3: Extrair Navegação e Eventos

**Agentes**: AG-EXT → AG-REG → AG-UNI

### 4.3.1 — Extrair navegação para `src/components/navigation.js`
- **Agente**: `AG-EXT`
- **Funções**: `showPanel()`, `showModule()`, `initNavigation()`, `initMobileNav()`
- [ ] Concluída

### 4.3.2 — Extrair modais para `src/components/modals.js`
- **Agente**: `AG-EXT`
- **Funções**: Abrir/fechar modal, modal de criação de time, modal de LLM, modal de RAG
- [ ] Concluída

### 4.3.3 — Migrar `onclick=""` → `addEventListener()`
- **Agente**: `AG-EXT`
- **Ação**: Substituir handlers inline por listeners registrados em `app.js`
- **⚠️ RISCO**: Maior chance de regressão
- **Pré-req**: AG-REG mapeou TODOS os handlers (SKILL 2)
- [ ] Concluída

### 4.3.4 — Verificar regressão de handlers (AG-REG)
- **Foco**: Cada botão/input do app deve responder exatamente como no monolito
- [ ] Concluída

---

## Tarefa 4.4: Testes de Integração da FASE 4

**Agente**: AG-INT

### 4.4.1 — Fluxo Team Switch
- **Arquivo**: `tests/integration/team-switch-flow.test.js`
- [ ] Concluída

### 4.4.2 — Fluxo Export HTML (**⚠️ escalar ao usuário se export offline mudar**)
- **Arquivo**: `tests/integration/export-flow.test.js`
- [ ] Concluída

### 4.4.3 — Testes BDD de RAG
- **Arquivo**: `tests/bdd/rag.feature.test.js` — 6 cenários
- [ ] Concluída

### 4.4.4 — Testes BDD de Export
- **Arquivo**: `tests/bdd/export.feature.test.js` — 5 cenários
- [ ] Concluída

---

## Gate de Fase — Critérios para avançar para FASE 5

- [ ] **Todos os componentes UI** extraídos em `src/components/` e `src/utils/`
- [ ] **AG-REG** — TODOS os handlers do monolito mapeados e funcionando
- [ ] **AG-UNI** — testes unitários passando (cobertura ≥ 70% para UI)
- [ ] **AG-INT** — fluxos de integração passando
- [ ] **`npm test`** — toda a suite passando
- [ ] Nenhum `BLOQUEIO` pendente
