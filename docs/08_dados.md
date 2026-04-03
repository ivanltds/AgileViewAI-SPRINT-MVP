# AgileViewAI — Dados Utilizados

> Fontes, campos coletados, tratamentos aplicados e privacidade dos dados

---

## 1. Fontes de Dados Externas

### 1.1 Azure DevOps REST API

**URL Base:** `https://dev.azure.com/{org}/{proj}`

**Autenticação:** HTTP Basic Auth com PAT (Personal Access Token)
- Header: `Authorization: Basic base64(':' + PAT)`
- Permissões mínimas necessárias: `Work Items (Read)` + `Project and Team (Read)`

---

## 2. Dados de Iterações (Sprints)

### 2.1 Endpoint
```
GET /{org}/{proj}/{team}/_apis/work/teamsettings/iterations?api-version=7.1
```

### 2.2 Campos Utilizados
| Campo da API | Campo no App | Tratamento |
|---|---|---|
| `id` | `active.id` | Usado para buscar capacidade específica da sprint |
| `name` | `sprintLabel` | Exibido na topbar |
| `path` | `iterPath` | UNDER clause do WIQL para buscar work items |
| `attributes.startDate` | `iterStart` | Comparado com `Date.now()` para identificar sprint ativa; +1 dia de buffer para UTC offset |
| `attributes.finishDate` | `iterEnd` | Mesmo critério; usado para calcular dias úteis restantes |

### 2.3 Lógica de Seleção de Sprint
```
1. Sprint ativa: startDate ≤ hoje ≤ finishDate + 86400000ms
2. Fallback 1: sprint mais recente com finishDate no passado
3. Fallback 2: primeira sprint futura (ordenada por startDate)
```

---

## 3. Work Items (Backlog e Tasks)

### 3.1 Endpoint de IDs (WIQL)
```
POST /{org}/{proj}/_apis/wit/wiql?api-version=7.1

Query:
SELECT [System.Id] FROM WorkItems
WHERE [System.TeamProject] = '{proj}'
AND [System.IterationPath] UNDER '{iterPath}'
AND [System.WorkItemType] IN ('Product Backlog Item','Defect','Bug','Task')
AND [System.State] <> 'Removed'
ORDER BY [System.Id]
```

### 3.2 Endpoint de Detalhes (Batch)
```
GET /{org}/{proj}/_apis/wit/workitems?ids={ids}&fields={fields}&api-version=7.1
(Lotes de 200 IDs por chamada)
```

### 3.3 Campos Coletados — Itens de Backlog (PBI / Defect)
| Campo da API | Descrição | Tratamento Aplicado |
|---|---|---|
| `System.Id` | ID numérico | Usado como chave, link para Azure |
| `System.WorkItemType` | Tipo (PBI, Defect) | Classificação da badge de tipo |
| `System.Title` | Título | Exibido; escaping HTML antes de injetar no DOM |
| `System.State` | Estado do item | Mapeado para paleta de cores (s-todo, s-doing, etc.) |
| `System.Parent` | ID do pai | Usado para associar child tasks |
| `System.AssignedTo` | Responsável (objeto `{displayName}`) | `displayName` extraído e exibido |
| `System.Tags` | Tags separadas por `;` | Lowercased para detecção de BLOCKED/FIXING |
| `Custom.Block` | Campo customizado de bloqueio | Aceita `true`, `"true"`, `"True"` |
| `Microsoft.VSTS.Common.Severity` | Severidade (para Defects) | Exibido na tabela de qualidade |
| `Microsoft.VSTS.Scheduling.StoryPoints` | Story Points | Somado por sprint na eficiência |
| `Microsoft.VSTS.Scheduling.RemainingWork` | Horas restantes | Usado no KPI "Demandas Aloc." |

### 3.4 Campos Coletados — Tasks e Bugs Filhos
| Campo da API | Descrição | Tratamento Aplicado |
|---|---|---|
| `System.Id` | ID | Chave, link direto |
| `System.WorkItemType` | Task ou Bug | Badge de tipo |
| `System.Title` | Título | Exibido no drill-down |
| `System.State` | Estado | Classify como Em andamento / Concluído |
| `System.Parent` | ID do PBI pai | Agrupamento no drill-down |
| `System.AssignedTo` | Responsável | Avatar no card e lookup de capacidade |
| `Microsoft.VSTS.Common.Activity` | Atividade/Papel | Agrupamento por atividade, lookup de capacidade |
| `Microsoft.VSTS.Scheduling.RemainingWork` | Horas restantes | Soma por membro e por atividade |
| `Microsoft.VSTS.Scheduling.CompletedWork` | Horas concluídas | Exibido nos cards de task |

---

## 4. Dados de Revisões (Histórico)

### 4.1 Endpoint
```
GET /{org}/{proj}/_apis/wit/workitems/{id}/revisions?api-version=7.1
```

### 4.2 Uso 1 — Estimativa Original (Max Remaining)

Para cada **task**, busca o histórico de revisões e extrai o **maior valor de RemainingWork** já registrado. Isso representa a estimativa original antes do consumo de horas.

```
estimativa_da_task = max(RemainingWork em todas as revisões)
estimativa_do_PBI = soma(estimativa de tasks filhas, incluindo concluídas)
```

**Processamento:** batches de 8 tasks em paralelo (`Promise.all`) para eficiência.

### 4.3 Uso 2 — Timeline do Board (Tempo por Coluna)

Para cada item Done no módulo Eficiência, lê todas as revisões e calcula:
```
Para cada par de revisões consecutivas:
  coluna = revisão[i].fields['System.BoardColumn'] || revisão[i].fields['System.State']
  delta = (revisão[i+1].ChangedDate - revisão[i].ChangedDate) / 86400000 dias
  
Critérios de filtro:
  - coluna não está em {Done, Closed, Resolved, Concluído, Completed, Fechado}
  - delta > 0 e delta < 180 (elimina outliers e erros de data)
  
colTimes[coluna] = soma dos deltas de todos os itens
```

### 4.4 Uso 3 — Tempo de Bloqueio por Item

Para cada item do Backlog, busca revisões e conta quantos dias o item ficou em estado de bloqueio (tag/state):

```
Para cada revisão: se state contém 'blocked' ou 'bloqueado', soma o delta de dias
```

Carregado assincronamente após o dashboard renderizar (não bloqueia o carregamento inicial).

---

## 5. Dados de Capacidade

### 5.1 Endpoint
```
GET /{org}/{proj}/{team}/_apis/work/teamsettings/iterations/{iterationId}/capacities?api-version=7.1
```

### 5.2 Campos Coletados
| Campo da API | Descrição | Tratamento Aplicado |
|---|---|---|
| `teamMember.displayName` | Nome do membro | Chave para lookup de remaining work por membro |
| `activities[0].name` | Atividade (Back End, QA, etc.) | Agrupamento por atividade |
| `activities[0].capacityPerDay` | Horas/dia de trabalho | Base do cálculo de capacidade |
| `daysOff[].start` | Início do day off | Convertido para UTC; iterado dia a dia para excluir fins de semana |
| `daysOff[].end` | Fim do day off | Mesmo tratamento |

### 5.3 Cálculo de Capacidade

```javascript
// Dia de hoje em UTC midnight (elimina efeito de fuso horário)
todayMs = Date.UTC(year, month, day)

// Todos os dias de folga do membro (excluindo sábado/domingo)
allOff = daysOff.flatMap(range => diasUteisEntre(range.start, range.end))

// Dias de folga futuros (a partir de hoje)
futureOff = allOff.filter(d => d >= todayMs)

// Capacidade total da sprint
capTotal = capDay × max(totBizDays - allOff.length, 0)

// Capacidade ainda disponível (a partir de hoje)
capRest = capDay × max(bizDays - futureOff.length, 0)

// Fallback se nenhuma capacidade cadastrada: 6h/dia × membros × bizDays
```

---

## 6. Dados de Eficiência (API Específica)

### 6.1 Work Items para Eficiência
Campos adicionais em relação ao sync normal:
| Campo da API | Uso |
|---|---|
| `Microsoft.VSTS.Common.ActivatedDate` | Início do Cycle Time |
| `Microsoft.VSTS.Common.ClosedDate` | Fim do Lead Time e Cycle Time |
| `System.CreatedDate` | Início do Lead Time |
| `System.BoardColumn` | Posição no board para timeline |
| `System.ChangedDate` | Timestamp de cada revisão |

### 6.2 Cálculos de Métricas

```
Lead Time (dias) = ClosedDate - CreatedDate
Cycle Time (dias) = ClosedDate - ActivatedDate

Media = soma / count (para itens com datas disponíveis)
Throughput = count(Done) por sprint / número de sprints
```

### 6.3 Filtro de Bugs para Eficiência
Query WIQL separada filtrada apenas para `Bug` e `Defect` para cálculo de bugs abertos:
```sql
AND [System.State] NOT IN ('Done','Closed','Resolved','Removed')
```

---

## 7. Dados de Qualidade (API Específica)

### 7.1 Query
```sql
SELECT [System.Id] FROM WorkItems
WHERE [System.WorkItemType] IN ('Bug','Defect')
AND [System.State] <> 'Removed'
```
(Sem filtro de sprint — pega **todo o projeto**)

### 7.2 Campos Adicionais
| Campo | Uso |
|---|---|
| `Microsoft.VSTS.Common.Priority` | Filtro e KPI de bugs críticos |
| `Microsoft.VSTS.Common.Severity` | Filtro e gráfico de distribuição |
| `Microsoft.VSTS.Scheduling.OriginalEstimate` | Estimativa original vs trabalho realizado |

### 7.3 Tasks Filhas de Bugs/Defects
Busca via WIQL de **links hierárquicos**:
```sql
SELECT [System.Id] FROM WorkItemLinks
WHERE [Source].[System.Id] IN (...defectIds...)
AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward'
AND [Target].[System.WorkItemType] IN ('Task','Bug')
MODE (MustContain)
```

---

## 8. Dados Enviados para LLMs

### 8.1 O que é enviado (User Prompt)

Os seguintes dados calculados são incluídos no prompt de análise:

| Dado | Origem | Enviado como |
|---|---|---|
| Composição do time por papel | `capacity[m].activity` + contagem | Texto: "Back End: 2, QA: 1..." |
| KPIs (totais, done, blocked, fixing) | `stats` | Texto numérico |
| Remaining total / capacidade total / % | `stats` | Texto numérico |
| Interpretação macro | Calculado em JS | Texto: "FOLGA / ATENÇÃO / RISCO REAL" |
| Alocação individual | `capacity` + `byMember.remaining` | Texto: "Nome | Papel | cap=Xh | rem=Yh | Z%" |
| Alocação por atividade | `byActivity` | Texto por papel |
| Lista de backlog | `backlog` | Texto: "state | blockStatus | #id | titulo | assignedTo | rem=Xh" |
| Lista de tasks | `tasks` | Texto: "state | blockStatus | #id | titulo | assignedTo | rem=Xh" |
| Contexto RAG | `Store.getActiveRag()` | Bloco Markdown injetado diretamente |

### 8.2 O que NÃO é enviado

- PAT (Personal Access Token) — nunca sai do cliente
- Tokens LLM — enviados apenas como header HTTP, não como parte do prompt
- Org/Projeto/Team — não enviados ao LLM (apenas usados para URLs da API Azure)
- PINs e chaves de cifragem — existem apenas em memória

### 8.3 Tokens LLM — Reutilização e Scope
- Tokens enviados via header `x-api-key` (Claude), `Authorization: Bearer` (OpenAI/Gemini)
- Chamada direta browser → API do LLM (sem proxy intermediário)
- Sem persistência em servidor de terceiros

---

## 9. Dados Locais (localStorage)

### 9.1 Chaves do localStorage

| Chave | Conteúdo | Cifrado? |
|---|---|---|
| `avai_vault_salt` | Salt de 16 bytes em base64 | Não (salt é público por design) |
| `avai_vault_check` | Desafio cifrado para verificação do PIN | Sim (AES-256-GCM) |
| `avai_teams` | Array de objetos `{id, name, org, proj, azTeam, orgId}` | Parcialmente (PAT está em `patEnc`) |
| `avai_orgs` | Array `{id, name, patEnc}` | Sim (PAT em AES-256-GCM) |
| `avai_llm` | Array `{id, provider, tokenEnc, active}` | Sim (token em AES-256-GCM) |
| `avai_rag` | Array de contextos RAG (sem dados sensíveis) | Não |
| `avai_active_team` | ID UUID do time ativo | Não |
| `avai_sprint_cache` | JSON completo da última sync | Não (dados públicos do Azure) |
| `avai_chat_convs` | Histórico de conversas do chat | Não |
| `avai_insight_fb` | Feedback de insights (título, vote, timestamp) | Não |
| `avai_user_profile` | Perfil de nível do usuário (neutral/technical/didactic) | Não |
| `avai_agent_prompts` | Prompts customizados dos agentes A1/A2/A3 | Não |

### 9.2 Modo Sessão (sem persistência)

```javascript
APP.sessionTokens = {
  teams: { [teamId]: 'PAT_plain_text' },
  llms:  { [llmId]:  'token_plain_text' },
  orgs:  { [orgId]:  'PAT_plain_text' }
}
```
Apagado automaticamente ao fechar o JavaScript context (refresh ou fechamento da aba/browser).

---

## 10. Tratamentos de Dados

### 10.1 Encoding de Team Name
Times com espaços ou caracteres especiais são codificados para URLs:
```javascript
team.split(' ').map(encodeURIComponent).join('%20')
// "Time de Backend" → "Time%20de%20Backend"
// NÃO: encodeURIComponent(team) — codifica '/' que o Azure não aceita em alguns endpoints
```

### 10.2 Parsing de AssignedTo
O campo `System.AssignedTo` da API retorna um **objeto** com `{displayName}` ou uma **string** dependendo da versão/configuração:
```javascript
_dispName(v) {
  if (!v) return '';
  if (typeof v === 'object') return v.displayName || '';
  return String(v);
}
```

### 10.3 Normalização de Estado
Mapeamento de estados do Azure para categorias internas:
```
Done/Closed/Resolved/Concluído/Completed/Finalizado/Encerrado → isDone
In Progress/Active/Ativo/Andamento/Progresso/Doing/Executando → isProgress
Testing/QA/Homolog/Aguia... → isTesting
Removed/Removido/Cancelled/Descartado → isRemoved
Design/Análise → isDesign
demais → isTodo
```

### 10.4 HTML Escaping
Todo conteúdo dinâmico injetado no DOM passa por:
```javascript
_e(s) {
  return String(s||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
```

### 10.5 Validação de Datas
Todas as comparações de data usam UTC midnight para eliminar efeitos de fuso horário:
```javascript
todayMs = Date.UTC(year, month, day)  // sem horas
```

---

## 11. Privacidade e Compliance

| Aspecto | Status |
|---|---|
| Dados enviados para servidor externo | Apenas Azure DevOps API e LLM API (com tokens do próprio usuário) |
| Dados armazenados em servidor de terceiros | NÃO — tudo no localStorage do browser do usuário |
| PATs e tokens LLM | Cifrados com AES-256-GCM se modo PIN ativo |
| Dados pessoais | Nomes dos membros do time (apenas exibidos, não enviados a terceiros além do LLM) |
| Exportação | JSON sem tokens — seguro para compartilhar entre instâncias |
| Logs | Nenhum — app não coleta telemetria ou analytics |
