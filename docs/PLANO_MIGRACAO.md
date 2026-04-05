# Plano de Migração para Modularização — AgileViewAI

## 📋 Visão Geral

Este documento descreve o plano passo a passo para modularizar o código monolítico do `agileviewai2.3.html` (**4.937 linhas**, ~322 KB) em módulos independentes e testáveis, utilizando testes BDD como guia.

O monolito consiste em:
- **~650 linhas** de CSS inline (`<style>`)
- **~750 linhas** de HTML (markup do app)
- **~3.500 linhas** de JavaScript (funções globais, sem classes)
- **1 dependência externa**: Chart.js via CDN

## 🎯 Objetivos

- **Quebrar o monolito** em módulos coesos e independentes
- **Manter funcionalidade 100% intacta** durante o processo
- **Criar testes BDD** para validar cada módulo
- **Facilitar manutenção** e evolução futura
- **Preparar para deploy** em ambiente moderno (Vite ou bundle)

## 📊 Análise da Estrutura Atual

### Arquitetura do Monolito

O código **não usa classes**. Toda a lógica está em funções globais e objetos literais definidos inline no `<script>`. Os principais namespaces/padrões identificados:

- `Vault` — objeto literal com métodos de criptografia
- `Store` — conjunto de funções `_g()` / `_s()` para localStorage
- `AzureAPI` — funções `_fetch()`, `getIterations()`, etc.
- `APP` — objeto global de estado da aplicação
- Funções globais avulsas: `showPanel()`, `runSync()`, `renderDashboard()`, etc.

### Módulos Identificados no Código Monolítico

| Módulo | Linhas (aprox.) | Responsabilidades | Dependências |
|--------|----------------|-------------------|--------------|
| **CSS/Estilos** | ~650 | Design system, responsividade, animações | Nenhuma |
| **Vault** | ~80 | Criptografia AES-256-GCM, PIN, salt, derive key | Crypto API, localStorage |
| **Store** | ~60 | Persistência localStorage com prefixo `avai_` | localStorage |
| **AzureAPI** | ~250 | Comunicação Azure DevOps (iterations, WIQL, capacity) | Fetch API, Store |
| **Dashboard** | ~800 | KPIs, backlog table, progress panel, filtros | DOM, Store, AzureAPI |
| **Insights** | ~600 | Geração insights IA, validação (R0-R8), deduplicação | LLM APIs, Store |
| **Chat** | ~400 | Chat flutuante com IA, conversas, histórico | DOM, LLM APIs, Store |
| **Eficiência** | ~350 | Análise multi-sprint, throughput, lead/cycle time | Chart.js, Store, AzureAPI |
| **Qualidade** | ~300 | Análise de bugs/defects, severidade, gráficos | Chart.js, Store, AzureAPI |
| **UI/Helpers** | ~200 | Toast, modais, tooltips KPI, utils de data | DOM |
| **Event Handlers** | ~250 | Navegação, toggles, dropdowns, filtros | Todos os módulos |

---

## 🔄 Plano de Migração — Fases

### **FASE 1: Fundação e Testes** ✅

**Status**: Concluída

- [x] Análise estrutura atual (4.937 linhas)
- [x] Criação estrutura de testes BDD
- [x] Setup ambiente de testes (Jest + jsdom)
- [x] Testes BDD iniciais: Vault (7 cenários), Times (5 cenários), Sync (6 cenários)

**Entregáveis**:
- `tests/bdd/vault.feature.test.js` — 7 cenários
- `tests/bdd/times.feature.test.js` — 5 cenários
- `tests/bdd/sync.feature.test.js` — 6 cenários
- `tests/setup.js` — mocks globais (localStorage, crypto, DOM, APP, Vault, Store, AzureAPI)
- `package.json` — scripts de teste, Jest config

---

### **FASE 2: Módulos Core (Baixo Risco)**

**Ordem**: Vault → Store → AzureAPI
**Risco**: Baixo (módulos puros, sem dependências de UI)

#### 2.1 Módulo Vault
```javascript
// src/core/vault.js
// Extração das funções Vault do monolito
// Padrão: objeto exportado (mantém compatibilidade com código existente)
export const Vault = {
  async deriveKey(pin, saltBuf) { /* PBKDF2, 600k iterações */ },
  async encrypt(key, plaintext) { /* AES-256-GCM */ },
  async decrypt(key, b64) { /* AES-256-GCM */ },
  getSalt() { /* localStorage avai_vault_salt */ },
  isSetup() { /* verifica existência de salt + check */ },
  async setupPin(pin) { /* gera salt, derive key, salva check */ },
  async verifyPin(pin) { /* decifra check, retorna key ou null */ },
  async encryptToken(key, token) { /* cifra token individual */ },
  async decryptToken(key, b64) { /* decifra token individual */ },
  async reencryptAll(oldKey, newKey) { /* recifra todos os tokens */ }
};
```

**Passos**:
1. Extrair bloco Vault do `<script>` para `src/core/vault.js`
2. Adicionar `export` ao objeto
3. Ajustar `tests/bdd/vault.feature.test.js` para importar módulo real
4. Adicionar testes unitários para edge cases (salt inválido, dados corrompidos)
5. No HTML principal: `import { Vault } from './src/core/vault.js'`
6. Validar funcionalidade intacta

#### 2.2 Módulo Store
```javascript
// src/core/store.js
export const Store = {
  _g(key, def = []) { /* JSON.parse(localStorage.getItem(key)) */ },
  _s(key, val) { /* localStorage.setItem(key, JSON.stringify(val)) */ },
  getTeams() { return this._g('avai_teams', []); },
  saveTeams(t) { this._s('avai_teams', t); },
  getOrgs() { return this._g('avai_orgs', []); },
  saveOrgs(o) { this._s('avai_orgs', o); },
  getLlmList() { /* ... */ },
  saveLlmList(l) { /* ... */ },
  getRagList() { /* ... */ },
  saveRagList(r) { /* ... */ },
  getChatConvs() { /* ... */ },
  saveChatConvs(c) { /* ... */ },
  getInsightFeedback() { /* ... */ },
  saveInsightFeedback(fb) { /* ... */ },
  getUserProfile() { /* ... */ },
  saveUserProfile(p) { /* ... */ },
  getSprintCache() { /* ... */ },
  saveSprintCache(c) { /* ... */ },
  getActiveTeamId() { /* ... */ },
  setActiveTeamId(id) { /* ... */ },
  getActiveTeam() { /* ... */ },
  getActivePat(key) { /* decifra PAT da org ativa */ },
  getActiveLlm() { /* ... */ },
  getActiveLlmToken(key) { /* decifra token LLM ativo */ },
  getActiveRag() { /* concatena contextos RAG ativos */ },
  getAgentPrompts() { /* ... */ },
  saveAgentPrompts(p) { /* ... */ }
};
```

#### 2.3 Módulo AzureAPI
```javascript
// src/core/azure-api.js
import { Store } from './store.js';

export const AzureAPI = {
  async _fetch(url, pat) { /* fetch com auth Basic */ },
  _encTeam(team) { /* codifica cada palavra com %20 */ },
  async getIterations(org, proj, team, pat) { /* GET teamsettings/iterations */ },
  async getTeamCapacity(org, proj, team, iterationId, pat) { /* capacidade + daysOff */ },
  async getWorkItemIds(org, proj, team, iterationPath, pat) { /* WIQL query */ },
  async getWorkItemDetails(org, ids, pat) { /* lotes de 200 */ },
  async getWorkItemRevisions(org, id, pat) { /* histórico para estimativa */ }
};
```

---

### **FASE 3: Módulos de Serviço (Médio Risco)**

**Ordem**: Insights → Chat → Eficiência → Qualidade
**Risco**: Médio (dependem de core e têm lógica de negócio complexa)

#### 3.1 Módulo Insights
```javascript
// src/services/insights.js
import { Store } from '../core/store.js';

export const InsightsService = {
  buildPrompt(sprintData, ragContext) { /* monta prompt A1 com dados reais */ },
  async callLlm(prompt, provider, token) { /* chamada ao LLM */ },
  parseResponse(raw) { /* extrai cards JSON do response */ },
  // Validadores pós-processamento
  validateR0(cards, totalRem, capTotal) { /* folga de capacidade */ },
  validateR3(cards, ragContext, memberAllocs) { /* contexto RAG */ },
  validateR7(cards) { /* consolida múltiplos criticals */ },
  validateR8(cards, members) { /* injeta card para membro ocioso */ },
  deduplicate(existing, newCards) { /* case-insensitive por título */ }
};
```

#### 3.2 Módulo Chat
```javascript
// src/services/chat.js
import { Store } from '../core/store.js';

export const ChatService = {
  buildChatPrompt(message, sprintData, history) { /* contexto + histórico */ },
  async sendMessage(message, context) { /* chamada LLM */ },
  parseMarkdown(raw) { /* converte MD para HTML seguro */ },
  createConversation() { /* novo ID + timestamp */ },
  loadConversation(id) { /* carrega do Store */ },
  saveConversation(conv) { /* salva no Store */ },
  deleteConversation(id) { /* remove do Store */ }
};
```

#### 3.3 Módulo Eficiência
```javascript
// src/services/eficiencia.js
import { AzureAPI } from '../core/azure-api.js';
import { Store } from '../core/store.js';

export const EficienciaService = {
  filterByPeriod(iterations, months) { /* filtra por startDate */ },
  calculateThroughput(iterations) { /* itens Done por sprint */ },
  calculateLeadTime(items) { /* CreatedDate → ClosedDate */ },
  calculateCycleTime(items) { /* ActivatedDate → ClosedDate */ },
  calculateColTimes(items) { /* tempo por coluna, filtro outlier < 180d */ },
  buildChartData(metrics) { /* dados para Chart.js */ }
};
```

#### 3.4 Módulo Qualidade
```javascript
// src/services/qualidade.js
import { AzureAPI } from '../core/azure-api.js';
import { Store } from '../core/store.js';

export const QualidadeService = {
  async loadBugs(org, proj, pat) { /* WIQL: Bug + Defect, exceto Removed */ },
  filterByType(items, tipo) { /* Bug, Defect, ambos */ },
  filterByState(items, estado) { /* aberto, fechado, todos */ },
  filterBySeverity(items, severity) { /* Critical, High, Medium, Low */ },
  calculateMetrics(items) { /* KPIs de qualidade */ },
  buildChartData(items) { /* dados para Chart.js */ }
};
```

---

### **FASE 4: Componentes UI (Alto Risco)**

**Ordem**: Helpers/Utils → Componentes base → Dashboard → Telas específicas
**Risco**: Alto (manipulação DOM, eventos, estado visual)

#### 4.1 Helpers e Utilitários
```javascript
// src/utils/helpers.js
export function toast(msg, type = '') { /* toast notification */ }
export function formatHours(h) { /* 8.5 → "8,5h" */ }
export function formatDate(d) { /* Date → "dd/mm" */ }
export function bizDaysLeft(endDate) { /* dias úteis via Date.UTC */ }
export function initials(name) { /* "João Silva" → "JS" */ }
export function statusClass(state) { /* "In Progress" → "s-doing" */ }
export function blockStatus(item) { /* verifica Custom.Block ou tags */ }
```

#### 4.2 Componentes de Renderização
```javascript
// src/components/dashboard.js
import { Store } from '../core/store.js';
import * as helpers from '../utils/helpers.js';

export function renderKPIs(sprintData) { /* grid de KPIs */ }
export function renderBacklog(items, filter) { /* tabela backlog expandível */ }
export function renderProgress(sprintData) { /* painel lateral direito */ }
export function renderMembers(members) { /* tabela de membros com alocação */ }
export function renderInsightsSection(cards) { /* grid de insight cards */ }
```

#### 4.3 Navegação e Eventos
```javascript
// src/components/navigation.js
export function showPanel(panelId) { /* sidebar + mobile nav */ }
export function showModule(moduleId) { /* abas Sprint/Eficiência/Qualidade */ }
export function initNavigation() { /* bind listeners */ }
export function initMobileNav() { /* bottom nav + responsividade */ }
```

---

### **FASE 5: CSS e Design System**

**Objetivo**: Extrair CSS do `<style>` inline para arquivo externo

#### 5.1 Extração CSS
```
src/styles/
├── variables.css      # :root com custom properties
├── base.css           # reset, typography, buttons
├── layout.css         # #app, #sidebar, #main-content
├── vault.css          # .vbox, .vinput, .vbtn
├── dashboard.css      # .kpi-grid, .bl-table, .db-body
├── insights.css       # .ins-grid, .ins-card
├── chat.css           # .fc-fab, .fc-panel
├── eficiencia.css     # .ef-filter-bar, .ef-kpi-grid
├── qualidade.css      # .qual-header, .qkpi
├── responsive.css     # @media queries (tablet + mobile)
└── index.css          # @import de todos os arquivos
```

---

### **FASE 6: Integração e App Principal**

**Objetivo**: Integrar todos os módulos num ponto de entrada único

#### 6.1 Ponto de Entrada
```javascript
// src/app.js
import { Vault } from './core/vault.js';
import { Store } from './core/store.js';
import { AzureAPI } from './core/azure-api.js';
import { InsightsService } from './services/insights.js';
import { ChatService } from './services/chat.js';
import { EficienciaService } from './services/eficiencia.js';
import { QualidadeService } from './services/qualidade.js';
import * as Dashboard from './components/dashboard.js';
import { initNavigation } from './components/navigation.js';

// Estado global da aplicação
const APP = {
  vaultKey: null,
  vaultMode: null,
  sprintData: null,
  insightCards: [],
  syncRunning: false,
  allIterations: [],
  eficienciaData: null,
  efChartMode: { flow: 'throughput', time: 'lead' },
  qualidadeData: null,
  qualTipo: 'ambos',
  qualEstado: 'aberto',
  qualSeverity: 'todas',
  sessionTokens: { teams: {}, llms: {}, orgs: {} },
  chatConvId: null,
  chatMessages: []
};

async function init() {
  initNavigation();
  // Vault flow...
}

init();
```

#### 6.2 HTML Modularizado
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AgileViewAI v3.0</title>
  <link rel="stylesheet" href="src/styles/index.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
</head>
<body>
  <!-- HTML existente (sem <style> inline) -->
  <script type="module" src="src/app.js"></script>
</body>
</html>
```

---

## 🧪 Estratégia de Testes

### Cobertura de Cenários BDD (docs/04_cenarios_bdd.md)

| Feature | Cenários no BDD Doc | Testes Implementados | Status |
|---------|---------------------|---------------------|--------|
| **Vault** | 9 cenários | 9 testes | ✅ Concluído |
| **Times** | 6 cenários | 6 testes | ✅ Concluído |
| **Sync** | 13 cenários | 13 testes | ✅ Concluído |
| **Dashboard** | 13 cenários | 0 testes | 🔴 Não iniciado |
| **Insights IA** | 11 cenários | 0 testes | 🟡 Em Progresso (Unitários OK) |
| **Chat IA** | 10 cenários | 0 testes | 🔴 Não iniciado |
| **Eficiência** | 5 cenários | 0 testes | 🔴 Não iniciado |
| **Qualidade** | 3 cenários | 0 testes | 🔴 Não iniciado |
| **RAG/Treinamento** | 6 cenários | 0 testes | 🔴 Não iniciado |
| **Export** | 5 cenários | 0 testes | 🔴 Não iniciado |
| **Responsividade** | 6 cenários | 0 testes | 🔴 Não iniciado |
| **TOTAL** | **87 cenários** | **28 testes** | **32% cobertura** |

### Testes por Fase

| Fase | Tipo de Teste | Cobertura Alvo | Ferramenta |
|------|---------------|----------------|------------|
| FASE 2 | Unitários (core) | 90%+ | Jest + jsdom |
| FASE 3 | Integração (serviços) | 80%+ | Jest + mocks |
| FASE 4 | Componentes UI | 70%+ | Jest + jsdom |
| FASE 5 | Visual (CSS) | Manual | Browser |
| FASE 6 | E2E / Regressão | 95%+ | Cypress ou Playwright |

### 🛡️ Prevenção de Anti-patterns BDD
Para evitar falsas seguranças identificadas na Fase 1, o agente de testes **deve obrigatoriamente** revisar e garantir durante a escrita ou refatoração:
1. **Zero Falsos Positivos**: Testes devem atuar no SUT (System Under Test) verdadeiro e nunca verificar apenas se o mock salvou a variável nele mesmo.
2. **Zero Sangramento de Lógica**: Teste não é app. Toda lógica condicional de apresentação (`if DOM_ready`) deve estar no Módulo ou Fachada (`APP`), nunca chumbado no próprio `test.js`.
3. **Validação Estrita do Gherkin**: Não deixe passar cenários cujos "Then" exigiam uma lista abrangente de efeitos colaterais e o teste avaliou apenas 1 deles.

### Próximos Testes BDD a Implementar

**Prioridade Alta** (alinhados com FASE 2):
- `tests/bdd/vault-avancado.feature.test.js` — Limpar vault, Apagar tudo
- `tests/bdd/sync-avancado.feature.test.js` — Dias úteis UTC, estimativa via revisões, daysOff, bloqueio

**Prioridade Média** (alinhados com FASE 3):
- `tests/bdd/dashboard.feature.test.js` — KPIs, filtros, ordenação, expand
- `tests/bdd/insights.feature.test.js` — Validadores R0-R8, deduplicação, feedback
- `tests/bdd/chat.feature.test.js` — Envio, histórico, double-submit, timeout

**Prioridade Baixa** (alinhados com FASE 4-6):
- `tests/bdd/eficiencia.feature.test.js` — Throughput, lead/cycle time, outliers
- `tests/bdd/qualidade.feature.test.js` — Bugs, filtros, análise IA
- `tests/bdd/rag.feature.test.js` — Contextos, escopo, prompt customizado
- `tests/bdd/export.feature.test.js` — HTML offline, impressão, config export
- `tests/e2e/responsividade.test.js` — Mobile, tablet, bottom nav

---

## 📦 Estrutura de Diretórios Final

```
AgileViewAI-SPRINT-MVP/
├── src/
│   ├── core/
│   │   ├── vault.js          # Criptografia e autenticação
│   │   ├── store.js          # Persistência localStorage
│   │   └── azure-api.js      # Comunicação Azure DevOps
│   ├── services/
│   │   ├── insights.js       # Geração e validação de insights IA
│   │   ├── chat.js           # Chat flutuante com IA
│   │   ├── eficiencia.js     # Análise multi-sprint
│   │   └── qualidade.js      # Análise de bugs/defects
│   ├── components/
│   │   ├── dashboard.js      # Renderização dashboard sprint
│   │   ├── navigation.js     # Sidebar, bottom nav, panels
│   │   └── modals.js         # Modais de criação/edição
│   ├── utils/
│   │   ├── helpers.js        # Toast, formatação, status
│   │   ├── date.js           # Funções de data (bizDays, UTC)
│   │   └── markdown.js       # Parser MD → HTML para chat
│   ├── styles/
│   │   ├── variables.css
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── vault.css
│   │   ├── dashboard.css
│   │   ├── insights.css
│   │   ├── chat.css
│   │   ├── eficiencia.css
│   │   ├── qualidade.css
│   │   ├── responsive.css
│   │   └── index.css
│   └── app.js                # Ponto de entrada
├── tests/
│   ├── bdd/
│   │   ├── vault.feature.test.js     ✅
│   │   ├── times.feature.test.js     ✅
│   │   ├── sync.feature.test.js      ✅
│   │   ├── dashboard.feature.test.js 🔴
│   │   ├── insights.feature.test.js  🔴
│   │   ├── chat.feature.test.js      🔴
│   │   ├── eficiencia.feature.test.js 🔴
│   │   ├── qualidade.feature.test.js  🔴
│   │   └── rag.feature.test.js        🔴
│   ├── unit/                         # Testes unitários por módulo
│   ├── integration/                  # Testes de integração
│   ├── e2e/                          # Testes end-to-end
│   └── setup.js                      ✅
├── docs/                             # Documentação
├── agileviewai2.3.html               # Legado (mantido para rollback)
├── index.html                        # Novo ponto de entrada
└── package.json
```

---

## ⚠️ Mitigação de Riscos

### Riscos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Quebra de funcionalidade DOM | Alta | Alto | Testes por componente, comparação visual |
| Funções globais órfãs | Média | Médio | Grep exaustivo de `onclick=`, `on*=` no HTML |
| Performance regressão (módulos) | Baixa | Médio | Benchmarks antes/depois |
| Dados perdidos no localStorage | Baixa | Crítico | Backup automático, schema versioning |
| Chart.js incompatibilidade | Baixa | Baixo | Manter CDN, não modularizar Chart.js |
| CSS cascade breakage | Média | Alto | Manter seletores originais, testar responsivo |

### Pontos de Atenção Específicos

1. **`onclick=` inline no HTML**: O monolito usa extensivamente `onclick="funcaoGlobal()"`. Ao modularizar, estas funções precisam permanecer no escopo global ou ser substituídas por `addEventListener`.

2. **`APP` como estado global**: Muitas funções leem/escrevem diretamente `APP.sprintData`, `APP.syncRunning`, etc. O objeto precisa ser injetável ou exportado do `app.js`.

3. **Chart.js**: Carregado via CDN como global. Não precisa ser modularizado, mas os gráficos dependem de `<canvas>` no DOM.

### Estratégia de Rollback

1. **Versionamento**: Cada fase em branch Git separado
2. **Backup**: `agileviewai2.3.html` original sempre disponível
3. **Teste A/B**: `index.html` (novo) vs `agileviewai2.3.html` (legado) lado a lado
4. **Monitoramento**: Console errors + localStorage integrity check

---

## 📈 Métricas de Sucesso

### Técnicas
- [ ] Coverage de testes > 85%
- [ ] Zero regressões funcionais
- [ ] Todos os 87 cenários BDD com testes
- [ ] Build time < 30s (se usar bundler)
- [ ] Bundle size < 500KB (gzipped)
- [ ] Lighthouse performance > 90

### Negócio
- [ ] Tempo de deploy reduzido 80%
- [ ] Bugs novos reduzidos 60%
- [ ] Developer experience melhorada (hot reload, IntelliSense)
- [ ] Onboarding de novos devs < 1 dia

---

## 🚀 Próximos Passos

### Imediato (Esta semana)
1. **Instalar dependências**: `npm install`
2. **Executar testes**: `npm test`
3. **Validar setup BDD**: Todos os 18 testes passando
4. **Completar testes faltantes**: vault-avançado, sync-avançado

### Curto Prazo (2 semanas)
1. **Implementar FASE 2**: Extrair Vault → Store → AzureAPI
2. **Ajustar testes para imports reais** (não mocks)
3. **Testes unitários completos** dos módulos core
4. **Integração gradual** no HTML

### Médio Prazo (1 mês)
1. **Completar FASE 3**: Serviços (Insights, Chat, Eficiência, Qualidade)
2. **FASE 4**: Componentes UI
3. **FASE 5**: CSS extraction
4. **Testes de integração e E2E**

### Longo Prazo (2 meses)
1. **FASE 6**: Integração final + app.js
2. **Migrar para bundler** (Vite recomendado)
3. **Deploy pipeline** (CI/CD com testes automáticos)
4. **Documentação API** dos módulos

---

## 📞 Contingência

### Se algo der errado:
1. **Parar imediatamente** o processo de migração
2. **Restaurar** `agileviewai2.3.html` como ponto de entrada
3. **Analisar logs** de erro no console
4. **Comparar** comportamento novo vs legado
5. **Corrigir** antes de continuar
6. **Re-testar** completamente com `npm test`

### Critérios de Go/No-Go por Fase
- **Go**: Todos os testes passando + funcionalidade visual intacta
- **No-Go**: Qualquer falha em testes críticos (Vault, Store, Sync)
- **Rollback trigger**: > 3 bugs de regressão em funcionalidades core

---

**Última atualização**: 04 de Abril de 2026
**Responsável**: Time de Engenharia
**Status**: FASE 2 concluída — FASE 3 em progresso (Insights)
