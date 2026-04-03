# FASE 3: Módulos de Serviço — Tarefas

> **Risco**: Médio | **Dependências**: FASE 2 concluída (Vault, Store, AzureAPI) | **Agente Principal**: AG-EXT

---

## Pré-requisitos

- [ ] FASE 2 concluída — Gate de fase aprovado
- [ ] `src/core/vault.js`, `src/core/store.js`, `src/core/azure-api.js` extraídos e testados
- [ ] Diretório `src/services/` criado
- [ ] `npm test` — todos os testes passando

---

## Tarefa 3.1: Extrair Módulo Insights

**Agentes**: AG-EXT → AG-DOC → AG-QUA → AG-UNI → AG-REG

### 3.1.1 — Localizar código de Insights no monolito
- **Agente**: `AG-EXT`
- **Ação**: Buscar funções de geração de insights: `buildPrompt`, prompt templates, chamada LLM, parseResponse, validadores R0-R8, deduplicação, feedback
- [ ] Concluída

### 3.1.2 — Extrair para `src/services/insights.js`
- **Agente**: `AG-EXT`
- **Ação**: Extrair toda lógica de insights, importar Store
- **Referência**: `docs/04_cenarios_bdd.md` (Feature: Insights de IA — 11 cenários)
- [ ] Concluída

### 3.1.3 — Validar conformidade (AG-DOC)
- **Checklist**:
  - [ ] buildPrompt usa dados reais da sprint (membros, alocação, bloqueios)
  - [ ] Validador R0: folga de capacidade converte critical → info
  - [ ] Validador R3: respeita RAG + alloc ≤ 100% → rebaixa; alloc > 100% → mantém
  - [ ] Validador R7: consolida múltiplos criticals em 1
  - [ ] Validador R8: injeta card para membro ocioso (< 70%)
  - [ ] Deduplicação case-insensitive por título
  - [ ] Feedback 👍/👎 salvo em `avai_insight_fb`
  - [ ] Timeout de 90s
- [ ] Concluída

### 3.1.4 — Revisar qualidade (AG-QUA) — [ ] Concluída
### 3.1.5 — Criar testes unitários (AG-UNI) — Cobertura: 80%
- **Cenários**:
  - [ ] buildPrompt com sprint completa
  - [ ] validateR0 — com folga, sem folga
  - [ ] validateR3 — RAG presente + alloc ≤ 100%, RAG presente + alloc > 100%
  - [ ] validateR7 — 3 criticals → 1 consolidado
  - [ ] validateR8 — membro com < 70% alloc sem card
  - [ ] deduplicate — títulos iguais, case different
  - [ ] parseResponse — JSON válido, texto livre, resposta vazia
- [ ] Concluída

### 3.1.6 — Verificar regressão (AG-REG) — [ ] Concluída
### 3.1.7 — Criar testes BDD (AG-UNI)
- **Arquivo**: `tests/bdd/insights.feature.test.js`
- **Cenários**: 11 cenários de `docs/04_cenarios_bdd.md` (Feature: Insights)
- [ ] Concluída

---

## Tarefa 3.2: Extrair Módulo Chat

**Agentes**: AG-EXT → AG-DOC → AG-QUA → AG-UNI → AG-REG

### 3.2.1 — Localizar código de Chat no monolito
- **Agente**: `AG-EXT`
- **Ação**: Buscar funções do chat flutuante: conversas, envio, histórico, markdown parser, FAB, painel
- [ ] Concluída

### 3.2.2 — Extrair para `src/services/chat.js`
- **Agente**: `AG-EXT`
- **Ação**: Lógica de negócio do chat (sem DOM rendering — isso vai para FASE 4)
- **Referência**: `docs/04_cenarios_bdd.md` (Feature: Chat IA — 10 cenários)
- [ ] Concluída

### 3.2.3 — Validar conformidade (AG-DOC)
- **Checklist**:
  - [ ] Contexto inclui dados do time + RAG
  - [ ] Markdown renderizado corretamente (bold, lists, code)
  - [ ] Histórico persistido em `avai_chat_convs`
  - [ ] Double-submit bloqueado
  - [ ] Timeout de 60s
  - [ ] Nova conversa gera novo ID
- [ ] Concluída

### 3.2.4 — Revisar qualidade (AG-QUA) — [ ] Concluída
### 3.2.5 — Criar testes unitários (AG-UNI) — Cobertura: 80%
- **Cenários**:
  - [ ] buildChatPrompt — com sprint data, sem sprint data
  - [ ] parseMarkdown — bold, italic, lists, code blocks, links
  - [ ] createConversation — ID único, timestamp
  - [ ] saveConversation / loadConversation — round-trip
  - [ ] deleteConversation — remoção do Store
- [ ] Concluída

### 3.2.6 — Verificar regressão (AG-REG) — [ ] Concluída
### 3.2.7 — Criar testes BDD (AG-UNI)
- **Arquivo**: `tests/bdd/chat.feature.test.js`
- [ ] Concluída

---

## Tarefa 3.3: Extrair Módulo Eficiência

**Agentes**: AG-EXT → AG-DOC → AG-QUA → AG-UNI → AG-REG

### 3.3.1 — Localizar código de Eficiência no monolito — [ ] Concluída
### 3.3.2 — Extrair para `src/services/eficiencia.js` — [ ] Concluída
### 3.3.3 — Validar conformidade (AG-DOC)
- **Checklist**:
  - [ ] Filtro por período (3/6/12 meses) via startDate
  - [ ] Throughput: itens Done / sprint
  - [ ] Lead Time: CreatedDate → ClosedDate
  - [ ] Cycle Time: ActivatedDate → ClosedDate
  - [ ] Tempo por coluna (colTimes) com filtro outlier < 180d
  - [ ] Dados para Chart.js formatados corretamente
- [ ] Concluída

### 3.3.4 — Revisar qualidade (AG-QUA) — [ ] Concluída
### 3.3.5 — Criar testes unitários (AG-UNI) — Cobertura: 80% — [ ] Concluída
### 3.3.6 — Verificar regressão (AG-REG) — [ ] Concluída
### 3.3.7 — Criar testes BDD (AG-UNI) — `tests/bdd/eficiencia.feature.test.js` — [ ] Concluída

---

## Tarefa 3.4: Extrair Módulo Qualidade

**Agentes**: AG-EXT → AG-DOC → AG-QUA → AG-UNI → AG-REG

### 3.4.1 — Localizar código de Qualidade no monolito — [ ] Concluída
### 3.4.2 — Extrair para `src/services/qualidade.js` — [ ] Concluída
### 3.4.3 — Validar conformidade (AG-DOC)
- **Checklist**:
  - [ ] WIQL: Bug + Defect, State <> Removed
  - [ ] Filtro por tipo (Bug/Defect/ambos)
  - [ ] Filtro por estado (aberto/fechado/todos)
  - [ ] Filtro por severidade
  - [ ] Métricas de qualidade calculadas
  - [ ] Análise com IA usa dados dos bugs
- [ ] Concluída

### 3.4.4 — Revisar qualidade (AG-QUA) — [ ] Concluída
### 3.4.5 — Criar testes unitários (AG-UNI) — Cobertura: 80% — [ ] Concluída
### 3.4.6 — Verificar regressão (AG-REG) — [ ] Concluída
### 3.4.7 — Criar testes BDD (AG-UNI) — `tests/bdd/qualidade.feature.test.js` — [ ] Concluída

---

## Tarefa 3.5: Testes de Integração da FASE 3

**Agente**: AG-INT

### 3.5.1 — Fluxo Insights
- **Arquivo**: `tests/integration/insights-flow.test.js`
- **Fluxo**: Store.getSprintCache() → InsightsService.buildPrompt() → callLlm() → validateR0-R8()
- [ ] Concluída

### 3.5.2 — Fluxo Chat
- **Arquivo**: `tests/integration/chat-flow.test.js`
- **Fluxo**: Store.getActiveRag() → ChatService.buildChatPrompt() → sendMessage()
- [ ] Concluída

### 3.5.3 — Fluxo Eficiência
- **Arquivo**: `tests/integration/eficiencia-flow.test.js`
- **Fluxo**: AzureAPI.getIterations() → EficienciaService.filterByPeriod() → calculateMetrics()
- [ ] Concluída

### 3.5.4 — Fluxo Qualidade
- **Arquivo**: `tests/integration/qualidade-flow.test.js`
- **Fluxo**: AzureAPI._fetch() → QualidadeService.loadBugs() → filterByType() → calculateMetrics()
- [ ] Concluída

---

## Gate de Fase — Critérios para avançar para FASE 4

- [ ] **4 módulos de serviço** extraídos em `src/services/`
- [ ] **AG-DOC** aprovou conformidade dos 4 módulos
- [ ] **AG-QUA** aprovou qualidade dos 4 módulos
- [ ] **AG-UNI** — testes unitários passando com cobertura ≥ 80%
- [ ] **AG-REG** — zero regressões
- [ ] **AG-INT** — 4 fluxos de integração passando
- [ ] **`npm test`** — toda a suite passando
- [ ] Nenhum `BLOQUEIO` pendente
