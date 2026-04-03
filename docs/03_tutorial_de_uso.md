# AgileViewAI — Tutorial de Uso Completo

---

## Pré-requisitos

Antes de começar, reúna:

| Item | Onde obter |
|---|---|
| Arquivo `agileviewai2.3.html` | Download do repositório |
| **PAT Azure DevOps** | `dev.azure.com` → seu perfil → *Personal Access Tokens* → New Token |
| **Token de LLM** | OpenAI, Anthropic ou Google (ver tabela abaixo) |
| Browser moderno | Chrome 90+, Edge 90+, Firefox 88+, Safari 15+ |

**Permissões necessárias no PAT:**
- `Work Items` → **Read**
- `Project and Team` → **Read**

**Onde obter tokens de LLM:**
| Provider | URL |
|---|---|
| OpenAI (GPT-4o) | [platform.openai.com](https://platform.openai.com) → API Keys |
| Claude (Anthropic) | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| Gemini (Google) | [aistudio.google.com](https://aistudio.google.com) → Get API Key |

---

## Passo 1 — Configurar o Vault (primeira abertura)

1. Abra o arquivo `agileviewai2.3.html` diretamente no browser (duplo clique ou Ctrl+O)
2. A tela do **Vault** abrirá automaticamente

**Se quiser proteger seus tokens com PIN (recomendado):**
1. Mantenha a aba **🔒 Vault (PIN)** selecionada
2. Digite um PIN de **4 a 8 dígitos** no campo
3. Clique em **Entrar**
4. Na próxima abertura, o mesmo PIN será solicitado para decifrar os tokens

> 💡 **PIN é criptografia:** seus tokens ficam cifrados com AES-256-GCM. Sem o PIN, não é possível recuperar os dados.

**Se preferir não usar PIN (tokens apenas na sessão):**
1. Clique na aba **⚡ Sessão**
2. Clique em **Continuar sem salvar tokens**
3. Os tokens serão apagados ao fechar o browser

---

## Passo 2 — Configurar Token de LLM

1. Na barra lateral esquerda, clique em **🤖 IA & Tokens**
2. Clique em **+ Novo token**
3. No modal:
   - **Provider:** selecione OpenAI, Claude ou Gemini
   - **Token / API Key:** cole o token (será ocultado como senha)
4. Clique em **Salvar**

O token aparece na lista com a label do provider e status **Ativo**. O token ativo é marcado com ✓.

> **Para trocar de provider:** clique em **Usar** no token desejado. Apenas um fica ativo por vez.

---

## Passo 3 — Cadastrar Organização e Time

1. Na barra lateral, clique em **👥 Times**
2. Clique em **+ Novo time**
3. Preencha o formulário:

| Campo | O que preencher |
|---|---|
| **Nome do time** | Nome de exibição no app (qualquer nome) |
| **Organização** | Selecione `+ Nova organização` se for a 1ª vez |
| **Nome da org.** | Nome exato da sua org no Azure (ex: `MinhaEmpresa`) |
| **Projeto** | Nome exato do projeto no Azure DevOps |
| **Team Azure** | Nome exato do time no Azure DevOps (case-sensitive) |
| **PAT** | Cole o Personal Access Token |

4. Clique em **Salvar**
5. No card do time recém-criado, clique em **Usar este time**

> ⚠️ **Cuidado com nomes:** `Organização`, `Projeto` e `Team Azure` devem ser exatamente iguais ao que aparece na URL do Azure DevOps: `dev.azure.com/{ORG}/{PROJ}/{TEAM}`

**Para organizations já cadastradas:**
- Ao selecionar a organização existente na lista, o PAT é reutilizado automaticamente
- Não será exibido campo de PAT

---

## Passo 4 — Sincronizar a Sprint

1. No dashboard, clique em **🔄 Sincronizar** (topbar superior direito)
2. Aguarde a sincronização (15-60 segundos dependendo do tamanho do backlog)
3. O dashboard renderizará automaticamente ao concluir

**O que acontece durante a sync:**
1. Busca todas as iterações do time
2. Identifica sprint ativa (startDate ≤ hoje ≤ finishDate)
3. Traz todos os work items via WIQL + batch
4. Busca histórico de revisões para calcular estimativas
5. Traz capacidade do time com days off
6. Calcula KPIs e salva no cache local

> 💡 **Dica:** Sincronize no início da daily para ter os dados mais recentes. Após sincronizar, use **📊 Abrir Dash** para reabrir sem nova sync.

---

## Passo 5 — Explorar o Dashboard (Tab Sprint)

### 5.1 Topbar
Na parte superior você vê:
- Nome do projeto e organização/time
- Nome da sprint com ponto verde animado (sprint ativa)
- Pílula verde com dias úteis restantes (ou vermelha "Encerrada")
- Datas de início e fim em português

**Dropdown de time (lado direito):**
- Clique no nome do time para ver todos os times cadastrados
- Clique em qualquer time para trocá-lo e resincronizar

### 5.2 KPIs
Seis cards no topo. Cards **Bloqueados** e **Em fixing** ficam com fundo vermelho quando >0.

Clique no ícone `ⓘ` em qualquer KPI para ver a metodologia de cálculo.

### 5.3 Backlog
**Filtros:** clique nas abas para filtrar por status. O número ao lado mostra a contagem.

**Ordenar:** clique no cabeçalho de qualquer coluna para ordenar (▲ crescente, ▼ decrescente).

**Expandir um item:** clique na linha para ver as tasks filhas em 2 colunas:
- 📋 **Em andamento:** tasks com status aberto
- ✅ **Concluído:** tasks com status Done

**Timeline do Board:** dentro do expand, clique em "📋 Histórico do Board" para ver quanto tempo o item passou em cada coluna do quadro Kanban.

**Links:** clique em `#XXXX` (ID ou título) para abrir o item diretamente no Azure DevOps.

**Coluna Bloq.:** mostra quantos dias o item ficou bloqueado ao longo da vida do work item (carrega assincronamente).

**Coluna Progresso:** barra colorida mostrando `(estimativa - rem.atual) / estimativa`:
- Verde: ≥80% concluído
- Azul: ≥40% concluído
- Âmbar: <40% concluído
- "Não estimado": sem tasks filhas
- "Itens não estimados": tasks existem mas sem horas lançadas

### 5.4 Painel de Progresso (coluna direita)
- **Barra de itens:** % de PBIs concluídos
- **Barra de capacidade:** remaining/capacidade (verde=saudável, âmbar=baixo, vermelho=sobrecarga)
- **Cap/dia vs Ritmo/dia:** compare os dois para saber se o time consegue entregar no prazo
- **Ver por atividade ▾:** clique para expandir o detalhe por papel (Back End, QA, etc.)
- **Tasks:** total abertas vs finalizadas
- **Day offs:** cards âmbar com datas futuras de folga por membro, em ordem cronológica

---

## Passo 6 — Analisar com IA (Tab Sprint)

### 6.1 Aguardar a Análise
A seção **Insights de IA** inicia automaticamente quando o dashboard carrega. Um spinner indica que o LLM está analisando (10-40 segundos típico, pode chegar a 90s).

### 6.2 Interpretar os Cards
| Cor | Severidade | Significado |
|---|---|---|
| 🚨 Vermelho | critical | Sobrecarga acima de 100%, ação necessária agora |
| ⚠️ Âmbar | warning | Ociosidade, bloqueios, risks, ausências |
| 💡 Azul | info | Oportunidades, observações, tendências |
| ✅ Verde | ok | Conformidade, situações tratadas pelo RAG |

### 6.3 Dar Feedback
- **👍** no card: o insight foi útil e preciso
- **👎** no card: o insight foi incorreto ou irrelevante
- O histórico é salvo em **🎓 Treinamento → Feedback de Insights**

### 6.4 Gerenciar Cards
- **✕ no card individual:** remove apenas aquele insight
- **✕ Limpar insights:** remove todos de uma vez
- **↻ Mais insights:** solicita nova análise ao LLM, adicionando novos cards sem duplicar
  - Se os insights demorarem mais de 90s, use "↻ Mais insights" para tentar novamente

---

## Passo 7 — Usar o Chat IA

O chat é acessível em **qualquer tela** via o botão flutuante **💬** no canto inferior direito.

### 7.1 Fazer uma Pergunta
1. Clique no botão **💬**
2. Digite sua pergunta no campo de texto
3. Pressione **Enter** ou clique no botão **↑** (seta para cima)
4. Aguarde a resposta (até 60s)

**Exemplos de perguntas úteis:**
```
"Como está a sprint no geral?"
"Quem tem mais risco de não entregar?"
"Quantos devs de Back End temos?"
"Qual a saúde do QA esta sprint?"
"Quais itens estão bloqueados há mais tempo?"
"Tem capacidade para puxar mais um item?"
"Qual o ritmo médio de entrega do time?"
"Quais bugs críticos estão abertos?"
```

### 7.2 Histórico de Conversas
- Clique em **📋** no header do chat para abrir o painel lateral de histórico
- Clique em **✏️** para iniciar uma nova conversa
- Clique em qualquer conversa anterior para retomá-la
- Clique em **🗑️** ao lado de uma conversa para excluí-la

---

## Passo 8 — Analisar Eficiência (Multi-sprint)

1. No dashboard, clique na tab **⚡ Eficiência**
2. Selecione o período:
   - Clique em **3 meses**, **6 meses** ou **1 ano** para seleção rápida
   - Ou use o dropdown "Sprints selecionadas" e marque manualmente cada sprint
3. Clique em **⚡ Calcular**
4. Aguarde o carregamento (pode levar 20-60s dependendo do número de sprints e itens)

**O que analisar:**
- **Throughput:** tendência de entregas por sprint (subindo = melhoria de cadência)
- **Lead Time:** tempo total da ideia ao Done (meta: reduzir ao longo do tempo)
- **Cycle Time:** tempo ativo de desenvolvimento (meta: mínimo lead/cycle ratio)
- **Tempo por coluna:** identifica gargalos no fluxo (coluna com mais tempo = bloqueio sistêmico)

---

## Passo 9 — Analisar Qualidade

1. No dashboard, clique na tab **🎯 Qualidade**
2. Clique em **🎯 Carregar**
3. Use os filtros para refinar a análise:
   - **Tipo:** Bug / Defect / Ambos
   - **Estado:** abertos / fechados / todos
4. (Opcional) Clique em **⚡ Analisar com IA** para gerar insights de qualidade

---

## Passo 10 — Treinar a IA (RAG)

O RAG evita que a IA gere alertas incorretos sobre situações que o time já conhece e gerenciou.

### 10.1 Adicionar Contexto
1. Clique em **🎓 Treinamento** na barra lateral
2. Na aba **📚 Contextos**, clique em **+ Novo contexto**
3. Configure:
   - **Escopo:** Geral (todos os times) ou Por time específico
   - **Tipo:** selecione o chip mais adequado
   - **Especificação:** descreva a situação claramente

**Exemplos de contextos eficazes:**

| Situação | Tipo | Texto sugerido |
|---|---|---|
| Membro sobrecarregado justificado | Itens negociados | "PBI #10858 de João Silva está acordado para ser entregue na próxima sprint. A carga alta atual é esperada e não representa risco." |
| Membro com baixa alocação esperada | Capacidade especial | "Maria Costa atuará em refinamentos e discovery nas 2 próximas sprints. Baixa alocação em tasks de desenvolvimento é intencional." |
| Time em onboarding | Contexto de negócio | "Novo membro Bruno Santos em onboarding. Velocidade do time reduzida em ~20% é esperada nesta e na próxima sprint." |
| Dependência externa aguardada | Dependências externas | "PBI #15030 depende de API do time de Plataforma. Prazo confirmado para 15/04. Item pode ser bloqueado até essa data." |
| Acordo de definição de pronto | Definição de pronto | "Bugs High sem reproduce steps não entram na sprint. QA valida obrigatoriamente antes do Done." |

### 10.2 Escopo Geral vs Por Time
- **Geral:** vale sempre, para qualquer time que for analisado
- **Por time:** só aparece quando o time específico estiver ativo

### 10.3 Verificar o Contexto Ativo
Na lista de contextos, os contextos ativos aparecem com badge colorido. Para ver exatamente o que a IA receberá, você pode criar um contexto de teste e usar o chat: "Qual contexto do time você está usando?"

---

## Passo 11 — Compartilhar o Dashboard

### 11.1 Download HTML (recomendado)
1. No dashboard, clique em **⬇ HTML** (topbar superior direito)
2. Aguarde a geração (20-30s — inclui chamada ao LLM para insights)
3. Compartilhe o arquivo `.html` por e-mail, Slack ou qualquer meio

O arquivo funciona 100% offline:
- Todos os dados estão embutidos no HTML
- Filtros e expand de backlog funcionam no browser
- Pronto para imprimir (Ctrl+P)

### 11.2 Imprimir o Dashboard
1. Abra o arquivo HTML no browser
2. Use **Ctrl+P** (Windows/Linux) ou **Cmd+P** (Mac)
3. O browser expande automaticamente todos os itens do backlog antes de imprimir

---

## Passo 12 — Exportar e Importar Configurações

**Exportar:**
1. Acesse **⚙️ Configurações**
2. Clique em **Exportar JSON**
3. Salve o arquivo `agileviewai-config.json`

> O arquivo exportado contém times, organizações e RAG contexts — **sem tokens ou PATs**.

**Importar em outro navegador/máquina:**
1. Na nova máquina, abra o `agileviewai2.3.html`
2. Configure o Vault (PIN ou Sessão)
3. Acesse **⚙️ Configurações → Importar JSON**
4. Selecione o arquivo exportado
5. Configure os tokens LLM e PATs novamente (não são exportados por segurança)

---

## Guia de Solução de Problemas

| Problema | Causa provável | Solução |
|---|---|---|
| "HTTP 404" na sync | Nome de org/projeto/team errado | Verifique na URL do Azure DevOps: `dev.azure.com/{ORG}/{PROJ}/{TEAM}` |
| "HTTP 401" na sync | PAT expirado ou sem permissão | Gere novo PAT com Work Items (Read) e Project and Team (Read) |
| "HTTP 203" ou resposta HTML | CORS bloqueado pela network | Verifique se sua rede corporativa bloqueia request ao `dev.azure.com` |
| Insights ficam carregando | LLM em horário de pico ou token inválido | Aguarde 90s ou verifique o token em **IA & Tokens** |
| Insights incorretos | Falta de contexto RAG | Cadastre o contexto em **Treinamento → Contextos** |
| Dashboard vazio | Sync não realizado | Clique em **🔄 Sincronizar** com um time ativo |
| App pede PIN toda vez | Normal em modo PIN | Ou mude para Sessão em **Configurações → Vault** |
| Dados somem ao fechar | Modo Sessão ativo | Mude para modo PIN em **Configurações → Vault** |
| Eficiência demora muito | Muitas sprints / muitos itens | Limite a seleção para 3-6 sprints na análise |
| Chat não responde | LLM timeout (60s) | Simplifique a pergunta ou tente novamente |

---

## Dicas e Boas Práticas

### Para Agile Masters
- **Sincronize toda manhã** antes da daily — dados mudam conforme tasks são atualizadas
- **Mantenha o RAG atualizado** a cada sprint: itens negociados, membros em exceção, dependências
- **Use "↻ Mais insights"** quando quiser uma perspectiva diferente sobre a mesma sprint
- **Cujo os insights** com 👍/👎 — o histórico de feedback ajuda a calibrar expectativas

### Para Tech Leaders
- **Módulo Eficiência** é ideal para retrospectivas e planejamento de capacidade futura
- **Lead Time vs Cycle Time** revela onde o processo perde tempo (revisão, aprovação, deploy)
- **Tempo por coluna do board** é mais preciso que estimativas subjetivas para identificar gargalos

### Para Gestores e POs
- **Download HTML** para compartilhar o status da sprint com stakeholders sem acesso ao Azure
- **Módulo Qualidade** para acompanhar débito técnico e taxa de fechamento de bugs
- **KPI "Demandas aloc."** é o melhor indicador rápido de risco de não entrega da sprint
