# AgileViewAI — Tutorial de Uso

## Pré-requisitos

Antes de começar, você precisará de:

- **Google Sheets** com o script do AgileViewAI instalado
- **PAT (Personal Access Token)** do Azure DevOps com permissões de leitura em Work Items e Capacity
- **Token de API** de pelo menos um LLM: OpenAI (gpt-4o), Anthropic (Claude) ou Google (Gemini)

Para gerar um PAT no Azure DevOps: acesse `dev.azure.com` → seu perfil → **Personal Access Tokens** → New Token. Marque permissões: `Work Items (Read)`, `Project and Team (Read)`.

---

## Passo 1 — Instalar e Fazer o Setup Inicial

Após abrir a planilha com o script instalado, um menu **AgileViewAI** aparecerá na barra superior.

**1.1** Acesse **AgileViewAI → ⚙️ Setup**

O sistema criará automaticamente todas as abas necessárias:

> `Sprint_Info` · `Raw_Backlog_Data` · `Raw_Task_Data` · `Raw_Capacity_Data` · `Teams` · `Organizations` · `LLM_Config` · `RAG_Context` · `Presentation & Config`

Você verá uma mensagem de confirmação quando o setup estiver completo.

---

## Passo 2 — Configurar o Token de LLM

**2.1** Acesse **AgileViewAI → 🤖 IA & Configurações → Configurar tokens de LLM**

**2.2** Na tela que abrir, selecione o provider desejado:

| Provider | Onde obter o token |
|---|---|
| **OpenAI** | platform.openai.com → API Keys |
| **Claude** | console.anthropic.com → API Keys |
| **Gemini** | aistudio.google.com → Get API Key |

**2.3** Cole o token no campo e clique em **Salvar**

O token é armazenado mascarado (ex: `sk-an...4f2a`) e nunca sai do servidor.

> 💡 **Dica:** Você pode ter tokens de múltiplos providers cadastrados. Apenas o marcado como "Ativo" será usado.

---

## Passo 3 — Cadastrar sua Organização e Time

**3.1** Acesse **AgileViewAI → 👥 Selecionar time**

**3.2** Clique em **Novo time** no painel lateral direito

**3.3** Preencha os campos:

- **Nome do time:** nome de exibição (pode ser qualquer nome)
- **Organização Azure:** nome da sua org (ex: `XerticaBR`)
- **Projeto:** nome exato do projeto no Azure DevOps
- **Team Azure:** nome exato do time no Azure DevOps

**3.4** No campo **Organização**, se for a primeira vez, selecione **+ Nova organização** e insira o PAT. Se a organização já existir cadastrada, o PAT será reutilizado automaticamente.

**3.5** Clique em **Salvar** e depois em **Usar este time**

> ⚠️ Os nomes de Organização, Projeto e Team devem ser exatamente iguais aos do Azure DevOps. Para confirmar, acesse **IA & Configurações → Ver configuração e URL do Azure** e verifique a URL gerada.

---

## Passo 4 — Sincronizar a Sprint

**4.1** Acesse **AgileViewAI → 🔄 Sync**

O sistema irá:
1. Conectar na API do Azure DevOps
2. Identificar a sprint ativa
3. Baixar todos os work items (backlog + tasks)
4. Baixar a capacidade do time com days off
5. Gravar tudo nas abas da planilha
6. **Abrir o dashboard automaticamente**

A sincronização leva tipicamente entre 15 e 45 segundos dependendo do tamanho do backlog.

> 💡 **Dica:** Faça o Sync sempre que quiser ver os dados mais recentes. O dashboard pode ser reaberto a qualquer momento via **📊 Abrir Dash** sem precisar sincronizar novamente.

---

## Passo 5 — Explorando o Dashboard

O dashboard abre como um painel dentro do Google Sheets com todas as informações da sprint.

### 5.1 Topbar

Na parte superior você vê o nome do projeto, organização, nome da sprint com um ponto verde animado indicando que está ativa, a contagem de dias úteis restantes e as datas de início e fim.

### 5.2 KPIs

Seis cards no topo mostram o resumo da sprint. Cards de **Bloqueados** e **Em fixing** ficam com fundo vermelho quando há itens nessas condições — um sinal de atenção imediato.

### 5.3 Backlog da Sprint

A tabela principal mostra todos os PBIs e Defects. Você pode:

- **Filtrar** clicando nas abas: Todos / To Do / Em progresso / Concluído / Bloqueados / Fixing
- **Expandir um item** clicando na linha para ver as tasks filhas divididas em "Em andamento" e "Concluído"
- **Acessar o item no Azure** clicando no ID (`#XXXX`) — abre em nova aba

Linhas vermelhas indicam itens BLOCKED, amarelas indicam FIXING.

### 5.4 Painel de Progresso (coluna direita)

- **Barra de itens concluídos:** progresso dos PBIs
- **Barra de capacidade alocada:** % do remaining work vs capacidade total
- **Cap. disponível/dia vs Ritmo necessário/dia:** compare os dois para saber se o ritmo está sustentável
- **Ver por atividade ▾:** expande o detalhamento por tipo de atuação (Back End, Front End, QA, etc.)
- **Tarefas da sprint:** total de tasks abertas vs finalizadas
- **Day offs:** cards com os dias de folga restantes na sprint

### 5.5 Distribuição por Responsável

Tabela com cada membro do time mostrando:
- Cap. restante (com dia de folga em destaque âmbar se houver)
- Remaining work
- % Alocado com barra colorida (verde = saudável, vermelho = sobrecarga)
- Tasks finalizadas

---

## Passo 6 — Trabalhando com os Insights de IA

### 6.1 Aguardar a análise

Quando o dashboard abre, a seção **Insights de IA** exibe um spinner enquanto o LLM analisa a sprint. Isso leva entre 10 e 40 segundos. O restante do dashboard está disponível normalmente durante esse tempo.

### 6.2 Interpretar os cards

Os cards aparecem organizados por severidade:

| Ícone | Cor | Significado |
|---|---|---|
| 🚨 | Vermelho | **Critical** — sobrecarga acima de 100%, ação necessária |
| ⚠️ | Amarelo | **Warning** — ociosidade, bloqueios, riscos |
| 💡 | Azul | **Info** — oportunidades, observações |
| ✅ | Verde | **Ok** — conformidade, situações tratadas |

### 6.3 Gerenciar os cards

- **✕ no card:** remove apenas aquele insight da visualização
- **✕ Limpar insights:** remove todos os cards de uma vez
- **↻ Mais insights:** solicita uma nova análise ao LLM e adiciona os novos cards sem duplicar os já exibidos (útil para obter perspectivas adicionais)

### 6.4 Fazer uma pergunta livre

1. Clique em **💬 Fazer pergunta**
2. Digite sua pergunta no campo (ex: "Quem tem mais risco de não entregar?")
3. Pressione **Enter** ou clique em **Perguntar**
4. O card de resposta aparece abaixo com dados reais da sprint

**Exemplos de perguntas úteis:**
- `"Como está a sprint no geral?"`
- `"Quantos devs de Back End temos?"`
- `"Qual a saúde do QA?"`
- `"Quais itens estão com risco de atraso?"`
- `"Tem capacidade para puxar mais um item?"`
- `"Qual o ritmo médio de entregas do time?"`

---

## Passo 7 — Treinando a IA com Contexto do Time (RAG)

O RAG permite que você ensine a IA sobre o contexto do time para evitar alertas incorretos.

**7.1** Acesse **AgileViewAI → 🤖 IA & Configurações → Cadastrar RAG / Treinamento**

**7.2** Escolha o escopo:
- **Geral:** vale para todos os times
- **Por time:** vale apenas para o time ativo

**7.3** Selecione o tipo de contexto e escreva a especificação

**Exemplos práticos:**

| Situação | Tipo | Especificação |
|---|---|---|
| Membro com carga alta justificada | Itens negociados | "PBI #10858 de Piovesan está negociado para a próxima sprint, não é risco desta entrega" |
| Membro com baixa alocação esperada | Capacidade especial | "Karen Souza estará focada em refinamentos das próximas 2 sprints, baixa alocação é esperada e alinhada" |
| Time em onboarding | Contexto de negócio | "Time com novo membro em onboarding, velocidade reduzida em ~20% é esperada nesta sprint" |
| Dependência conhecida | Dependências externas | "PBI #15030 depende de API externa que está com prazo confirmado para 25/03" |

**7.4** Clique em **Salvar contexto**

Na próxima análise, a IA lerá esse contexto antes de gerar os insights e evitará alertas desnecessários sobre situações já tratadas.

> 💡 **Verificar o que está sendo enviado:** Acesse **IA & Configurações → Ver contexto RAG enviado ao LLM** para confirmar exatamente o que a IA está recebendo.

---

## Passo 8 — Baixar e Compartilhar o Dashboard

### 8.1 Baixar como HTML

Clique no botão **⬇ Baixar HTML** no canto inferior direito do dashboard.

O sistema gerará um arquivo HTML completo e autossuficiente (~20-30s) com:
- Todos os dados da sprint
- Insights da IA embutidos
- Filtros e expand funcionando offline
- Pronto para imprimir (Ctrl+P)

Compartilhe o arquivo `.html` por e-mail, Slack ou qualquer meio — o destinatário abre no browser sem precisar de conta ou acesso ao Azure.

### 8.2 Baixar como PDF

Clique no botão **📄 Baixar PDF** no canto inferior direito.

O sistema converte o dashboard para PDF via Google Drive (~30-60s) e inicia o download automático. O arquivo também fica salvo no seu Google Drive com nome `AgileViewAI_Dashboard_YYYY-MM-DD_HH-mm.pdf`.

### 8.3 Imprimir

Abra o arquivo HTML baixado no browser e use **Ctrl+P** (Windows/Linux) ou **Cmd+P** (Mac).

O sistema automaticamente:
- Expande todos os itens do backlog
- Exibe as tasks filhas de cada PBI
- Remove elementos desnecessários (botões, barra de scroll)
- Formata com margem adequada para papel A4

---

## Dicas e Boas Práticas

**Manter o RAG atualizado**
Cadastre contextos sempre que houver acordos de sprint, itens negociados com o PO ou situações excepcionais de capacidade. Um RAG bem mantido resulta em insights muito mais precisos.

**Sincronizar no início de cada dia**
Os dados do Azure DevOps mudam conforme o time atualiza tasks. Sincronize no início da sua daily para ter os números mais recentes.

**Usar múltiplos times**
Se você gerencia mais de um time, cadastre todos em **Selecionar time**. Trocar de time é instantâneo e a próxima sync já usa as credenciais do time selecionado.

**Interpretar "Capacidade com folga"**
Se o insight mostra que há folga de capacidade (ex: 30%), isso não significa que o time está ocioso — pode haver work não estimado ou tasks sem horas lançadas. Use como indicador para verificar se o backlog está atualizado no Azure.

**Timeout de carregamento**
Se os insights demorarem mais de 90 segundos, o spinner será substituído por uma mensagem de timeout. Clique em **↻ Mais insights** para tentar novamente — isso costuma acontecer em horários de pico das APIs de LLM.

---

## Solução de Problemas

| Problema | Causa provável | Solução |
|---|---|---|
| Sync retorna erro 404 | Nome do time incorreto | Acesse **Ver configuração e URL do Azure** e compare o nome exato |
| Sync retorna erro 401 | PAT expirado ou inválido | Gere um novo PAT no Azure DevOps e atualize em **Selecionar time** |
| Dashboard não carrega dados | Sync não realizado | Execute o Sync antes de abrir o dash |
| Insights ficam carregando infinitamente | Arquivo .gs desatualizado no Apps Script | Atualize o `dashboard.gs` no editor do Apps Script |
| Insights incorretos sobre sobrecarga | Falta de contexto RAG | Cadastre o contexto em **Cadastrar RAG / Treinamento** |
| HTML baixado sem insights | Código desatualizado | Atualize o `dashboard.gs` — versão nova gera insights no servidor |
| PDF com cores incorretas | Limitação do Drive | Use a versão HTML para impressão fiel; o PDF é mais adequado para texto |
