# AgileViewAI — Catálogo Completo de Funcionalidades

---

## 1. Vault de Segurança

### 1.1 Modo PIN (padrão)
- Derivação de chave com **PBKDF2** (600.000 iterações, SHA-256)
- Ciframento de tokens com **AES-256-GCM** (IV aleatório de 12 bytes por operação)
- Salt aleatório de 16 bytes gerado na primeira abertura e armazenado no `localStorage`
- Verificação do PIN via ciphertext de desafio (`avai_vault_check`)
- **Re-cifragem completa** ao trocar o PIN: todos os tokens são descritos com a chave antiga e recifradorados com a nova
- PIN de 4 a 8 dígitos numéricos

### 1.2 Modo Sessão
- Tokens armazenados apenas em variável JavaScript `APP.sessionTokens` (memória)
- Apagados automaticamente ao fechar o navegador (sem persistência)
- Aviso visual âmbar explicando o comportamento

### 1.3 Configurações do Vault
- Alteração de modo (PIN → Sessão ou vice-versa)
- Troca de PIN com verificação do PIN atual
- Limpeza total do vault (remove todos os tokens do `localStorage`)
- "Apagar tudo" remove todos os dados do navegador

---

## 2. Gerenciamento de Times

### 2.1 Cadastro de Times
- Nome de exibição (livre)
- Organização Azure DevOps (nome exato)
- Projeto Azure DevOps (nome exato)
- Team Azure DevOps (nome exato — usado na URL da API)
- PAT (cifrado antes de salvar)
- Vinculação a organização existente (reutiliza PAT automaticamente)

### 2.2 Gerenciamento de Organizações
- Cadastro independente de organização + PAT
- PAT compartilhado por todos os times da mesma organização
- Exibição do PAT sempre mascarada na UI

### 2.3 Ativação de Time
- Apenas um time ativo por vez (`avai_active_team` no `localStorage`)
- Troca instantânea no dropdown do topbar do dashboard
- Dropdown no dashboard com lista de todos os times cadastrados
- Próxima sincronização usa credenciais do time ativo

---

## 3. Sincronização com Azure DevOps

### 3.1 Identificação de Sprint Ativa
- Busca todas as iterações do time via API REST (`teamsettings/iterations`)
- Sprint ativa: `startDate ≤ hoje ≤ finishDate + 1 dia` (buffer para compensar fuso horário)
- Fallback 1: sprint mais recentemente encerrada
- Fallback 2: próxima sprint futura (se não houver encerrada)

### 3.2 Work Items
- Busca via WIQL: todos os PBIs, Defects, Bugs e Tasks da `iterationPath` (exceto Removed)
- Batch em lotes de 200 IDs para contornar limite da API
- Campos coletados por tipo:
  - **Backlog (PBI/Defect):** Id, Type, Title, State, AssignedTo, Tags, Severity, StoryPoints, RemainingWork
  - **Tasks/Bugs filhos:** Id, Type, Title, State, Parent, AssignedTo, Activity, RemainingWork, CompletedWork

### 3.3 Estimativa por Item do Backlog
- Para cada task, busca o histórico de revisões e extrai o **maior valor de RemainingWork** já registrado (= estimativa original)
- `estimativa` do item pai = soma das estimativas de todas as tasks filhas (incluindo concluídas)
- `childRem` = soma do RemainingWork atual apenas das tasks abertas
- Processamento em paralelo com batch de 8 tasks simultâneas para desempenho

### 3.4 Capacidade do Time
- Endpoint: `teamsettings/iterations/{id}/capacities`
- Por membro: `capacityPerDay` (h/dia), `daysOff` (start, end)
- `capTotal` = `capDay × (totBizDays - allDaysOff.length)` (capacidade total da sprint)
- `capRest` = `capDay × (bizDays - futureDaysOff.length)` (capacidade ainda disponível)
- Days off comparados em UTC midnight para precisão de data

### 3.5 Cálculo de Dias Úteis
- Loop dia a dia de `todayMs` até `endMs` em UTC
- Sábado (`getUTCDay() === 6`) e domingo (`=== 0`) excluídos
- Hoje incluído na contagem (alinhado ao comportamento nativo do Azure DevOps)

### 3.6 Status de Bloqueio
- Verificação em cascata:
  1. Campo `Custom.Block` = true/True/string "true"
  2. Tags contendo: `blocked`, `bloqueado`, `block`
  3. State contendo: `block`
  4. → retorna `BLOCKED`
- Tags contendo: `fixing`, `correção`, `reopen` ou state contendo: `fix`, `corre`, `ajuste`
  - → retorna `FIXING`
- Caso contrário: `CLEAR`

### 3.7 Cache e Persistência
- Dados sincronizados salvos em `localStorage` chave `avai_sprint_cache`
- Por design: um cache único (time ativo), não multi-time
- Timestamp `syncedAt` registrado no cache

---

## 4. Dashboard — Módulo Sprint

### 4.1 KPIs (6 Cards)
| KPI | Cálculo | Alerta visual |
|---|---|---|
| Total | `backlog.length` | — |
| Concluídos | `state ∈ {Done, Closed, Resolved}` | — |
| Em progresso | `state.includes('progress')` E `blockStatus=CLEAR` | — |
| Bloqueados | `blockStatus=BLOCKED` | Vermelho se >0 |
| Em fixing | `blockStatus=FIXING` | Vermelho se >0 |
| Demandas aloc. | `totalRem / capRest × 100%` | Vermelho se >100% |

Todos os KPIs têm tooltip informativo `ⓘ` com metodologia de cálculo.

### 4.2 Tabela de Backlog
- Wrapper com scroll horizontal independente (scrollbar 6px estilizado)
- Colunas: (expand), Tipo, ID, Título, Status, Executores, Bloq., Progresso, Estimativa, Rem. atual
- **Ordenação por coluna** (sort-th): ciclo `neutro → asc → desc → neutro`
- **Filtros por tab:** Todos / To Do / Em progresso / Concluído / Bloqueados / Fixing (com contadores)
- Linhas coloridas: `#fff5f5` bloqueado, `#fffbeb` fixing
- Avatares de executores com iniciais (até 2 palavras do nome)

### 4.3 Drill-down de Backlog Item
- Clique na linha: expande `children-row` com tasks divididas em 2 colunas
- **"Em andamento":** tasks abertas com status, horas restantes, responsável
- **"Concluído":** tasks fechadas com estimativa original
- **Timeline do Board** (expansível dentro do drill-down): histórico de estados via revisões da API, mostrando tempo médio em cada coluna do board
- Link `#ID` em cada task abre o item no Azure DevOps em nova aba
- **Tempo de bloqueio** (coluna "Bloq."): calculado assincronamente via revisões da API - quantos dias o item ficou em estado de bloqueio ao longo de toda sua vida

### 4.4 Painel de Progresso (coluna direita)
- Barra de itens concluídos (%)
- Barra de capacidade alocada (cor variável: verde/âmbar/vermelho)
- Cards de velocidade: `cap/dia` vs `ritmo necessário/dia`
- "Ver por atividade ▾": breakdown expansível por papel (Back End, Front End, QA, etc.) com barra individual
- Contadores de tasks: abertas e finalizadas
- **Day offs**: cards âmbar com membro e data, ordenados cronologicamente

### 4.5 Seção de Insights de IA
- Spinner de carregamento com texto "Consultando [provider]..."
- Grid 2 colunas de cards coloridos por severidade
- Deduplicação por título ao acumular mais insights (normalização case-insensitive)
- Cada card: ícone, título, body, botão ✕ individual, barra 👍/👎
- Botões de controle: ↻ Mais insights / ✕ Limpar insights
- Timeout 90s com mensagem de fallback e liberação dos botões

### 4.6 Seção de Membros
- Tabela com: avatar (iniciais), nome, papel (atividade), cap. restante, remaining work, % alocado (barra colorida), tasks finalizadas
- Day offs futuros destacados em âmbar abaixo da capacidade
- Ordenada por remaining work decrescente

---

## 5. Dashboard — Módulo Eficiência

### 5.1 Seleção de Sprints
- Dropdown multi-select de todas as sprints disponíveis no time
- Atalhos rápidos: 3 meses / 6 meses / 1 ano (filtra automaticamente pela data)
- Sprint atual marcada com badge verde "atual"
- Contador de sprints selecionadas no botão

### 5.2 KPIs de Eficiência (5 cards)
- **Throughput médio:** média de PBIs/Defects concluídos por sprint selecionada
- **Lead Time médio:** (criação → fechamento) em dias
- **Cycle Time médio:** (ativação → fechamento) em dias
- **Story Points médios por sprint**
- **Taxa de conclusão:** % de itens fechados sobre total

### 5.3 Gráficos (Chart.js 4.4.4)
- **Throughput por sprint** (barras): itens concluídos por sprint
- **Lead Time vs Cycle Time** (linhas): evolução temporal
- **Story Points por sprint** (barras)
- Gráfico completo full-width com modo de exibição alternável (throughput / lead time)
- Seletor de % de cumprimento de capacidade (slider interativo)

### 5.4 Tempo Médio por Coluna do Board
- Para cada item Done, busca suas revisões e calcula quanto tempo passou em cada coluna
- Agrupamento por nome de coluna (`System.BoardColumn` ou `System.State`)
- Exclui colunas Done/Closed/Resolved da medição (apenas tempo ativo)
- Exclui deltas >180 dias (outliers)

### 5.5 Backlog Multi-sprint
- Tabela de todos os PBIs/Defects das sprints selecionadas
- Filtros combinados: texto no título, ID, multi-select de status, executores e sprint
- Estados filtráveis gerados dinamicamente dos dados reais

---

## 6. Dashboard — Módulo Qualidade

### 6.1 Carregamento de Bugs
- WIQL: todos os Bugs e Defects do projeto (não filtrado por sprint)
- Campos: Id, Title, Type, State, AssignedTo, Severity, Priority, CreatedDate, ClosedDate, RemainingWork, CompletedWork, OriginalEstimate
- Filtros na UI: Tipo (Bug/Defect/Ambos), Estado (aberto/fechado/todos), Severidade

### 6.2 KPIs de Qualidade (7 cards)
- Total de bugs/defects
- Bugs abertos vs fechados
- Severidade crítica (Critical/1)
- Bugs abertos por sprint atual
- Tempo médio de resolução (abertos com mais de X dias)
- Taxa de fechamento

### 6.3 Gráficos de Qualidade
- Distribuição por severidade (donut)
- Bugs por estado (barras)
- Evolução temporal de abertura/fechamento (linhas)
- Grade 3 colunas no desktop, 1 no mobile

### 6.4 Timeline de Fluxo por Bug
- Para cada bug, busca tasks filhas via WIQL de links hierárquicos
- Mostra o caminho do bug pelos estados do board
- Destaque para dias em estado de bloqueio

### 6.5 Análise de Qualidade com IA
- Botão "⚡ Analisar com IA" dentro do módulo
- Envia dados de bugs (severidade, aging, distribuição) como contexto ao LLM ativo
- Retorna insights específicos sobre qualidade do produto

---

## 7. Engine de Insights de IA

### 7.1 Geração de Insights (callLlm)
- Lê dados frescos do `APP.sprintData`
- Monta **System Prompt** (persona fixa + regras + exemplos few-shot)
- Monta **User Prompt** (dados variáveis: KPIs, membros, atividades, RAG)
- Chama o LLM ativo (Claude/OpenAI/Gemini) com `temperature:0.2`, `max_tokens:1400`

### 7.2 Agentes Multi-passo
| Agente | Papel |
|---|---|
| **A1** — Analista | Gera 6-10 insights cobrindo Sprint, Eficiência e Qualidade |
| **A2** — Revisor | Remove duplicatas, agrupa insights relacionados, valida coerência |
| **A3** — Comunicador | Reescreve body/title com tom adequado à severidade sem alterar dados |

### 7.3 Parser de Resposta (`_parseInsightJson`)
- Extrai JSON array (procura `[.....]`)
- Fallback 1: JSON.parse diretamente
- Fallback 2: converte texto puro em card `info`
- Detecta e substitui placeholders copiados ("Explique em 1 frase...")
- Normaliza objeto OpenAI (`{ }`) para array (`[{ }]`)

### 7.4 Validador Determinístico (R0-R8)
Ver documento `06_solucao_tecnica.md` para detalhes completos das 8 regras.

### 7.5 Chat Q&A (Floating Chat)
- System prompt mínimo (1 linha)
- Todos os dados + pergunta no user prompt
- `temperature:0.1`, `max_tokens:800`
- Response format: `json_object` (OpenAI) / `responseMimeType:application/json` (Gemini)
- Validação R0 apenas (check matemático)
- Histórico de múltiplas conversas persistido no localStorage
- Renderização Markdown nas respostas (headers, listas, código inline/bloco, bold, italic, links)

---

## 8. RAG — Treinamento do Assistente

### 8.1 Gerenciamento de Contextos
- CRUD completo: criar, editar, ativar/desativar, excluir
- Escopo **Geral**: aplicado a todos os times
- Escopo **Por time**: vinculado a um time específico por ID
- 10 tipos pré-definidos via chips visuais

### 8.2 Injeção no Prompt
- Contextos específicos do time têm prioridade sobre gerais
- Formatados como `## tipo\nespecificação` em bloco único
- Injetados diretamente no user prompt sem split por delimitadores

### 8.3 Feedback de Insights
- Botões 👍/👎 em cada card de insight
- Estado persistido: `voted-good` / `voted-bad` por card (título como chave)
- Aba "Feedback de Insights" mostra histórico com estatísticas (% positivo, total)
- Entradas mostram: badge de emoji, título, body (clampado 2 linhas), timestamp

### 8.4 Histórico de Conversas do Chat
- Aba "Conversas" exibe todas as conversas salvas
- Nome gerado automaticamente (1ª mensagem truncada)
- Data/hora de criação
- Cada conversa contém todos os pares pergunta/resposta

### 8.5 Agentes de IA (Customização de Prompts)
- Aba "Agentes de IA" com editor dos 3 prompts de agente (A1, A2, A3)
- Área de texto editável por agente
- Botão "Restaurar padrão" por agente
- Salvamento em `avai_agent_prompts` no localStorage

---

## 9. Configurações

### 9.1 Vault
- Modo atual (PIN com hash visual ou Sessão)
- Botão "Alterar" para mudar de modo
- "Alterar PIN" abre modal com: PIN atual + novo PIN + confirmação
- "Limpar vault" remove apenas tokens cifrados do localStorage

### 9.2 Dados
- **Exportar JSON:** baixa `agileviewai-config.json` com times, organizações, RAG contexts — **sem tokens**
- **Importar JSON:** merge inteligente (evita duplicatas por nome/email)
- **Apagar tudo:** `localStorage.clear()` + `reload()` — destructive, confirma antes

---

## 10. Export e Compartilhamento

### 10.1 Download HTML Standalone
- Botão "⬇ HTML" no topbar do dashboard
- Usa `data.sprintData` em memória + chama LLM para gerar insights
- Serializa tudo em um HTML com:
  - Dashboard completo renderizado
  - Insights embutidos (sem spinner)
  - `blMeta` com dados do backlog para filtros JavaScript
  - Filtros de backlog funcionando offline
  - Expand de tasks funcionando offline
  - CSS `@media print` com margens 15mm
  - Script `beforeprint` que expande todos os itens
  - Botões de download, chat e "mais insights" removidos
- Arquivo nomeado `dashboard-[sprint-name].html`

---

## 11. Resumo Geral de Funcionalidades

| # | Funcionalidade | Status |
|---|---|---|
| 1 | Vault AES-256-GCM | ✅ Implementado |
| 2 | Gerenciamento de times/orgs | ✅ Implementado |
| 3 | Sync com Azure DevOps | ✅ Implementado |
| 4 | Dashboard Sprint (KPIs, backlog, progresso) | ✅ Implementado |
| 5 | Expand de tasks com timeline do board | ✅ Implementado |
| 6 | Tempo de bloqueio por item | ✅ Implementado |
| 7 | Módulo Eficiência (multi-sprint, gráficos) | ✅ Implementado |
| 8 | Módulo Qualidade (bugs, KPIs, gráficos) | ✅ Implementado |
| 9 | Engine de Insights com validador R0-R8 | ✅ Implementado |
| 10 | Agentes multi-passo (A1/A2/A3) | ✅ Implementado |
| 11 | Chat flutuante com histórico multi-conversa | ✅ Implementado |
| 12 | Markdown nas respostas do chat | ✅ Implementado |
| 13 | RAG com escopo geral e por time | ✅ Implementado |
| 14 | Feedback de insights (👍/👎) | ✅ Implementado |
| 15 | Agentes de IA customizáveis | ✅ Implementado |
| 16 | Download HTML standalone | ✅ Implementado |
| 17 | Export/Import JSON de configurações | ✅ Implementado |
| 18 | Responsividade desktop/tablet/mobile | ✅ Implementado |
| 19 | Team switcher no dashboard | ✅ Implementado |
| 20 | Análise de qualidade com IA | ✅ Implementado |
