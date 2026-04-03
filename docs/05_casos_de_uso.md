# AgileViewAI — Casos de Uso Completos

---

## Atores

| Ator | Descrição |
|---|---|
| **Agile Master / Scrum Master** | Monitora saúde da sprint, facilita cerimônias, toma ações corretivas |
| **Tech Leader** | Acompanha capacidade técnica, riscos de entrega, decisões de arquitetura |
| **Gestor / PO** | Visualiza progresso, toma decisões de priorização e escopo |
| **Sistema Azure DevOps** | Fonte de dados de sprints, work items e capacidade |
| **LLM (IA)** | Gera insights e responde perguntas sobre a sprint |

---

## UC-01 — Configurar Vault e Primeiras Credenciais

**Atores:** Agile Master  
**Pré-condição:** Arquivo HTML aberto pela primeira vez no browser  
**Fluxo Principal (modo PIN):**
1. Usuário abre `agileviewai2.3.html` no browser
2. Sistema exibe a tela do Vault com duas abas: PIN e Sessão
3. Usuário mantém aba PIN selecionada e digita um PIN de 4-8 dígitos
4. Sistema gera salt aleatório (16 bytes), deriva chave com PBKDF2 (600k iterações, SHA-256)
5. Sistema cifra o desafio de verificação com AES-256-GCM e salva no localStorage
6. Sistema libera o app e exibe a tela principal com sidebar

**Fluxo Alternativo (modo Sessão):**
1. Usuário clica na aba "Sessão"
2. Sistema exibe aviso sobre comportamento efêmero dos tokens
3. Usuário clica "Continuar sem salvar tokens"
4. Sistema exibe o app sem configurar localStorage de vault
5. Tokens ficam apenas em memória; são apagados ao fechar o browser

**Fluxo Alternativo (Vault já configurado):**
1. Usuário reabre o app
2. Sistema detecta `avai_vault_check` no localStorage
3. Sistema exibe campo de PIN
4. Usuário digita o PIN
5. Sistema verifica decifrado: se correto, libera; se incorreto, exibe erro

**Resultado:** App disponível para uso; vault configurado segundo preferência do usuário

---

## UC-02 — Gerenciar Tokens LLM

**Atores:** Agile Master  
**Pré-condição:** Vault desbloqueado  

**UC-02a — Adicionar Token:**
1. Usuário acessa **🤖 IA & Tokens**
2. Usuário clica em **+ Novo token**
3. Sistema exibe modal com selector de provider (OpenAI/Claude/Gemini) e campo de token
4. Usuário seleciona provider e cola o token
5. Sistema cifra o token com AES-256-GCM e salva em `avai_llm`
6. Sistema exibe o token com `sk-...` mascarado e badge **Ativo** (se for o primeiro)

**UC-02b — Trocar Token Ativo:**
1. Usuário clica em **Usar** no token desejado
2. Sistema marca o token anterior como inativo e ativa o novo
3. Sistema exibe toast de confirmação

**UC-02c — Excluir Token:**
1. Usuário clica em **Remover** no token
2. Sistema remove da lista; se era o ativo, nenhum token fica ativo
3. Sistema exibe aviso se não houver token ativo

**Resultado:** Token LLM configurado e ativo para análises de IA

---

## UC-03 — Gerenciar Times e Organizações

**Atores:** Agile Master  
**Pré-condição:** Vault desbloqueado  

**UC-03a — Cadastrar Organização:**
1. Usuário acessa **👥 Times**
2. Usuário clica em **+ Nova organização**
3. Preencha nome e PAT
4. Sistema cifra o PAT e salva em `avai_orgs`
5. Organização aparece na lista

**UC-03b — Cadastrar Time com Nova Organização:**
1. Usuário clica em **+ Novo time**
2. Preencha nome do time, seleciona "+ Nova organização" no dropdown de org
3. Preencha nome da org, projeto, team Azure e PAT
4. Sistema cria organização + time, vinculando o PAT à org
5. Time aparece na lista com badge **Inativo**

**UC-03c — Cadastrar Time em Organização Existente:**
1. Usuário clica em **+ Novo time**
2. Seleciona organização existente na lista
3. Campo de PAT desaparece (reutilização automática)
4. Preencha nome do time, projeto e team Azure
5. Sistema cria o time vinculado à org existente

**UC-03d — Ativar Time:**
1. Usuário clica em **Usar este time** no card do time
2. Sistema define o time como ativo em `avai_active_team`
3. Próxima sincronização usará as credenciais deste time

**UC-03e — Trocar Time no Dashboard:**
1. Usuário clica no dropdown do time no topbar do dashboard
2. Lista de times disponíveis aparece
3. Usuário clica em outro time
4. Sistema atualiza o time ativo e exibe o cache de dados do novo time (se existir)

**UC-03f — Editar PAT de Organização:**
1. Usuário clica em **Editar** na organização
2. Preenche novo PAT
3. Sistema re-cifra e salva

**Resultado:** Time ativo configurado com credenciais corretas

---

## UC-04 — Sincronizar Sprint

**Atores:** Agile Master  
**Pré-condição:** Time ativo com PAT válido; sprint existente no Azure DevOps  

**Fluxo Principal:**
1. Usuário clica em **🔄 Sincronizar**
2. Sistema desabilita o botão e exibe toast "🔄 Sincronizando..."
3. Sistema busca todas as iterações do time via API
4. Sistema identifica a sprint ativa (startDate ≤ hoje ≤ finishDate+1dia)
5. Sistema busca IDs dos work items via WIQL
6. Sistema busca detalhes em batch (lotes de 200)
7. Sistema busca histórico de revisões para calcular estimativas (batch de 8 paralelos)
8. Sistema busca capacidade do time com days off
9. Sistema calcula stats (KPIs, byMember, byActivity, dayOffCards)
10. Sistema salva em `avai_sprint_cache` e renderiza o dashboard

**Fluxo Alternativo — PAT Inválido (401):**
1. Fetch retorna HTTP 401
2. Sistema lança erro "HTTP 401: ..."
3. Toast de erro exibido com a mensagem HTTP
4. Dashboard permanece com dados anteriores (se houver cache)

**Fluxo Alternativo — Team Not Found (404):**
1. Fetch retorna HTTP 404
2. Sistema lança erro "HTTP 404: ..."
3. Toast de erro; usuário deve verificar o nome do time

**Fluxo Alternativo — Sem Sprint Ativa:**
1. Nenhuma iteração tem startDate ≤ hoje ≤ finishDate
2. Sistema usa fallback: sprint mais recentemente encerrada
3. Se não houver encerrada, usa a próxima sprint futura
4. Dashboard exibe pílula "Encerrada"

**Resultado:** Dashboard atualizado com dados frescos do Azure DevOps

---

## UC-05 — Visualizar Dashboard de Sprint

**Atores:** Agile Master, Tech Leader, Gestor  
**Pré-condição:** Sync realizado com dados no cache  

**Fluxo Principal:**
1. Usuário acessa tab **📋 Sprint** (padrão)
2. Sistema renderiza:
   - Topbar com projeto, org, nome da sprint, dias restantes
   - 6 KPIs com tooltips
   - Tabela de backlog com filtros
   - Painel de progresso (direita)
3. Seção de insights inicia carregamento assíncrono (spinner)
4. Em 10-90s, insights aparecem no grid

**UC-05a — Filtrar Backlog:**
1. Usuário clica em filtro "Bloqueados"
2. Sistema filtra a tabela para `blockStatus=BLOCKED`
3. Contador de itens atualiza

**UC-05b — Ordenar Tabela:**
1. Usuário clica no cabeçalho "Status"
2. Sistema ordena em cycle: neutro→asc→desc→neutro
3. Seta visual indica direção atual

**UC-05c — Expandir Item:**
1. Usuário clica na linha do PBI #10858
2. Sistema abre `children-row` com tasks divididas em 2 colunas
3. Cada card de task mostra: badge, ID, título, status, horas e responsável

**UC-05d — Ver Timeline do Board:**
1. Dentro do expand, usuário clica em "📋 Histórico do Board"
2. Sistema busca revisões do item via API
3. Sistema calcula tempo em cada coluna
4. Timeline é exibida com steps mostrando dias por coluna

**UC-05e — Expandir Atividades:**
1. Usuário clica "Ver por atividade ▾" no painel de progresso
2. Lista de atividades com capacidade e barra individual aparece

**Resultado:** Visão completa e detalhada da sprint atual

---

## UC-06 — Analisar Insights de IA

**Atores:** Agile Master  
**Pré-condição:** Dashboard aberto, LLM configurado, dados sincronizados  

**Fluxo Principal:**
1. Insights carregam automaticamente com o dashboard
2. Sistema monta system prompt + user prompt com dados da sprint
3. Sistema chama o LLM ativo via API
4. Sistema parseia o JSON retornado
5. Sistema aplica validador determinístico R0-R8
6. Cards aparecem no grid organizados por severidade

**UC-06a — Dar Feedback em Card:**
1. Usuário clica 👍 em card de insight correto
2. Sistema salva em `avai_insight_fb` com título, vote e timestamp
3. Badge muda para `.voted-good` (verde)

**UC-06b — Remover Card Individual:**
1. Usuário clica **✕** no card
2. Sistema remove o elemento do DOM; não afeta outros cards

**UC-06c — Gerar Mais Insights:**
1. Usuário clica **↻ Mais insights**
2. Sistema faz nova chamada ao LLM
3. Novos cards são adicionados ao grid
4. Cards com títulos iguais (normalizado: lowercase + trim) são ignorados
5. Botão exibe "(+N)" com o número de cards adicionados

**UC-06d — Timeout de IA:**
1. LLM não responde em 90 segundos
2. Spinner é substituído por mensagem "⏱ Tempo esgotado. Clique em ↻ para tentar novamente"
3. Botão "↻ Mais insights" é reabilitado

**Resultado:** Lista curada de riscos, oportunidades e conformidades da sprint

---

## UC-07 — Chat com IA

**Atores:** Agile Master, Tech Leader, Gestor  
**Pré-condição:** LLM configurado e dados sincronizados  

**Fluxo Principal:**
1. Usuário clica no botão FAB 💬 (fixo no canto inferior direito)
2. Painel de chat abre com animação suave
3. Usuário digita pergunta e pressiona Enter (ou clica ↑)
4. Sistema lê dados de `APP.sprintData`
5. Sistema monta prompt com todos os dados da sprint + pergunta
6. Sistema chama LLM com temperature=0.1
7. Resposta aparece como card no histórico com Markdown renderizado
8. Campo de texto é reabilitado para nova pergunta

**UC-07a — Nova Conversa:**
1. Usuário clica **✏️** no header do chat
2. Sistema cria nova conversa com ID único e timestamp
3. Campo de mensagens é limpo

**UC-07b — Ver Histórico de Conversas:**
1. Usuário clica **📋** no header do chat
2. Sidebar com lista de conversas abre
3. Usuário clica em conversa anterior
4. Sistema carrega as mensagens da conversa selecionada

**UC-07c — Excluir Conversa:**
1. Usuário hover em uma conversa
2. Ícone 🗑️ aparece
3. Usuário clica; conversa é removida da lista e do localStorage

**UC-07d — Timeout do Chat:**
1. LLM não responde em 60 segundos
2. Sistema exibe "⏱ Tempo esgotado" no lugar do spinner
3. Campo de texto e botão enviar são reabilitados

**Resultado:** Respostas contextualizadas baseadas nos dados reais da sprint

---

## UC-08 — Analisar Eficiência Multi-Sprint

**Atores:** Agile Master, Tech Leader  
**Pré-condição:** Time ativo com sincronizações anteriores, sprints disponíveis  

**Fluxo Principal:**
1. Usuário clica na tab **⚡ Eficiência**
2. Usuário clica em **6 meses** (período rápido)
3. Sistema preenche automaticamente as sprints dos últimos 6 meses
4. Usuário clica em **⚡ Calcular**
5. Sistema busca todos os work items das sprints via WIQL multi-iteração
6. Sistema busca revisões para timeline de board (até 40 itens Done)
7. Sistema calcula: throughput, lead time, cycle time, story points por sprint
8. Sistema renderiza KPIs + gráficos (throughput, lead/cycle time, SP)
9. Tabela de backlog das sprints selecionadas aparece abaixo

**UC-08a — Analisar Backlog Histórico:**
1. Sistema renderiza tabela com todos os PBIs/Defects das sprints
2. Usuário usa filtros: texto, ID, status, executores, sprint
3. Filtros funcionam combinados

**UC-08b — Calcular Capacidade por Percentual:**
1. Usuário move o slider de % de capacidade no gráfico de eficiência
2. Sistema recalcula: "Com X% de utilização, o time entrega Y itens/sprint"

**Resultado:** Análise histórica de velocidade, lead time e gargalos de entrega

---

## UC-09 — Analisar Qualidade

**Atores:** Agile Master, Gestor, PO  
**Pré-condição:** Time ativo com PAT válido  

**Fluxo Principal:**
1. Usuário clica na tab **🎯 Qualidade**
2. Usuário clica em **🎯 Carregar**
3. Sistema busca TODOS os bugs e defects do projeto (não filtrado por sprint)
4. Sistema busca tasks filhas de defects via WIQL de links
5. Sistema calcula KPIs: total, abertos, fechados, críticos, tempo médio de resolução
6. Sistema renderiza 3 gráficos: distribuição por severidade, por estado, timeline

**UC-09a — Filtrar Bugs:**
1. Usuário ajusta filtros: Tipo (Bug/Defect), Estado (aberto/fechado), Severidade
2. KPIs e gráficos atualizam

**UC-09b — Analisar Qualidade com IA:**
1. Usuário clica **⚡ Analisar com IA**
2. Sistema envia dados de bugs ao LLM
3. Insights de qualidade aparecem com severidade e recomendações

**Resultado:** Diagnóstico de qualidade do produto com tendências históricas

---

## UC-10 — Gerenciar RAG (Treinamento)

**Atores:** Agile Master  
**Pré-condição:** Vault desbloqueado  

**UC-10a — Adicionar Contexto:**
1. Usuário acessa **🎓 Treinamento → Contextos**
2. Usuário clica **+ Novo contexto**
3. Seleciona escopo (Geral/Por time)
4. Seleciona tipo de contexto via chip
5. Escreve a especificação
6. Clica **Salvar**
7. Na próxima análise de IA, o contexto será injetado no prompt

**UC-10b — Desativar Contexto:**
1. Usuário clica no toggle ou botão "Desativar" do contexto
2. O contexto fica marcado como `active:false`
3. Não será incluído no próximo prompt

**UC-10c — Ver Feedback de Insights:**
1. Usuário acessa aba **👍 Feedback de Insights**
2. Sistema exibe estatísticas: total de feedbacks, % positivo
3. Lista de insights votados com badge 👍/👎, título, body (truncado) e data

**UC-10d — Ver Histórico de Conversas:**
1. Usuário acessa aba **💬 Conversas**
2. Lista de conversas salvas com título e data
3. Usuário clica para ver o conteúdo completo

**UC-10e — Personalizar Agentes de IA:**
1. Usuário acessa aba **🤖 Agentes de IA**
2. Seleciona o agente (A1 Analista / A2 Revisor / A3 Comunicador)
3. Edita o prompt na textarea
4. Clica **Salvar**; ou **Restaurar padrão** para voltar ao prompt original

**Resultado:** IA calibrada com contexto específico do time

---

## UC-11 — Exportar e Compartilhar

**Atores:** Agile Master, Gestor  
**Pré-condição:** Dashboard sincronizado  

**UC-11a — Download do Dashboard HTML:**
1. Usuário clica em **⬇ HTML** no topbar
2. Sistema renderiza o dashboard com dados atuais
3. Sistema faz chamada ao LLM para gerar insights embutidos
4. Sistema serializa o HTML com:
   - Insights embutidos (sem spinner)
   - Scripts de filtros e expand offline
   - CSS de impressão
5. Browser inicia download do arquivo `dashboard-[sprint-name].html`
6. Usuário compartilha via e-mail ou Slack

**UC-11b — Imprimir Dashboard Offline:**
1. Destinatário abre o arquivo `.html` no browser
2. Abre diálogo de impressão (Ctrl+P)
3. Sistema expande automaticamente todos os items e tasks
4. CSS `@media print` formata para papel A4 com margens 15mm
5. Imprime sem barras de rolagem ou botões

**UC-11c — Exportar Configurações:**
1. Usuário acessa **⚙️ Configurações → Exportar JSON**
2. Browser baixa `agileviewai-config.json` com times, orgs, RAG (sem tokens)
3. Usuário envia o arquivo para colega

**UC-11d — Importar Configurações:**
1. Usuário abre o app em novo browser/máquina
2. Configura o Vault (novo PIN)
3. Acessa **⚙️ Configurações → Importar JSON**
4. Seleciona o arquivo exportado
5. Sistema faz merge (por nome de time/org para evitar duplicatas)
6. Usuário configura tokens LLM e PATs manualmente (não exportados)

**Resultado:** Dados compartilhados com stakeholders ou migração para nova instalação

---

## UC-12 — Configurações do Vault

**Atores:** Agile Master  
**Pré-condição:** Vault desbloqueado  

**UC-12a — Alterar Mode de Vault:**
1. Usuário acessa **⚙️ Configurações**
2. Clica **Alterar** no modo atual
3. Sistema solicita confirmação e novo modo
4. Tokens são migrados conforme o novo modo

**UC-12b — Trocar PIN:**
1. Usuário clica **Alterar PIN**
2. Modal solicita: PIN atual + novo PIN + confirmação
3. Sistema verifica PIN atual
4. Sistema deriva nova chave e re-cifra TODOS os tokens armazenados
5. Salva cheque atualizado no localStorage

**UC-12c — Apagar Tudo:**
1. Usuário clica **Apagar tudo**
2. Sistema alerta: ação irreversível
3. Usuário confirma
4. Sistema executa `localStorage.clear()` e recarrega o browser

**Resultado:** Configurações de segurança ajustadas conforme necessidade

---

## Matriz de Casos de Uso por Ator

| Caso de Uso | Agile Master | Tech Leader | Gestor/PO |
|---|---|---|---|
| UC-01 Configurar Vault | ✅ Principal | ✅ | ✅ |
| UC-02 Gerenciar Tokens LLM | ✅ Principal | ✅ | — |
| UC-03 Gerenciar Times | ✅ Principal | ✅ | — |
| UC-04 Sincronizar Sprint | ✅ Principal | ✅ | — |
| UC-05 Visualizar Dashboard Sprint | ✅ Principal | ✅ | ✅ |
| UC-06 Analisar Insights IA | ✅ Principal | ✅ | — |
| UC-07 Chat com IA | ✅ Principal | ✅ | ✅ |
| UC-08 Eficiência Multi-sprint | ✅ Principal | ✅ | ✅ |
| UC-09 Analisar Qualidade | ✅ Principal | ✅ | ✅ |
| UC-10 Gerenciar RAG | ✅ Principal | ✅ | — |
| UC-11 Exportar e Compartilhar | ✅ Principal | — | ✅ |
| UC-12 Configurações Vault | ✅ Principal | ✅ | — |
