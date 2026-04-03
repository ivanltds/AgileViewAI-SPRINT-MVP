# AgileViewAI — Solução Técnica

---

## 1. Visão Geral da Arquitetura

AgileViewAI v2.x é uma **Single File Application (SFA)** — toda a lógica, estilos e templates estão em um único arquivo HTML. Opera completamente no browser do usuário, sem backend próprio.

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (SFA)                            │
│                                                             │
│  ┌───────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │   APP STATE   │  │    VAULT       │  │    STORE      │  │
│  │  (JS object)  │  │ AES-256-GCM   │  │ localStorage  │  │
│  └───────────────┘  └────────────────┘  └───────────────┘  │
│                                                             │
│  ┌───────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │  AzureAPI     │  │  LLM APIs      │  │ DataProcessor │  │
│  │ (REST client) │  │ (fetch)        │  │ (calculator)  │  │
│  └───────┬───────┘  └───────┬────────┘  └───────┬───────┘  │
│          │                  │                   │           │
└──────────┼──────────────────┼───────────────────┼───────────┘
           │                  │                   │
   Azure DevOps API    OpenAI / Claude /    (interno)
   REST v7.1           Gemini API
```

---

## 2. Módulos JavaScript

### 2.1 `APP` — Estado Global

```javascript
const APP = {
  vaultKey: null,          // CryptoKey AES-256-GCM derivada do PIN
  vaultMode: null,         // 'pin' | 'session'
  sprintData: null,        // dados da última sincronização
  insightCards: [],        // cards de insight exibidos (deduplicação)
  syncRunning: false,      // flag de sincronização em andamento
  allIterations: [],       // todas as iterações do time
  eficienciaData: null,    // resultado do cálculo de eficiência
  efChartMode: { flow:'throughput', time:'lead' },
  qualidadeData: null,     // resultado do módulo qualidade
  qualTipo: 'ambos',       // filtro tipo bugs globais
  sessionTokens: { teams:{}, llms:{}, orgs:{} },
  chatConvId: null,        // ID UUID da conversa ativa
  chatMessages: [],        // mensagens da conversa atual
};
```

### 2.2 `Vault` — Criptografia

```javascript
Vault.deriveKey(pin, saltBuf)
  // PBKDF2, 600.000 iterações, SHA-256 → CryptoKey AES-GCM 256-bit

Vault.encrypt(key, plaintext)
  // IV aleatório 12 bytes + AES-GCM encrypt → base64(IV || ciphertext)

Vault.decrypt(key, b64)
  // base64 decode → IV[:12] + decrypt AES-GCM → plaintext

Vault.setupPin(pin)      // primeira configuração
Vault.verifyPin(pin)     // login subsequente
Vault.encryptToken(plain) // usa APP.vaultKey
Vault.decryptToken(cipher)
Vault.reencryptAll(oldKey, newKey) // troca de PIN
```

**Fluxo de verificação do PIN:**
1. `getSalt()` — lê ou gera salt (16 bytes, base64, no localStorage)
2. `deriveKey(pin, salt)` — deriva chave com PBKDF2
3. `decrypt(key, avai_vault_check)` — se `=== 'avai_ok'`, PIN correto

### 2.3 `Store` — Persistência

```javascript
// Getters/Setters para localStorage com JSON.parse/stringify seguro
Store.getTeams() / saveTeams(v)
Store.getOrgs() / saveOrgs(v)
Store.getLlmList() / saveLlmList(v)
Store.getRagList() / saveRagList(v)
Store.getChatConvs() / saveChatConvs(v)
Store.getInsightFeedback() / saveInsightFeedback(v)
Store.getUserProfile() / saveUserProfile(v)
Store.getSprintCache() / saveSprintCache(v)
Store.getActiveTeamId() / setActiveTeamId(id)
Store.getActiveTeam()

// Async (decifragem de tokens)
Store.getActivePat()    // decifra PAT do time ativo (ou org)
Store.getActiveLlmToken() // decifra token do LLM ativo

// RAG context builder
Store.getActiveRag()
  // filtra por escopo: team-specific primeiro, depois general
  // formata: "## tipo\nspecificação" por linha
  // join com "\n\n"

Store.getAgentPrompts() / saveAgentPrompts(v)
```

**Modo sessão:**
```javascript
// Tokens ficam apenas em APP.sessionTokens (in-memory)
APP.sessionTokens.teams[teamId] = 'PAT_plain'
APP.sessionTokens.llms[llmId]  = 'token_plain'
```

### 2.4 `AzureAPI` — Cliente HTTP

```javascript
// Autenticação: Basic Auth com PAT
_auth(pat) → { 'Authorization': 'Basic ' + btoa(':' + pat) }

// Encoding seguro de team name (por palavra, não string completa)
_encTeam(t) → t.split(' ').map(encodeURIComponent).join('%20')

// Endpoints utilizados
getIterations(org, proj, team, pat)
  // GET /{org}/{proj}/{team}/_apis/work/teamsettings/iterations?api-version=7.1

getTeamCapacity(org, proj, team, iterationId, pat)
  // GET /{org}/{proj}/{team}/_apis/work/teamsettings/iterations/{id}/capacities

getWorkItemIds(org, proj, iterationPath, pat)
  // POST /_apis/wit/wiql (WIQL SELECT)

getWorkItemsBatch(org, proj, ids, pat)
  // GET /_apis/wit/workitems?ids={chunk}&fields={fields}
  // Chunks de 200 IDs
```

### 2.5 `DataProcessor` — Processamento da Sprint

```javascript
DataProcessor.sync()
  // Orquestra: getIterations → identifica sprint ativa → getWorkItemIds
  // → getWorkItemsBatch → _fetchMaxRem → getTeamCapacity
  // → _calcStats → Store.saveSprintCache

DataProcessor._blockStatus(item)
  // Verifica: Custom.Block, Tags, State
  // Retorna: 'BLOCKED' | 'FIXING' | 'CLEAR'

DataProcessor._parseDaysOff(cap)
  // Itera range de datas UTC; exclui sábado/domingo
  // Retorna: ['DD/MM', 'DD/MM', ...]

DataProcessor._bizDays(startMs, endMs)
  // Loop UTC; conta apenas dias úteis (segunda a sexta)

DataProcessor._calcStats(backlog, tasks, capacity, bizDays, todayMs)
  // Calcula: total, done, blocked, fixing, inProgress, donePct
  //          totalRem, totalTasksDone, totalTasksOpen
  //          capacityTotal, allocPct (min 999%)
  //          byMember, byActivity, dayOffCards
```

### 2.6 `EficienciaProcessor` — Cálculo de Eficiência

```javascript
EficienciaProcessor.compute(items, org, proj, pat, currentCap)
  // Para cada item Done:
  //   - Agrupa por iteração: count, points, leadTimes[], cycleTimes[]
  //   - Lead Time = ClosedDate - CreatedDate
  //   - Cycle Time = ClosedDate - ActivatedDate
  //
  // Board column time:
  //   Para cada item Done: getRevisions → calcula delta por coluna
  //   Filtra: coluna não Done/Closed/Resolved, delta 0-180 dias
  //
  // Retorna: {avgThroughput, avgLeadTime, avgCycleTime, iterLabels, byIter, colTimes}
```

---

## 3. Engine de Insights de IA

### 3.1 Fluxo de Chamada

```
callLlmWithData()
  │
  ├── Lee APP.sprintData
  ├── Monta system prompt (persona + regras + formato + exemplos + checklist)
  ├── Monta user prompt (dados variáveis):
  │     - Prioridade 1: RAG context
  │     - Prioridade 2: dados numéricos individuais
  │     - Diagnóstico macro pré-calculado (FOLGA/SAUDÁVEL/ATENÇÃO/RISCO REAL)
  │     - Lista de sobrecarregados (>100%)
  │     - Lista de ociosos (<70%)
  │     - Capacidade e remaining por membro
  │     - Capacidade por tipo de atividade
  │     - Backlog e tasks
  │
  ├── _callLlmRaw(provider, system, user)
  │     ├── Claude:  POST api.anthropic.com/v1/messages
  │     │            {model, max_tokens:1400, temperature:0.2, system, messages:[{role:'user',content}]}
  │     ├── OpenAI:  POST api.openai.com/v1/chat/completions
  │     │            {model, messages:[{role:'system'},{role:'user'}], temperature:0.2, max_tokens:1400}
  │     └── Gemini:  POST generativelanguage.googleapis.com/v1beta/...
  │                  {systemInstruction, contents, generationConfig:{temperature:0.2}}
  │
  ├── _parseInsightJson(raw)
  │     ├── Extrai JSON array (indexOf '[' … ']')
  │     ├── Tenta JSON.parse
  │     ├── Fallback: texto puro → card info
  │     ├── Detecta placeholders ("Explique em 1 frase...")
  │     └── Normaliza objeto OpenAI { } → [ { } ]
  │
  └── _validateInsights(insights, stats, capacity, ragContext)
```

### 3.2 Validador Determinístico (R0-R8)

O validador processa cada insight gerado pelo LLM com regras em sequência:

```
Pré-cálculo:
  memberAlloc = { membro: { alloc%, cap, rem, activity } }
  ragLower = ragContext.toLowerCase()
  regra0Fired = false

Para cada insight → aplica R0, R1, R2, R3, R5 → resultado (ou null)

Pós-processamento:
  R8 (post-map): membros <70% não citados → injeta cards
  R6 (post-map): membros >100% não citados → complementa
  R7 (final): múltiplos critical → consolida em 1
  dedup: títulos iguais (case-insensitive, trim) → remove duplicatas
```

| Regra | Condição de Disparo | Ação |
|---|---|---|
| **R0** | `totalRem < capTotal` E insight não cita membro E severity ∈ {critical,warning} | Converte para `info`, título "Capacidade com folga", body com % de folga; só dispara 1x (flag) |
| **R1** | `critical` E body cita "total"/"equipe" E sem membro E allocPct < 100% | Rebaixa para `info` |
| **R2** | `critical` E nenhum membro com alloc >100% nos dados E não é bloqueio | Rebaixa para `warning` |
| **R3** | `critical`/`warning` E body menciona membro E RAG menciona esse membro + palavras-chave (alinhado/negociado/próxima sprint) dentro de ±200 chars E alloc ≤100% | Rebaixa para `ok` (sobrecarga real nunca rebaixada) |
| **R5** | `ok`/`info` E body usa linguagem de conformidade E membro citado tem alloc <70% | Rebaixa para `warning` |
| **R6** | Membro com alloc >100% não citado em nenhum card existente | Complementa card critical existente ou cria novo |
| **R7** | Mais de 1 card `critical` | Mescla todos em 1 card com bodies concatenados por " \| " |
| **R8** | Membro com alloc <70% não coberto em nenhum card | Injeta card `warning` por papel com rem, cap, % |

### 3.3 Agentes Multi-passo (A1/A2/A3)

```
A1 (Analista) → gera 6-10 insights brutos
     ↓
A2 (Revisor)  → lista os insights do A1 no user prompt e pede revisão
                - Remove duplicatas
                - Corrige severidades incoerentes
                - Mantém 4-7 insights de alta qualidade
     ↓
A3 (Comunicador) → lista os insights revisados e reescreve
                   - Aplica tom adequado à severidade
                   - Mantém dados e números intactos
                   - Reescreve apenas title e body
     ↓
Validador R0-R8 → correção determinística final
```

### 3.4 Prompts — System Prompt de Insights

**Estrutura do System Prompt:**
1. **Persona:** "Agile Master sênior comprometido com entrega"
2. **Regras invioláveis:**
   - Limites de alocação (>100% critical, 70-100% saudável, <70% warning)
   - Skill Matching (nunca redistribuir entre papéis diferentes)
   - Days off e ausências
   - Contexto do time (prioridade máxima sobre análise genérica)
   - Análise por membro (nunca por totais)
3. **Formato obrigatório:** array JSON com campos: severity, section, icon, title, body
4. **Severidades e estrutura de saída:**
   - 1 card `critical` consolidando TODOS >100% (ou 0 se nenhum)
   - Oportunidades por papel (<70%)
   - Risks e ausências
   - Conformidade
5. **Exemplos few-shot:** casos reais com nomes e números
6. **Checklist:** 6 verificações antes de retornar

### 3.5 Prompts — User Prompt de Insights

**Estrutura do User Prompt:**
```
PRIORIDADE 1 — CONTEXTO DO TIME (RAG):
[blocks de RAG formatados como ## tipo\nespecificação]

PRIORIDADE 2 — DADOS NUMÉRICOS:
  DADOS DA SPRINT: bizDays, KPIs

DIAGNÓSTICO MACRO:
  Remaining: Xh | Capacidade: Yh | Z%
  ▶ INTERPRETAÇÃO: FOLGA / SAUDÁVEL / ATENÇÃO / RISCO REAL

ALERTAS POR MEMBRO:
  🚨 SOBRECARREGADOS (>100%) — CONSOLIDE EM 1 CARD:
    → Membro (Atividade): Z% (rem=Xh, cap=Yh)

CAPACIDADE E REMAINING POR MEMBRO:
  Membro | Atividade | cap=Xh | rem=Yh | done=N tasks | Z%

CAPACIDADE POR TIPO DE ATIVIDADE:
  Atividade: N membro(s) | cap=Xh | rem=Yh | Z% | cap/dia=Xh

BACKLOG:
  state | blockStatus | #id | título | assignedTo | rem=Xh | flags

TASKS:
  state | blockStatus | #id | título | assignedTo | rem=Xh

Gere os insights agora. Responda SOMENTE com o JSON array.
```

---

## 4. Chat Q&A (Floating Chat)

### 4.1 Diferenças em relação a Insights

| Aspecto | Insights | Q&A |
|---|---|---|
| Temperatura | 0.2 | 0.1 (mais determinístico) |
| max_tokens | 1400 | 800 |
| System prompt | Extenso (persona + regras + exemplos) | Mínimo (1 linha) |
| Todos os dados | User prompt | User prompt |
| Resultado | Array 4-6 cards | Array 1 card |
| Validação | R0-R8 | R0 (check matemático) |
| Response format | Padrão | `json_object` (OpenAI) / `responseMimeType` (Gemini) |

### 4.2 Markdown Parser

Implementado como função pura (sem biblioteca externa):

```javascript
renderMd(text)
  // Processa em sequência:
  // 1. Code blocks (```...```) → <pre class="md-pre">
  // 2. Headers (###, ####, #####) → <h3/4/5 class="md-h">
  // 3. Bold (**texto**) → <strong>
  // 4. Italic (*texto*) → <em>
  // 5. Inline code (`código`) → <code class="md-ic">
  // 6. Links ([texto](url)) → <a class="md-a" target="_blank">
  // 7. HR (---) → <hr class="md-hr">
  // 8. Listas (* item ou - item) → <ul class="md-ul"><li>
  // 9. Parágrafo vazio → </p><p class="md-p">
```

---

## 5. Dashboard Builder (`DB`)

### 5.1 Responsabilidades

O módulo `DB` é responsável por toda a geração dinâmica de HTML do dashboard:

```javascript
DB.render(data)
  // Atualiza:
  // - db-topbar-info (projeto, org, sprint, dias)
  // - db-kpis (6 cards com tooltips)
  // - db-backlog (tabela com rows + children-rows)
  // - db-progress (barras, velocidade, atividades, dayoffs)
  // - db-members (tabela de membros)
  //
  // Chama _preloadBlockTimes() assincronamente
```

### 5.2 Escaping e XSS Prevention

```javascript
DB._e(s) {
  return String(s||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
// Todos os dados dinâmicos passam por DB._e() antes de injeção no HTML
```

### 5.3 Download HTML Standalone

```javascript
downloadDashboardHtml()
  // 1. Usa APP.sprintData em memória
  // 2. Chama LLM para gerar insights com conteúdo atual
  // 3. Renderiza HTML completo do dashboard
  // 4. Substitui:
  //    - Spinner por grid com insights embutidos
  //    - Remove painel de chat
  //    - Remove botões de download e chat
  //    - Adiciona blMeta (JSON com dados do backlog para filtros JS offline)
  //    - Adiciona CSS @media print
  //    - Adiciona script beforeprint (expande todos os itens)
  // 5. Cria Blob e inicia download via URL.createObjectURL
```

---

## 6. Responsividade e Layout

### 6.1 Breakpoints

| Breakpoint | Layout | Sidebar |
|---|---|---|
| >900px (desktop) | 2 colunas (sidebar 200px + main) | Full com labels |
| ≤900px (tablet) | 2 colunas (sidebar 60px + main) | Ícones + tooltips hover |
| ≤768px (mobile) | Full width | Hidden; bottom nav fixo |

### 6.2 Sticky Elements

| Elemento | top | z-index |
|---|---|---|
| `.db-topbar` | 0 | 10 |
| `.mod-tabs` (module tabs) | 56px | 9 |
| `.panel-header` (sidebar pages) | 0 | 5 |
| `.db-right` (progress panel) | 0 | — |
| `#toast` | auto (bottom:24px) | 9998 |
| Vault overlay | fixed inset:0 | 9999 |
| Chat FAB | fixed bottom:24px right:24px | 1000 |
| Chat Panel | fixed bottom:84px right:24px | 999 |

---

## 7. Gerenciamento de Estado

### 7.1 Estado em Memória (`APP`)

Contém dados computados que não precisam de persistência entre sessões:
- `sprintData` — dados sincronizados
- `insightCards` — títulos já exibidos (deduplicação)
- `allIterations` — todas as sprints para o selector de eficiência
- `eficienciaData`, `qualidadeData` — calculados sob demanda

### 7.2 Estado Persistido (`Store` / localStorage)

Dados que sobrevivem a reload e fechamento do browser:
- Times, orgs, tokens (cifrados se modo PIN)
- RAG contexts
- Cache da sprint (`avai_sprint_cache`)
- Histórico de conversas e feedback

### 7.3 Estado de UI

Gerenciado diretamente no DOM via classes CSS:
- `.active` — tab/panel ativo
- `.open` — dropdown/modal aberto
- `.expanded` — ícone de expand rotacionado
- `.collapsed` — sidebar do chat oculta

---

## 8. Segurança

### 8.1 Cifragem AES-256-GCM

```
PIN → PBKDF2(PIN, salt, 600000, SHA-256) → AES-GCM Key
plaintext → AES-GCM.encrypt(IV aleatório 12B, key) → IV||ciphertext → base64

Proteções:
- IV único por operação de encrypt (nonce reutilização impossível)
- 600.000 iterações PBKDF2 torna brute-force custoso
- Salt único por instância (salvo em localStorage)
- `crypto.subtle` — Web Crypto API nativa do browser (sem biblioteca externa)
```

### 8.2 Segurança das APIs

- **PAT:** enviado apenas como header HTTP `Authorization: Basic base64(':' + pat)` — nunca no body ou URL
- **Token LLM:** enviado como `x-api-key` (Claude) ou `Authorization: Bearer` (OpenAI/Gemini)
- **Sem proxy:** chamadas diretas do browser para as APIs externas
- **HTTPS obrigatório** em todas as APIs

### 8.3 Prevenção de XSS

- Todo conteúdo dinâmico injetado no innerHTML passa por `DB._e()` (5 caracteres escapados: `& < > " '`)
- Dados JSON não são injetados como string via `eval()` ou `innerHTML` sem escaping
- URLs de itens do Azure DevOps construídas com `encodeURIComponent` e não injetadas diretamente

---

## 9. Tratamento de Erros

### 9.1 Erros de API

```javascript
AzureAPI._fetch(url, opts)
  // Se !resp.ok → throw new Error(`HTTP ${resp.status}: ${text.substring(0,200)}`)
  // O caller captura e exibe toast de erro

Store.getActivePat()
  // Se modo session e token não encontrado → retorna null
  // DataProcessor.sync() → throw new Error('PAT inválido ou vault bloqueado.')
```

### 9.2 Erros de LLM

```javascript
_callLlmRaw(provider, system, user)
  // Se fetch falhar → throw com mensagem HTTP
  // _parseInsightJson(raw) → multiple fallbacks:
  //   1. Extrai [ ] → JSON.parse → válido
  //   2. { } → envolve em array
  //   3. Texto puro → card info genérico
  //   4. Placeholder detectado → mensagem amigável

// Timeout client-side:
setTimeout(() => {
  if (insights grid ainda mostra spinner) {
    exibe mensagem de timeout
    reabilita botões
  }
}, 90000)
```

### 9.3 Erros de Vault

```javascript
Vault.verifyPin(pin)
  // Se decrypt falhar (PIN errado) → try/catch → retorna null
  // UI exibe "PIN incorreto"

Vault.decryptToken(cipher)
  // Se cipher inválido → try/catch → retorna ''
  // Caller recebe PAT/token vazio → falha na sync com mensagem clara
```

---

## 10. Dependências Externas

| Dependência | Versão | Forma de carregamento | Uso |
|---|---|---|---|
| Chart.js | 4.4.4 | CDN: `cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js` | Gráficos dos módulos Eficiência e Qualidade |
| Web Crypto API | nativa | Browser built-in | Vault AES-256-GCM + PBKDF2 |
| Fetch API | nativa | Browser built-in | Todas as chamadas HTTP |

Sem outras dependências. Sem Node.js, sem npm, sem framework JavaScript.

---

## 11. Performance

### 11.1 Paralelismo nas Chamadas

```javascript
// Batch de 8 revisões paralelas (_fetchMaxRem)
for (let i = 0; i < ids.length; i += 8) {
  await Promise.all(ids.slice(i, i+8).map(async id => {
    // busca revisões de cada task
  }));
}

// Eficiência: revisions em loop sequencial por item
// (limitado para não sobrecarregar a API)
```

### 11.2 Cache de Sprint

```javascript
Store.getSprintCache()
// Dados ficam em localStorage após primeira sync
// Próxima abertura do app usa o cache sem nova sync
// Cache atualizado apenas ao clicar "Sincronizar"
```

### 11.3 Lazy Loading

- **Tempo de bloqueio** de cada item: carregado assincronamente após render (`_preloadBlockTimes`)
- **Timeline do board**: carregada apenas quando o usuário expande o drill-down de um item
- **Insights**: carregados assincronamente após o dashboard renderizar (não bloqueia a UI)
- **Eficiência e Qualidade**: calculados apenas quando o usuário acessa a tab e clica em calcular
