# FASE 3: Módulos de Serviço — Tarefas

> **Risco**: Médio | **Dependências**: FASE 2 concluída (Vault, Store, AzureAPI) | **Agente Principal**: AG-EXT

---

## Pré-requisitos

- [x] FASE 2 concluída — Gate de fase aprovado
- [x] `src/core/vault.js`, `src/core/store.js`, `src/core/azure-api.js` extraídos e testados
- [x] Diretório `src/services/` criado
- [x] `npm test` — todos os testes passando

---

## Tarefa 3.1: Extrair Módulo Insights

**Agentes**: AG-EXT → AG-DOC → AG-QUA → AG-UNI → AG-REG

### 3.1.1 — Localizar código de Insights no monolito
- **Agente**: `AG-EXT`
- **Ação**: Buscar funções de geração de insights: `buildPrompt`, prompt templates, chamada LLM, parseResponse, validadores R0-R8, deduplicação, feedback
- [x] Concluída

### 3.1.2 — Extrair para `src/services/insights.js`
- **Agente**: `AG-EXT`
- **Ação**: Extrair toda lógica de insights, importar Store
- **Referência**: `docs/04_cenarios_bdd.md` (Feature: Insights de IA — 11 cenários)
- [x] Concluída

### 3.1.3 — Validar conformidade (AG-DOC)
- **Checklist**:
  - [x] buildPrompt usa dados reais da sprint (membros, alocação, bloqueios)
  - [x] Validador R0: folga de capacidade converte critical → info
  - [x] Validador R3: respeita RAG + alloc ≤ 100% → rebaixa; alloc > 100% → mantém
  - [x] Validador R7: consolida múltiplos criticals em 1
  - [x] Validador R8: injeta card para membro ocioso (< 70%)
  - [x] Deduplicação case-insensitive por título
  - [x] Feedback 👍/👎 salvo em `avai_insight_fb`
  - [x] Timeout de 90s
- [x] Concluída

### 3.1.4 — Revisar qualidade (AG-QUA) — [x] Concluída
### 3.1.5 — Criar testes unitários (AG-UNI) — Cobertura: 80%
- **Cenários**:
  - [x] buildPrompt com sprint completa
  - [x] validateR0 — com folga, sem folga
  - [x] validateR3 — RAG presente + alloc ≤ 100%, RAG presente + alloc > 100%
  - [x] validateR7 — 3 criticals → 1 consolidado
  - [x] validateR8 — membro com < 70% alloc sem card
  - [x] deduplicate — títulos iguais, case different
  - [x] parseResponse — JSON válido, texto livre, resposta vazia
- [x] Concluída

### 3.1.6 — Verificar regressão (AG-REG) — [x] Concluída
### 3.1.7 — Criar testes BDD (AG-UNI)
- **Arquivo**: `tests/bdd/insights.feature.test.js`
- **Cenários**: 11 cenários de `docs/04_cenarios_bdd.md` (Feature: Insights)
- [x] Concluída

---

## Tarefa 3.2: Extrair Módulo Chat

**Agentes**: AG-EXT → AG-DOC → AG-QUA → AG-UNI → AG-REG

### 3.2.1 — Localizar código de Chat no monolito
- **Agente**: `AG-EXT`
- **Ação**: Buscar funções do chat flutuante: conversas, envio, histórico, markdown parser, FAB, painel
- [x] Concluída

### 3.2.2 — Extrair para `src/services/chat.js`
- **Agente**: `AG-EXT`
- **Ação**: Lógica de negócio do chat (sem DOM rendering — isso vai para FASE 4)
- **Referência**: `docs/04_cenarios_bdd.md` (Feature: Chat IA — 10 cenários)
- [x] Concluída

### 3.2.3 — Validar conformidade (AG-DOC)
- **Checklist**:
  - [x] Contexto inclui dados do time + RAG
  - [x] Markdown renderizado corretamente (bold, lists, code)
  - [x] Histórico persistido em `avai_chat_convs`
  - [x] Detecção automática de nível de usuário (Técnico/Didático)
  - [x] Orquestração centralizada via `src/core/llm-api.js`
- [x] Concluída

### 3.2.4 — Revisar qualidade (AG-QUA) — [x] Concluída
### 3.2.5 — Criar testes unitários (AG-UNI) — Cobertura: 80%
- **Cenários**:
  - [x] buildContext — com sprint data, sem sprint data
  - [x] formatMessage (Markdown) — bold, italic, lists, code blocks, links
  - [x] analyzeUserLevel — detecção de termos técnicos vs didáticos
  - [x] sendMessage — integração com Store e LLMAPI
- [x] Concluída

### 3.2.6 — Verificar regressão (AG-REG) — [x] Concluída
### 3.2.7 — Criar testes BDD (AG-UNI)
- **Arquivo**: `tests/bdd/chat.feature.test.js`
- [x] Concluída

---

## Tarefa 3.3: Extrair Módulo Eficiência

**Agentes**: AG-EXT → AG-DOC → AG-QUA → AG-UNI → AG-REG

### 3.3.1 — Localizar código de Eficiência no monolito — [x] Concluída
### 3.3.2 — Extrair para `src/services/eficiencia.js` — [x] Concluída
### 3.3.3 — Validar conformidade (AG-DOC)
- **Checklist**:
  - [x] Filtro por período (3/6/12 meses) via startDate
  - [x] Throughput: itens Done / sprint
  - [x] Lead Time: CreatedDate → ClosedDate
  - [x] Cycle Time: ActivatedDate → ClosedDate
  - [x] Tempo por coluna (colTimes) com filtro outlier < 180d
  - [x] Dados para Chart.js formatados corretamente
- [x] Concluída

### 3.3.4 — Revisar qualidade (AG-QUA) — [x] Concluída
### 3.3.5 — Criar testes unitários (AG-UNI) — Cobertura: 80% — [x] Concluída
### 3.3.6 — Verificar regressão (AG-REG) — [x] Concluída
### 3.3.7 — Criar testes BDD (AG-UNI) — `tests/bdd/eficiencia.feature.test.js` — [x] Concluída

---

## Tarefa 3.4: Extrair Módulo Qualidade

**Agentes**: AG-EXT → AG-DOC → AG-QUA → AG-UNI → AG-REG

### 3.4.1 — Localizar código de Qualidade no monolito — [x] Concluída
### 3.4.2 — Extrair para `src/services/qualidade.js` — [x] Concluída
### 3.4.3 — Validar conformidade (AG-DOC)
- **Checklist**:
  - [x] Contagem Bugs/Defects (Abertos/Done/Total)
  - [x] Cálculo de Tempo Médio de Resolução (Lead Time do Bug)
  - [x] Lógica de Esforço Estimado (Σ max rem. histórico)
  - [x] Relação Bug ↔ Child Tasks para Defects
  - [x] Dados para Gráficos (Severity/Priority/State)
- [x] Concluída

### 3.4.4 — Revisar qualidade (AG-QUA) — [x] Concluída
### 3.4.5 — Criar testes unitários (AG-UNI) — Cobertura: 80% — [x] Concluída
### 3.4.6 — Verificar regressão (AG-REG) — [x] Concluída
### 3.4.7 — Criar testes BDD (AG-UNI) — `tests/bdd/qualidade.feature.test.js` — [x] Concluída

---

## Tarefa 3.5: Testes de Integração da FASE 3

**Agente**: AG-INT

### 3.5.1 — Fluxo Insights
- **Arquivo**: `tests/integration/insights-flow.test.js`
- **Fluxo**: LLMAPI.call (a1) → call (a2) → call (a3) → parseJson()
- [x] Concluída

### 3.5.2 — Fluxo Chat
- **Arquivo**: `tests/integration/chat-flow.test.js`
- **Fluxo**: ChatService.buildContext() → analyzeUserLevel() → sendMessage()
- [x] Concluída

### 3.5.3 — Fluxo Eficiência
- **Arquivo**: `tests/integration/eficiencia-flow.test.js`
- **Fluxo**: AzureAPI.getIterations() → EficienciaService.filterByPeriod() → calculateMetrics()
- [x] Concluída

### 3.5.4 — Fluxo Qualidade
- **Arquivo**: `tests/integration/qualidade-flow.test.js`
- **Fluxo**: AzureAPI.getQualityItemIds() → QualidadeService.fetchQualityData() → calculateMetrics()
- [x] Concluída

---

## Gate de Fase 3 — [x] Aprovado
- [x] Todos os serviços extraídos com paridade funcional
- [x] Testes Unitários com >80% de cobertura
- [x] Cenários BDD validados para cada serviço
- [x] Testes de Integração cobrindo fluxos de ponta a ponta
- [x] Documentação técnica atualizada
- [x] **AG-DOC** aprovou conformidade dos 4 módulos
- [x] **AG-QUA** aprovou qualidade dos 4 módulos
- [x] **AG-UNI** — testes unitários passando com cobertura ≥ 80%
- [x] **AG-REG** — zero regressões
- [x] **AG-INT** — 4 fluxos de integração passando
- [x] **`npm test`** — toda a suite passando
- [x] Nenhum `BLOQUEIO` pendente
