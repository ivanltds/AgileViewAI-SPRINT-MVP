# AgileViewAI — Arquitetura Técnica

## Visão Geral

AgileViewAI é um **Google Apps Script** que opera como add-on dentro do Google Sheets. A solução é inteiramente server-side (V8 runtime do Apps Script), exceto pelo HTML do dashboard que é renderizado no browser do usuário dentro de um iframe gerenciado pelo HtmlService.

```
Google Sheets (UI)
      │
      ├── Menu AgileViewAI (onOpen.gs)
      │
      └── HtmlService (modal/iframe)
            ├── Dashboard HTML (dashboard.gs)
            └── google.script.run → server-side functions
                      │
                      ├── Azure DevOps REST API (azure_api_client.gs)
                      ├── Google Sheets API (nativa do Apps Script)
                      ├── LLM APIs: Claude / OpenAI / Gemini
                      └── Google Drive API (para PDF)
```

---

## Estrutura de Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `onOpen.gs` | Registra o menu no Sheets via `onOpen()` trigger |
| `setup.gs` | Cria e valida as abas da planilha |
| `azure_api_client.gs` | Cliente HTTP para a API REST do Azure DevOps |
| `data_processor.gs` | Orquestra a sincronização: busca dados do Azure e grava nas abas |
| `TeamsManager.gs` | Gerencia times, organizações, tokens LLM e contextos RAG; renderiza as UIs HTML |
| `dashboard.gs` | Gera o HTML do dashboard, engine de insights, validador determinístico, integração com LLMs |
| `main.gs` | Ponto de entrada para funções expostas ao menu (delegação) |

---

## Fluxo de Sincronização

### 1. Autenticação e Discovery

```
syncAzureDevOps()
  → readConfig(ss)          ← lê Presentation & Config
  → getIterations(org, proj, team, pat)
      → GET /{org}/{proj}/{team}/_apis/work/teamsettings/iterations
      → filtra sprint ativa por startDate ≤ hoje ≤ finishDate
  → getIterationWorkItems(org, proj, iterationPath, pat)
      → GET /{org}/{proj}/_apis/wit/wiql (WIQL query)
      → GET /{org}/{proj}/_apis/wit/workitemsbatch (campos completos)
  → getTeamCapacity(org, proj, team, iterationId, pat)
      → GET /{org}/{proj}/{team}/_apis/work/teamsettings/iterations/{id}/capacities
```

### 2. Encoding da URL do Team

Um bug clássico de APIs do Azure é que o team name com espaços deve ser codificado **por palavra**, não como string completa:

```javascript
// ERRADO: encodeURIComponent("Time de Backend") → "Time%20de%20Backend" ✓
// mas encodeURIComponent("Time & Backend") → "Time%20%26%20Backend" ✓
// Problema: encodeURIComponent(team) codifica "/" e outros caracteres
// que o Azure não aceita em alguns endpoints

// CORRETO:
team.split(" ").map(encodeURIComponent).join("%20")
```

### 3. Cálculo de Dias Úteis (UTC-safe)

Todas as comparações de data usam `Date.UTC()` para eliminar o efeito de fuso horário:

```javascript
function _countBusinessDays(startMs, endMs) {
  var count = 0;
  var cur = startMs; // já em UTC midnight
  while (cur <= endMs) {
    var d = new Date(cur);
    var dow = d.getUTCDay(); // 0=Dom, 6=Sab
    if (dow !== 0 && dow !== 6) count++;
    cur += 86400000;
  }
  return count;
}
// Hoje é incluído: cur começa em todayMidnightUTC
```

---

## Arquitetura do Dashboard

### Geração Server-Side

O dashboard é gerado inteiramente no servidor pelo `_buildDashboardHtml(data, cfg)`. O HTML é uma string construída por concatenação em Apps Script e retornada ao cliente via `HtmlService.createHtmlOutput()`.

**Por que não usar templates?** O HtmlService tem limitações com `<?= ?>` em strings longas. A concatenação direta é mais previsível e permite injeção segura de dados via `_esc()` e base64.

### Passagem de Dados para o Lado Cliente

**Problema:** Serializar dados como JSON inline no `<script>` quebra o JavaScript quando titles de tasks contêm aspas, caracteres especiais ou a string `</script>`.

**Solução adotada:** Os dados são codificados em base64 no servidor e decodificados no servidor também — o cliente **não** recebe o payload, apenas chama `google.script.run` sem argumentos.

```javascript
// No servidor (geração do HTML):
var minPayload = { stats: {...}, capacity: {...}, ... };
var insightPayloadB64 = Utilities.base64Encode(JSON.stringify(minPayload));
// _pb64 é inserido como string base64 (apenas chars A-Z a-z 0-9 + / =)
// Nunca quebra o <script>

// Na chamada assíncrona:
google.script.run.callLlmWithData(_pb64);

// No servidor (callLlmWithData):
var json = Utilities.base64Decode(payloadB64, Utilities.Charset.UTF_8);
var payload = JSON.parse(json);
```

**Evolução:** Após refatoração, `callLlmWithData` e `askQuestionWithData` lêem dados **diretamente da planilha** para garantir dados sempre frescos, eliminando completamente o problema de payload corrompido.

### Carregamento Assíncrono dos Insights

```
Dashboard abre (HTML renderizado)
      │
      ├── Spinner exibido imediatamente
      ├── loadInsights() chamado via DOMContentLoaded
      │       └── google.script.run.callLlmWithData()
      │             [server: lê planilha + chama LLM + valida + renderiza]
      │
      ├── Timeout de 90s: se não responder → exibe "Tempo esgotado"
      │
      └── withSuccessHandler: substitui spinner pelos cards de insight
```

---

## Engine de Insights LLM

### Separação de Responsabilidades

```
_callLlm(llm, stats, capacity, byActivity, ragContext, tasks, backlog)
  ├── _buildSystemPrompt()   ← instruções fixas (persona, regras, formato, exemplos)
  ├── _buildUserPrompt(...)  ← dados variáveis da sprint
  ├── _callLlmRaw(llm, system, user)
  │     ├── _callClaude()  → POST api.anthropic.com/v1/messages
  │     │     system: campo nativo, temperature: 0.2, max_tokens: 1400
  │     ├── _callOpenAI()  → POST api.openai.com/v1/chat/completions
  │     │     messages: [{role:"system"}, {role:"user"}], temperature: 0.2
  │     └── _callGemini()  → POST generativelanguage.googleapis.com/v1beta/...
  │           systemInstruction, temperature: 0.2
  ├── _parseInsightJson(raw) ← trata texto puro, JSON malformado e placeholders
  └── _validateInsights(insights, stats, capacity, ragContext) ← 8 regras
```

### System Prompt

O system prompt contém:
- **Persona:** Agile Master sênior com regras de análise
- **Thresholds:** sobrecarga >100%, saudável 70-100%, ocioso <70%
- **Regra de Skill Matching:** nunca sugerir redistribuição entre papéis diferentes
- **Estrutura de saída:** 4 seções (Sobrecarga / Oportunidades / Riscos / Conformidade)
- **Exemplos few-shot:** casos reais baseados nos dados do time
- **Checklist:** 6 verificações antes de retornar o JSON

### User Prompt

O user prompt contém dados variáveis:
- Composição do time por papel (contagem)
- KPIs da sprint (totais, status, remaining, capacidade)
- **Diagnóstico macro pré-calculado:** interpreta rem vs cap em texto para o LLM
- Alocação por tipo de atividade (cap/dia, ritmo/dia, %)
- Alocação individual (cap, rem, %, status SOBRECARREGADO/OCIOSO/SAUDAVEL)
- Contexto RAG (injetado diretamente sem split)
- Alerta pré-calculado por grupo (🚨 SOBRECARREGADOS / ⚠️ OCIOSOS)

### Chamada Q&A (Perguntas Livres)

Para perguntas livres usa `_callLlmQA()` — função separada que:
- Usa `response_format: { type: "json_object" }` no OpenAI (força JSON na API level)
- Usa `responseMimeType: "application/json"` no Gemini
- Coloca tudo (dados + pergunta) em uma única mensagem user (sem system separado)
- `max_tokens: 800`, `temperature: 0.1` (mais determinístico para Q&A factual)

---

## Validador Determinístico

O validador processa cada insight gerado pelo LLM com 8 regras em sequência:

```
_validateInsights(insights, stats, capacity, ragContext)
  │
  ├── pré-calcula: memberAlloc = {alloc%, cap, rem, activity} por membro
  ├── pré-calcula: ragLower = ragContext.toLowerCase()
  ├── regra0Fired = false
  │
  └── insights.map(ins) → aplica regras R0-R5 em sequência
        │
        R0: rem < cap + não cita membro → corrige para "Capacidade com folga"
            (só dispara uma vez via flag regra0Fired)
        R1: critical + "total/equipe" + sem membro + allocPct<100% → info
        R2: critical + nenhum membro >100% + não é bloqueio → warning
        R3: RAG trata a situação + não é sobrecarga real → ok
            (sobrecarga real = membro citado com alloc>100% nos dados)
        R5: ok/info + linguagem conformidade + membro citado <70% → warning
  │
  ├── filtra nulls (R0 pode retornar null para descartar duplicatas)
  │
  ├── R8 (IIFE): identifica ociosos <70% não cobertos → injeta/complementa cards
  │
  ├── R6: membros >100% não citados → complementa card critical existente
  │         ou cria card consolidado
  │
  ├── R7: múltiplos cards critical → mescla em 1 com bodies concatenados por " | "
  │
  └── deduplicação por título (case-insensitive, sem espaços extras)
```

---

## HtmlService — Restrições Críticas

O HtmlService do Google Apps Script opera dentro de um iframe sandboxed com restrições:

| Restrição | Impacto | Solução |
|---|---|---|
| Sem `localStorage` / `sessionStorage` | Não pode persistir estado no cliente | Estado mantido em variáveis JS ou planilha |
| `<!DOCTYPE html>` quebra algumas APIs | O HtmlService injeta seu próprio doctype | **Nunca** incluir `<!DOCTYPE html>` no HTML gerado |
| Aspas duplas em `onclick` quebram o HTML | `onclick="fn('id')"` → aspas conflitam | `onclick='fn("id")'` — aspas simples no outer |
| `outerHTML` inclui scripts do iframe | `downloadDashboard` não pode usar `outerHTML` | `getDashboardHtml()` gera HTML limpo no servidor |
| Execuções longas são silenciosamente mortas | Sem `withFailureHandler` para timeout | Timeout client-side com `setTimeout` (90s/60s) |
| Limite de ~6MB para retorno de função | HTML muito grande falha | Payload mínimo serializado, dados não essenciais omitidos |

---

## Segurança e Boas Práticas

### Escaping
- `_esc(str)` para HTML gerado server-side (5 caracteres: `& < > " '`)
- `_escI(str)` para HTML dos insight cards
- Nunca concatenar dados não escaped diretamente no HTML

### PAT (Personal Access Token)
- Armazenado na aba `Organizations` — acessível apenas ao proprietário da planilha
- Exibido na UI sempre mascarado (primeiros 4 + "..." + últimos 4 chars)
- Nunca logado ou serializado para o cliente

### Token LLM
- Armazenado na aba `LLM_Config`
- Exibido mascarado na UI de configuração
- Transmitido apenas em chamadas server-side (não chega ao browser)

### Injeção de HTML
- Todo conteúdo dinâmico (títulos de tasks, nomes de membros) passa por `_esc()`
- Base64 elimina risco de XSS via payload de dados

---

## Download Standalone

### getDashboardHtml() — Geração Offline

```
getDashboardHtml()
  1. _collectDashboardData() → lê planilha
  2. _buildDashboardHtml() → gera HTML completo (com google.script.run)
  3. Gera insights via _callLlm() + _validateInsights() → insightsHtml
  4. indexOf("insights-loading") → substitui spinner + grid vazio
     pelo grid com insightsHtml embutido
  5. indexOf("question-panel") → remove painel de chat
  6. indexOf("insights-footer") → remove footer com botões
  7. indexOf("position:fixed") → remove botões de download
  8. split("insight-remove") → remove botões X dos cards
  9. Substitui <script> por versão standalone:
     - blMeta com dados reais do backlog
     - filterBL, toggleChildren, toggleVerMais (sem google.script.run)
     - <style media="print"> com CSS de impressão
     - window.beforeprint expande todos os itens
```

---

## Limitações Conhecidas e Mitigações

| Limitação | Causa | Mitigação |
|---|---|---|
| Timeout de execução (~6 min no Apps Script) | Soma de _collectDashboardData + chamada LLM | Payload b64 evita releitura; timeout client-side |
| LLM pode ignorar instruções de formato | Modelos probabilísticos | `_parseInsightJson` com 3 fallbacks + validador R0-R8 |
| response_format json_object OpenAI retorna objeto, não array | Comportamento da API | `if (normalized.charAt(0) === '{') normalized = '[' + normalized + ']'` |
| PDF gerado via Drive tem CSS limitado | DriveApp usa Chromium headless | CSS inline e `!important` para cores; layout simplificado |
| `beforeprint` não funciona em todos os browsers | Suporte variável | CSS `@media print` como fallback independente de JS |
