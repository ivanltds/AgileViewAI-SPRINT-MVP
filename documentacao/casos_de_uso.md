# AgileViewAI — Casos de Uso

## Atores

| Ator | Descrição |
|---|---|
| **Agile Master / Scrum Master** | Responsável por monitorar a saúde da sprint e tomar ações corretivas |
| **Tech Leader** | Acompanha capacidade técnica e riscos de entrega |
| **Gestor / PO** | Visualiza progresso e toma decisões de priorização |
| **Sistema Azure DevOps** | Fonte de dados de sprints, work items e capacidade |
| **LLM (IA)** | Gera insights e responde perguntas sobre a sprint |

---

## UC-01 — Configurar o Add-on pela Primeira Vez

**Ator:** Agile Master  
**Pré-condição:** Google Sheets aberta, script instalado  
**Fluxo Principal:**
1. Usuário acessa menu AgileViewAI → ⚙️ Setup
2. Sistema cria todas as abas necessárias na planilha
3. Usuário acessa 🤖 IA & Configurações → Configurar tokens de LLM
4. Usuário seleciona o provider (Claude/OpenAI/Gemini) e insere o token
5. Sistema valida e salva o token mascarado na aba `LLM_Config`
6. Usuário acessa 👥 Selecionar time → cadastra organização Azure e time
7. Sistema salva as credenciais e ativa o time selecionado

**Resultado:** Add-on configurado e pronto para sincronizar

---

## UC-02 — Sincronizar Dados da Sprint

**Ator:** Agile Master  
**Pré-condição:** Time configurado com PAT válido, sprint ativa no Azure DevOps  
**Fluxo Principal:**
1. Usuário acessa AgileViewAI → 🔄 Sync
2. Sistema conecta na API do Azure DevOps
3. Sistema busca iterações e identifica a sprint ativa
4. Sistema busca todos os work items da sprint (backlog + tasks)
5. Sistema busca capacidade do time com days off
6. Sistema grava dados nas abas `Sprint_Info`, `Raw_Backlog_Data`, `Raw_Task_Data`, `Raw_Capacity_Data`
7. Sistema registra data/hora e status da sync na aba `Presentation & Config`
8. Dashboard abre automaticamente após sincronização bem-sucedida

**Fluxo Alternativo — Falha de autenticação:**
- Sistema exibe mensagem de erro com a URL que falhou
- Usuário verifica PAT e organização em IA & Configurações → Ver configuração

**Resultado:** Dados atualizados na planilha e dashboard exibido

---

## UC-03 — Visualizar Dashboard da Sprint

**Ator:** Agile Master, Tech Leader, Gestor  
**Pré-condição:** Sync realizado com dados na planilha  
**Fluxo Principal:**
1. Usuário acessa AgileViewAI → 📊 Abrir Dash
2. Sistema lê dados das abas e gera o HTML do dashboard
3. Dashboard exibe KPIs, backlog, progresso e inicia carregamento de insights
4. LLM é consultado de forma assíncrona
5. Insights aparecem no grid ao serem gerados (até 90s de timeout)
6. Usuário explora o backlog expandindo itens e filtrando por status
7. Usuário consulta distribuição de capacidade por responsável

**Resultado:** Visão completa e atualizada da sprint

---

## UC-04 — Analisar Insights de IA

**Ator:** Agile Master  
**Pré-condição:** Dashboard aberto com LLM configurado  
**Fluxo Principal:**
1. Dashboard carrega e inicia consulta ao LLM automaticamente
2. Insights aparecem categorizados por severidade (critical/warning/info/ok)
3. Agile Master lê os alertas de sobrecarga agrupados por papel
4. Agile Master identifica membros ociosos e oportunidades de redistribuição
5. Agile Master remove insights irrelevantes clicando no ✕ de cada card
6. Agile Master clica em "↻ Mais insights" para obter perspectivas adicionais

**Fluxo Alternativo — Insight incorreto:**
- Se o insight contraria o contexto do time, usuário cadastra RAG com a explicação
- Na próxima análise, o validador determinístico e o LLM respeitarão o contexto

**Resultado:** Lista curada de riscos e oportunidades da sprint

---

## UC-05 — Fazer Pergunta Livre ao LLM

**Ator:** Agile Master, Tech Leader  
**Pré-condição:** Dashboard aberto, LLM configurado  
**Fluxo Principal:**
1. Usuário clica em "💬 Fazer pergunta"
2. Painel de chat é exibido
3. Usuário digita uma pergunta (ex: "Quem tem mais risco de não entregar?")
4. Sistema lê dados frescos da planilha e constrói o contexto completo
5. LLM gera resposta baseada em KPIs, capacidade individual, alocação por atividade e RAG
6. Resposta aparece como card abaixo do campo de entrada
7. Usuário pode fazer perguntas adicionais (histórico acumulado)

**Exemplos de perguntas:**
- "Como está a sprint no geral?"
- "Quantos QA tem no time?"
- "Quais os riscos de não entrega?"
- "Quem são as pessoas alocadas?"
- "Como está a saúde do Back End?"

**Resultado:** Resposta contextualizada e baseada nos dados reais da sprint

---

## UC-06 — Cadastrar Contexto RAG

**Ator:** Agile Master  
**Pré-condição:** Dashboard ou add-on aberto  
**Fluxo Principal:**
1. Usuário acessa 🤖 IA & Configurações → Cadastrar RAG / Treinamento
2. Sistema exibe painel com contextos existentes e filtros por escopo
3. Usuário seleciona escopo (Geral ou Por time específico)
4. Usuário seleciona o tipo de contexto (ex: "Itens negociados para próxima sprint")
5. Usuário descreve a situação no campo de especificação
6. Sistema salva na aba `RAG_Context` com ID e timestamp

**Exemplos de uso:**
- "Piovesan está alocado no PBI #10858 por acordo com o PO, não redistribuir"
- "Karen atuará em refinamentos nas próximas 2 sprints, baixa alocação é esperada"
- "Time opera em velocidade reduzida por causa de onboarding de novo membro"

**Resultado:** LLM passa a considerar o contexto nas próximas análises

---

## UC-07 — Gerenciar Múltiplos Times

**Ator:** Agile Master  
**Pré-condição:** Add-on instalado  
**Fluxo Principal:**
1. Usuário acessa AgileViewAI → 👥 Selecionar time
2. Sistema exibe painel com lista de times cadastrados
3. Usuário cadastra novo time preenchendo: nome, organização, projeto, team Azure
4. Se a organização não existe, usuário seleciona "+ Nova organização" e insere o PAT
5. Sistema reutiliza PAT existente para organizations já cadastradas
6. Usuário ativa o time desejado clicando em "Usar este time"
7. Sistema copia credenciais do time para `Presentation & Config`

**Resultado:** Time ativo alterado; próxima sync usará as credenciais do novo time

---

## UC-08 — Baixar Dashboard para Compartilhamento

**Ator:** Agile Master, Gestor  
**Pré-condição:** Dashboard aberto e atualizado  
**Fluxo Principal:**
1. Usuário clica em "⬇ Baixar HTML" no canto inferior direito
2. Sistema gera HTML standalone com insights embutidos (~20-30s)
3. Arquivo é baixado com nome `dashboard-sprint-[nome].html`
4. Usuário compartilha o arquivo com stakeholders
5. Destinatário abre o HTML em qualquer browser, sem dependência de internet
6. Destinatário pode filtrar o backlog, expandir tasks e imprimir

**Fluxo Alternativo — Download PDF:**
1. Usuário clica em "📄 Baixar PDF"
2. Sistema gera HTML, converte via Google Drive e salva PDF no Drive
3. Link de download é retornado e o browser inicia o download
4. PDF fica salvo no Google Drive com nome e timestamp

**Resultado:** Dashboard completo e autossuficiente para compartilhamento

---

## UC-09 — Imprimir o Dashboard

**Ator:** Agile Master, Gestor  
**Pré-condição:** Arquivo HTML baixado aberto no browser  
**Fluxo Principal:**
1. Usuário abre o arquivo HTML no browser
2. Usuário usa Ctrl+P (ou Cmd+P no Mac) para imprimir
3. Browser dispara evento `beforeprint`
4. Sistema expande automaticamente todos os itens do backlog e tasks filhas
5. Sistema exibe o painel de atividades expandido
6. CSS `@media print` remove botões, scrolls e formata para papel (margem 15mm)
7. Conteúdo é impresso completo, sem cortes por scroll

**Resultado:** Impresso completo com todos os dados visíveis

---

## UC-10 — Diagnosticar Problemas de Conexão

**Ator:** Agile Master  
**Pré-condição:** Sync falhando ou retornando dados incorretos  
**Fluxo Principal:**
1. Usuário acessa 🤖 IA & Configurações → Ver configuração e URL do Azure
2. Sistema exibe organização, projeto, PAT mascarado e team configurados
3. Sistema exibe as URLs exatas que serão usadas para cada endpoint da API
4. Usuário valida se a URL está correta e o PAT tem as permissões necessárias
5. Usuário acessa 🤖 IA & Configurações → Ver contexto RAG enviado ao LLM
6. Sistema exibe o texto completo enviado como contexto, separado por escopo

**Resultado:** Usuário identifica e corrige o problema de configuração
