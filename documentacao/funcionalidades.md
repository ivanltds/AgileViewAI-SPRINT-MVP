# AgileViewAI — Descrição de Funcionalidades

## Visão Geral

AgileViewAI é uma solução de monitoramento de sprints integrada ao Azure DevOps e Google Sheets. Funciona como um add-on do Google Apps Script que sincroniza dados de sprints, capacidade e backlog do Azure DevOps e apresenta um dashboard interativo com análise de IA, geração de insights automáticos e chat de perguntas livres.

---

## 1. Menu Principal

O add-on adiciona o menu **AgileViewAI** ao Google Sheets com as seguintes opções:

| Item de Menu | Descrição |
|---|---|
| ⚙️ Setup | Cria e valida todas as abas necessárias na planilha |
| 👥 Selecionar time | Abre painel para selecionar o time ativo entre os cadastrados |
| 🔄 Sync | Sincroniza dados do Azure DevOps e abre o dashboard automaticamente |
| 📊 Abrir Dash | Abre o dashboard sem sincronizar |
| 🤖 IA & Configurações | Submenu com configurações de LLM e RAG |
| → Configurar tokens de LLM | Cadastra/atualiza tokens de OpenAI, Claude ou Gemini |
| → Cadastrar RAG / Treinamento | Adiciona contexto de treinamento para os insights |
| → Ver contexto RAG enviado ao LLM | Exibe o contexto RAG que está sendo enviado |
| → Ver configuração e URL do Azure | Diagnóstico da configuração atual e URL de acesso |

---

## 2. Setup e Configuração

### 2.1 Criação de Abas
O setup cria automaticamente as seguintes abas na planilha caso não existam:

| Aba | Conteúdo |
|---|---|
| `Presentation & Config` | Configuração ativa: org, projeto, PAT, time, status de última sync |
| `Sprint_Info` | Dados da sprint: caminho, início, fim, sprint ativa, dias úteis restantes |
| `Raw_Backlog_Data` | Itens de backlog: ID, tipo, título, status, severidade, bloqueio, responsável, SP, tags, remaining work |
| `Raw_Task_Data` | Tasks: ID, parent ID, tipo, título, status, horas restantes, concluídas, responsável, atividade, bloqueio |
| `Raw_Capacity_Data` | Capacidade: membro, atividade, cap/dia, days off, total days off, cap total, cap restante |
| `Teams` | Times cadastrados com org, projeto, PAT e status |
| `Organizations` | Organizações Azure com PAT associado |
| `LLM_Config` | Configuração de LLM: provider, token mascarado, ativo |
| `RAG_Context` | Contexto de treinamento por escopo (geral ou por time) |

### 2.2 Gerenciamento de Times
- Múltiplos times de múltiplas organizações Azure podem ser cadastrados
- PAT é vinculado à organização e compartilhado entre times da mesma org
- Apenas um time fica ativo por vez; a seleção copia as credenciais para `Presentation & Config`
- Interface HTML com lista de cards e formulário de cadastro

---

## 3. Sincronização com Azure DevOps

### 3.1 Dados Coletados via API
A sincronização busca na API REST do Azure DevOps:
- **Iterações (Sprints):** lista de sprints da área do time, identificando a sprint ativa
- **Work Items:** backlog (PBIs, Defects, Bugs) e tasks filhas, com todos os campos relevantes
- **Capacidade do Time:** capacidade por membro por atividade, incluindo days off

### 3.2 Regras de Negócio
- **Dias úteis:** calculados via `Date.UTC` para evitar problemas de fuso horário; hoje é incluído na contagem (alinhado ao comportamento do Azure)
- **Days off:** comparados em midnight UTC para garantir precisão
- **Classificação de itens:** PBIs e Defects sem parent são backlog level; Tasks e Bugs com parent são child level
- **Status de bloqueio:** `BLOCKED` (aguardando), `FIXING` (em correção), `CLEAR` (livre)
- **URL da API:** team name encoded por palavra (`split(" ").map(encodeURIComponent).join("%20")`) para evitar erros 404

---

## 4. Dashboard

O dashboard é uma interface HTML gerada pelo servidor e exibida como modal no Google Sheets.

### 4.1 Topbar
- Nome do projeto e organização
- Nome da sprint com indicador animado de sprint ativa
- Pill com dias úteis restantes (verde) ou "Encerrada" (vermelho)
- Datas de início e fim em português

### 4.2 KPIs (6 cards)
| KPI | Descrição |
|---|---|
| Total | Total de PBIs e Defects na sprint |
| Concluídos | Itens com status Done (% do total) |
| Em progresso | Itens em andamento sem bloqueio |
| Bloqueados | Itens com blockStatus = BLOCKED (fundo vermelho se > 0) |
| Em fixing | Itens com blockStatus = FIXING (fundo vermelho se > 0) |
| Demandas alocadas | % de remaining work / capacidade total |

### 4.3 Backlog da Sprint
- Tabela expandível com filtros: Todos / To Do / Em progresso / Concluído / Bloqueados / Fixing
- Linhas vermelhas para BLOCKED, amarelas para FIXING
- Avatares com iniciais dos responsáveis pelas tasks filhas
- Expand de linha: tasks em 2 colunas (Em andamento | Concluído)
- Links diretos para os work items no Azure DevOps

### 4.4 Painel de Progresso
- Barra de progresso de itens concluídos
- Barra de capacidade alocada
- Cards de ritmo: capacidade disponível/dia vs ritmo necessário/dia
- Painel "Ver por atividade" com breakdown por tipo de atuação (expandível)
- Contador de tasks abertas e finalizadas
- Cards de day off com datas e membros

### 4.5 Seção de Insights de IA
- Carregamento assíncrono com spinner enquanto o LLM analisa
- Grid 2 colunas com cards coloridos por severidade
- Botão **↻ Mais insights:** acumula novos cards com deduplicação por título
- Botão **✕ Limpar insights:** remove todos os cards
- Botão **💬 Fazer pergunta:** abre painel de chat
- Botão **✕** em cada card para remover individualmente

### 4.6 Chat de Perguntas Livres
- Campo de texto com botão "Perguntar"
- Cada pergunta gera um card de resposta abaixo (histórico acumulado)
- Enter no campo envia a pergunta
- Timeout de 60s com desbloqueio automático do UI

### 4.7 Distribuição por Responsável
- Tabela com: avatar, nome, papel, cap. restante, rem. work, % alocado (barra colorida), tasks finalizadas
- Days off em destaque âmbar abaixo da capacidade
- Ordenado por remaining work decrescente

---

## 5. Engine de Insights de IA

### 5.1 Providers Suportados
- **Claude** (Anthropic) — `claude-sonnet-4-5`
- **OpenAI** — `gpt-4o`
- **Gemini** (Google) — `gemini-1.5-pro`

### 5.2 Arquitetura de Geração
1. `callLlmWithData()` lê dados frescos da planilha
2. `_callLlm()` monta prompts system + user e chama o LLM escolhido
3. `_validateInsights()` aplica 8 regras determinísticas sobre os insights retornados
4. `_renderInsightCards()` gera o HTML dos cards com severidade e cor

### 5.3 Regras de Validação (Determinísticas)
| Regra | Descrição |
|---|---|
| R0 | Se `rem < cap` total, qualquer insight de risco de entrega sem citar membro é corrigido para "Capacidade com folga" |
| R1 | Critical baseado em totais agregados (sem membro) com allocPct < 100% → rebaixa para info |
| R2 | Critical sem nenhum membro >100% nos dados reais → rebaixa para warning |
| R3 | Critical/warning sobre situação já tratada no RAG → rebaixa para ok (exceto sobrecarga real) |
| R5 | ok/info com linguagem de conformidade sobre membro com <70% de alocação → rebaixa para warning |
| R6 | Membros >100% omitidos em todos os cards → complementa card existente ou injeta novo |
| R7 | Múltiplos cards critical → consolida em 1 único card "Alertas de Sobrecarga" |
| R8 | Membros <70% não cobertos em nenhum card → injeta card de warning por papel |

### 5.4 Severidades e Cores
| Severidade | Cor de fundo | Cor da borda | Uso |
|---|---|---|---|
| critical 🚨 | vermelho claro | vermelho | Sobrecarga >100% não justificada |
| warning ⚠️ | amarelo claro | âmbar | Ociosidade <70%, bloqueios, risks |
| info 💡 | azul claro | azul | Oportunidades, observações |
| ok ✅ | verde claro | verde | Conformidade, situações tratadas |

---

## 6. RAG (Retrieval-Augmented Generation)

### 6.1 Estrutura
Contextos de treinamento armazenados na aba `RAG_Context` com campos: ID, Escopo, Time ID, Tipo de Contexto, Especificação, Ativo, Criado em.

### 6.2 Escopos
- **Geral:** aplicado a todos os times
- **Por time:** aplicado apenas ao time ativo (match por Team ID)

### 6.3 Tipos de Contexto
10 chips pré-definidos: acordos de time, capacidade especial, itens negociados, membros em férias, riscos conhecidos, dependências externas, definição de pronto, velocidade histórica, contexto de negócio, notas técnicas.

### 6.4 Injeção no Prompt
O contexto RAG é injetado diretamente no user prompt sem split, formatado com headers `##` que o LLM lê nativamente. O contexto específico do time tem prioridade sobre o contexto geral.

---

## 7. Download do Dashboard

### 7.1 Baixar HTML
- Gera HTML standalone via `getDashboardHtml()` no servidor
- Inclui insights gerados pelo LLM embutidos no arquivo
- Remove botões interativos (chat, mais insights, download) que não funcionam offline
- CSS de impressão automático com `@media print`
- Script `beforeprint` expande todos os itens antes de imprimir
- Filtros de backlog e expand de tasks funcionam no arquivo offline

### 7.2 Baixar PDF
- Gera HTML clean via `getDashboardHtml()`
- Converte para PDF usando `DriveApp.getAs(MimeType.PDF)` nativamente no Google Drive
- Salva o PDF no Drive do usuário com nome `AgileViewAI_Dashboard_YYYY-MM-DD_HH-mm.pdf`
- Retorna link de download direto
- Arquivo HTML temporário é descartado automaticamente

---

## 8. Diagnósticos

### 8.1 Ver configuração e URL do Azure
Exibe em uma caixa de diálogo:
- Configuração atual (org, projeto, team, PAT mascarado)
- URL exata que será usada para cada endpoint da API
- Útil para depurar erros de autenticação ou 404

### 8.2 Ver contexto RAG enviado ao LLM
Exibe o texto completo que será enviado como contexto ao LLM, separado por escopo (time + geral), para validar se o treinamento está correto.
