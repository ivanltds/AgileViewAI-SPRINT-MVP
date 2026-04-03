# AgileViewAI — Cenários BDD Detalhados

> Todos os cenários usam a sintaxe Gherkin. Cobertura completa de todas as funcionalidades.

---

## Feature: Vault — Segurança e Autenticação

```gherkin
Feature: Vault de segurança para proteção de tokens
  Como usuário do AgileViewAI
  Eu quero proteger meus tokens de API com cifragem no browser
  Para que minhas credenciais não fiquem expostas em texto puro

  Background:
    Given o arquivo agileviewai2.3.html está aberto no browser

  # ─── CONFIGURAÇÃO INICIAL ───────────────────────────────────────────

  Scenario: Primeira abertura exibe tela do Vault
    Given o vault nunca foi configurado (sem avai_vault_salt no localStorage)
    When a página carrega
    Then a tela do vault é exibida sobre o app
    And dois tabs são visíveis: "🔒 Vault (PIN)" e "⚡ Sessão"
    And o app principal não está visível

  Scenario: Configurar Vault com PIN pela primeira vez
    Given a tela do vault está aberta e nunca foi configurado
    When o usuário digita "1234" no campo PIN
    And clica em "Entrar"
    Then o sistema gera salt aleatório de 16 bytes no localStorage
    And deriva chave AES-256-GCM via PBKDF2 com 600.000 iterações
    And cifra o desafio "avai_ok" e salva em avai_vault_check
    And o app principal é exibido
    And a tela do vault desaparece

  Scenario PIN muito curto não é aceito
    Given a tela do vault está aberta
    When o usuário digita "12" no campo PIN (menos de 4 dígitos)
    And clica em "Entrar"
    Then o sistema exibe mensagem de erro "PIN deve ter 4 a 8 dígitos"
    And o vault não é configurado

  Scenario: Reabrir app com PIN correto
    Given o vault já foi configurado com PIN "5678"
    When o usuário reabre o app e digita "5678"
    And clica em "Entrar"
    Then o sistema decifra o desafio avai_vault_check com sucesso
    And o app principal é exibido

  Scenario: Reabrir app com PIN incorreto
    Given o vault já foi configurado com PIN "5678"
    When o usuário digita "0000" e clica em "Entrar"
    Then o sistema tenta decifrar o desafio e falha
    And exibe mensagem de erro "PIN incorreto"
    And o app principal permanece oculto

  Scenario: Modo Sessão não persiste tokens
    Given a tela do vault está aberta
    When o usuário clica na tab "⚡ Sessão"
    And clica em "Continuar sem salvar tokens"
    Then o app abre sem configurar vault no localStorage
    And tokens salvos nesta sessão ficam apenas em APP.sessionTokens
    And ao fechar e reabrir o browser, os tokens não existem mais

  Scenario: Trocar PIN preserva dados existentes
    Given o vault está configurado com PIN "1234" e 2 tokens LLM cifrados
    When o usuário acessa Configurações → Alterar PIN
    And informa PIN atual "1234", novo PIN "9999" e confirmação "9999"
    Then o sistema discifra todos os tokens com a chave antiga
    And recifragem todos com a chave derivada do novo PIN "9999"
    And o avai_vault_check é atualizado com o novo PIN
    And os tokens continuam acessíveis com PIN "9999"

  Scenario: Limpar vault remove apenas tokens
    Given vault configurado com 3 tokens LLM e 2 times cadastrados
    When o usuário acessa Configurações → Limpar vault
    And confirma a ação
    Then avai_vault_salt e avai_vault_check são removidos do localStorage
    And os tokens cifrados são removidos
    And na próxima abertura o app pede novo PIN

  Scenario: Apagar tudo remove todos os dados
    Given o app tem times, tokens, RAG e cache de sprint
    When o usuário acessa Configurações → Apagar tudo e confirma
    Then localStorage.clear() é executado
    And o browser recarrega para a tela inicial do vault
```

---

## Feature: Gerenciamento de Times e Organizações

```gherkin
Feature: Gerenciamento de times Azure DevOps
  Como Agile Master
  Eu quero cadastrar múltiplos times de múltiplas organizações
  Para poder alternar rapidamente entre contextos de trabalho

  Scenario: Cadastrar nova organização e time simultaneamente
    Given nenhuma organização está cadastrada
    When o usuário acessa Times e clica em "+ Novo time"
    And seleciona "+ Nova organização" na lista de orgs
    And preenche: org="MinhaEmpresa", projeto="MeuProjeto", team="Time Backend", nome="Backend Dev"
    And cola um PAT válido
    And clica em "Salvar"
    Then uma entrada é criada em avai_orgs com nome="MinhaEmpresa" e patEnc cifrado
    And uma entrada é criada em avai_teams com orgId vinculado
    And o time aparece na lista com badge "Inativo"

  Scenario: Organização existente reutiliza PAT automaticamente
    Given a organização "MinhaEmpresa" está cadastrada com PAT
    When o usuário cria novo time selecionando "MinhaEmpresa" na lista
    Then o campo de PAT não é exibido
    And o time é salvo com orgId=id da organização existente
    And o PAT da organização será usado nas chamadas API

  Scenario: Ativar time define credenciais globais
    Given 3 times cadastrados nenhum ativo
    When o usuário clica em "Usar este time" no time "Backend Dev"
    Then avai_active_team recebe o ID do time "Backend Dev"
    And o dropdown do topbar do dashboard mostra "Backend Dev"
    And a próxima sync usará as credenciais de "Backend Dev"

  Scenario: Apenas um time fica ativo por vez
    Given o time "Frontend Dev" está ativo
    When o usuário ativa "QA Team"
    Then avai_active_team muda para o ID de "QA Team"
    And "Frontend Dev" não está mais ativo
    And ambos os times continuam cadastrados

  Scenario: Trocar time no dropdown do dashboard
    Given 2 times cadastrados com caches de sprint diferentes
    When o usuário clica no dropdown de time no topbar
    And seleciona o outro time
    Then o app carrega o cache de sprint desse time (se existir)
    And o dashboard renderiza com os dados do novo time ativo

  Scenario: Editar PAT de organização
    Given a organização "MinhaEmpresa" tem PAT expirado
    When o usuário edita a organização e insere novo PAT
    Then o novo PAT é cifrado e salvo em avai_orgs[].patEnc
    And a próxima sync usa o novo PAT
```

---

## Feature: Sincronização com Azure DevOps

```gherkin
Feature: Sincronização de dados da sprint
  Como Agile Master
  Eu quero buscar os dados atualizados do Azure DevOps
  Para ter informações precisas ao analisar a sprint

  Scenario: Sincronização bem-sucedida com sprint ativa
    Given o time "Backend" tem PAT válido
    And existe uma sprint com startDate <= hoje <= finishDate
    When o usuário clica em "🔄 Sincronizar"
    Then o sistema busca iterações via GET /teamsettings/iterations
    And identifica a sprint ativa pela data
    And busca IDs via WIQL query (PBI, Defect, Bug, Task; exceto Removed)
    And busca detalhes em lotes de 200 IDs
    And busca histórico de revisões para calcular estimativas
    And busca capacidade com daysOff
    And salva os dados em avai_sprint_cache
    And renderiza o dashboard sprint
    And exibe toast de sucesso

  Scenario: PAT expirado retorna erro 401
    Given o PAT configurado está expirado
    When o usuário clica em "Sincronizar"
    Then o sistema recebe HTTP 401 da API do Azure
    And exibe toast de erro com "HTTP 401: ..."
    And o cache anterior não é sobrescrito

  Scenario: Nome de team incorreto retorna erro 404
    Given o team Azure "Time Backend" está configurado mas o nome correto é "Backend Team"
    When o usuário sincroniza
    Then a API retorna HTTP 404
    And o toast exibe "HTTP 404: ..."
    And nenhuma aba de dados é atualizada

  Scenario: Team name com espaços é codificado corretamente na URL
    Given o team name é "Time de Backend" (3 palavras com espaços)
    When o sistema monta a URL da API
    Then a URL contém "Time%20de%20Backend" (cada palavra codificada separadamente por %20)
    And não usa encodeURIComponent(team) que codificaria "/" indevidamente

  Scenario: Sprint ativa identificada corretamente
    Given existem 5 sprints: passadas, ativa atual, futuras
    And a sprint "Sprint 42" tem startDate = 2025-03-24 e finishDate = 2025-04-04
    And hoje é 2025-04-02
    When o sistema processa as iterações
    Then "Sprint 42" é identificada como ativa
    And as demais sprints são ignoradas para o dashboard

  Scenario: Fallback para sprint mais recente quando sem ativa
    Given hoje é 2025-04-10 (após finishDate + 1 dia buffer)
    And a sprint mais recente terminou em 2025-04-04
    When o sistema busca a sprint ativa
    Then usa como fallback a sprint com o maior finishDate no passado
    And o dashboard exibe pílula "Encerrada" em vermelho

  Scenario: Dias úteis calculados em UTC eliminando efeito de fuso
    Given a sprint termina em 2025-04-11 (sexta-feira)
    And hoje é segunda-feira 2025-04-07 em qualquer fuso horário
    When o sistema calcula bizDaysLeft
    Then usa Date.UTC() para comparar datas
    And o resultado é 5 dias úteis (seg, ter, qua, qui, sex)
    And hoje é incluído na contagem

  Scenario: Estimativa calculada via maior RemainingWork das revisões
    Given a task #9999 teve RemainingWork: 8h → 6h → 4h → 2h → 0h nas revisões
    When o sistema calcula a estimativa da task
    Then max(8, 6, 4, 2, 0) = 8h é a estimativa original
    And childRem = 0h (task concluída)

  Scenario: Days off subtraídos corretamente na capacidade
    Given Lucas tem 8h/dia e day off em 2025-04-08 (terça-feira)
    And a sprint tem 10 dias úteis restantes (incluindo hoje segunda)
    When o sistema calcula capRest de Lucas
    Then capRest = 8h × max(10 - 1, 0) = 72h
    And futureOff = ['08/04'] aparece no day off card

  Scenario: Items sem tasks filhas marcados como "Não estimado"
    Given o PBI #5000 não tem tasks filhas
    When o sistema renderiza a coluna Progresso
    Then exibe badge "Não estimado" em vermelho

  Scenario: Items com tasks mas sem estimativas marcados como "Itens não estimados"
    Given o PBI #5001 tem 3 tasks filhas com RemainingWork = 0 em TODAS as revisões
    When o sistema renderiza a coluna Progresso
    Then exibe badge "Itens não estimados" em âmbar

  Scenario: Status de bloqueio detectado por campo customizado
    Given o work item #7777 tem Custom.Block = true
    When o sistema processa o blockStatus
    Then retorna 'BLOCKED'
    And a linha no backlog tem fundo vermelho

  Scenario: Status de bloqueio detectado por tag
    Given o work item #7778 tem System.Tags = "bloqueado; backend"
    When o sistema processa o blockStatus
    Then retorna 'BLOCKED'

  Scenario: Status FIXING detectado por tag
    Given o work item #7779 tem System.Tags = "fixing; urgent"
    When o sistema processa o blockStatus
    Then retorna 'FIXING'
    And a linha no backlog tem fundo âmbar
```

---

## Feature: Dashboard Sprint

```gherkin
Feature: Visualização do dashboard de sprint
  Como Agile Master
  Eu quero ver o status completo da sprint em um dashboard
  Para tomar decisões baseadas em dados reais

  Scenario: KPIs exibem valores corretos
    Given a sprint tem: 22 PBIs, 5 Done, 4 In Progress (sem bloqueio), 2 BLOCKED, 1 FIXING
    And remaining total = 200h e capRest total = 300h
    When o dashboard é renderizado
    Then os KPIs exibem:
      | KPI | Valor |
      | Total | 22 |
      | Concluídos | 5 (22%) |
      | Em progresso | 4 |
      | Bloqueados | 2 |
      | Em fixing | 1 |
      | Demandas aloc. | 66% (200h/300h) |

  Scenario: Card Bloqueados tem fundo vermelho quando >0
    Given há 2 itens com blockStatus=BLOCKED
    When o dashboard renderiza os KPIs
    Then o card "Bloqueados" tem classe "kpi-card alert"
    And o valor "2" é exibido em vermelho

  Scenario: Tooltip do KPI exibe metodologia de cálculo
    Given o dashboard está carregado
    When o usuário hover no ícone "ⓘ" do KPI "Demandas aloc."
    Then exibe a caixa de tooltip com texto explicando:
      "Remaining Work atual das tasks abertas ÷ Capacidade restante da equipe na sprint"

  Scenario: Filtro "Bloqueados" exibe apenas itens BLOCKED
    Given o backlog tem 22 itens: 2 BLOCKED, 1 FIXING, 19 outros
    When o usuário clica no filtro "Bloqueados"
    Then apenas os 2 itens BLOCKED são exibidos
    And o counter mostra "(2)"

  Scenario: Ordenar tabela por Status
    Given o backlog tem itens em estados: Done, In Progress, To Do
    When o usuário clica no cabeçalho "Status"
    Then a tabela ordena crescentemente por estado
    When clica novamente
    Then ordena decrescentemente
    When clica novamente
    Then volta à ordem original

  Scenario: Expandir item exibe tasks filhas em duas colunas
    Given o PBI #10858 tem 4 tasks: 2 abertas (Doing) e 2 fechadas (Done)
    When o usuário clica na linha do PBI #10858
    Then a linha de filho aparece com:
      | Coluna | Conteúdo |
      | Em andamento (2) | 2 task cards azuis |
      | Concluído (2) | 2 task cards verdes com opacidade .7 |
    And cada card mostra: badge, ID linkado, título linkado, status, horas restantes, responsável

  Scenario: Link do ID abre o item no Azure DevOps
    Given o PBI #10858 na organização "MinhaEmpresa" projeto "MeuProjeto"
    When o usuário clica no link "#10858"
    Then o browser abre nova aba em:
      "https://dev.azure.com/MinhaEmpresa/MeuProjeto/_workitems/edit/10858"

  Scenario: Barra de progresso por item mostra percentual correto
    Given PBI #5001: estimativa=10h, childRem=3h
    When o dashboard renderiza a coluna Progresso
    Then exibe barra com 70% preenchida em azul (70 >= 40 e < 80)
    And texto "70% · 3h rem"

  Scenario: Painel de progresso exibe ritmo vs capacidade
    Given bizDays=5, totalRem=100h, capRest=150h
    When o painel de progresso é renderizado
    Then exibe:
      "Cap/dia: 30,0h/dia" (150/5)
      "Ritmo: 20,0h/dia" (100/5)

  Scenario: Day offs futuros aparecem ordenados por data
    Given João tem day off em 08/04 e Maria em 07/04
    And hoje é 06/04
    When o painel de progresso renderiza day offs
    Then o card de Maria (07/04) aparece antes do card de João (08/04)

  Scenario: Membro sobrecarregado tem barra vermelha na tabela de membros
    Given Piovesan tem: capRest=48h, remaining=56h (117% alocação)
    When a seção de membros é renderizada
    Then a barra de Piovesan é vermelha (color #dc2626)
    And o texto "117%" é exibido em vermelho

  Scenario: Membros ordenados por remaining work decrescente
    Given 3 membros: João (30h rem), Maria (45h rem), Pedro (10h rem)
    When a tabela de membros renderiza
    Then a ordem é: Maria (45h), João (30h), Pedro (10h)

  Scenario: Tempo de bloqueio aparece na coluna "Bloq."
    Given o PBI #7777 ficou em estado blocked por 3 dias (detectado via revisões)
    When o _preloadBlockTimes termina de processar
    Then a célula "Bloq." do item #7777 exibe "3d"
    And itens sem histórico de bloqueio exibem "—"
```

---

## Feature: Insights de IA

```gherkin
Feature: Geração e validação de insights pelo LLM
  Como Agile Master
  Eu quero insights automáticos e validados sobre a saúde da sprint
  Para identificar riscos e oportunidades sem analisar os dados manualmente

  Scenario: Insights carregam assincronamente sem bloquear o dashboard
    Given o dashboard está renderizado com dados
    When a seção de insights começa a carregar
    Then um spinner é exibido com texto "Consultando [provider]..."
    And o backlog, KPIs e progresso continuam acessíveis e interativos
    After o LLM responde (entre 10 e 90 segundos)
    Then o spinner é substituído pelos cards de insight

  Scenario: Sobrecarga consolidada em 1 único card critical
    Given Piovesan (117%), Aimê (104%) e Anísio (104%) estão acima de 100%
    When os insights são gerados e processados pelo validador
    Then existe exatamente 1 card com severity="critical"
    And o card menciona Piovesan, Aimê e Anísio no body
    And os três são agrupados por papel no mesmo body

  Scenario: Folga de capacidade invalida card de risco de entrega (R0)
    Given totalRem=270h e capTotal=384h (30% de folga)
    And o LLM retorna card critical: "Alta probabilidade de não entrega"
    When o validador R0 processa
    Then o card é convertido para severity="info"
    And título muda para "Capacidade com folga"
    And o body descreve a folga percentual
    And R0 só dispara 1x mesmo se houver múltiplos cards similares

  Scenario: Regra R3 respeita contexto RAG para situação tratada
    Given RAG contém: "Piovesan está alocado no PBI negociado para próxima sprint"
    And Piovesan tem alloc=95% (<= 100%)
    And o LLM gera card warning sobre Piovesan
    When o validador R3 processa
    Then o card é rebaixado para severity="ok"
    And menciona que a situação está tratada no contexto do time

  Scenario: Regra R3 NÃO rebaixa sobrecarga real
    Given RAG contém: "Piovesan acordado para próxima sprint"
    And Piovesan tem alloc=117% (> 100%)
    And o LLM gera card critical sobre Piovesan
    When o validador R3 tenta rebaixar
    Then o card crítico é MANTIDO como severity="critical"
    And a sobrecarga real não pode ser ignorada pelo RAG

  Scenario: Regra R8 injeta card para membro ocioso não coberto
    Given Lucas tem alloc=10% (<70%)
    And nenhum card de insight cita "Lucas"
    When o validador R8 executa pós-processamento
    Then é injetado um card severity="warning"
    And título contém o papel de Lucas (ex: "⚠️ Baixa utilização em Frontend")
    And cita Lucas com rem, cap e percentual reais

  Scenario: Regra R7 consolida múltiplos criticals
    Given o LLM retorna 3 cards critical (um por papel)
    When o validador R7 executa
    Then existe exatamente 1 card critical no resultado
    And o body é a concatenação dos 3 bodies separados por " | "

  Scenario: Deduplicação previne cards repetidos ao clicar "Mais insights"
    Given o grid exibe 4 cards com títulos: "A", "B", "C", "D"
    When o usuário clica em "↻ Mais insights"
    And o LLM retorna cards com títulos: "B", "C", "E", "F"
    Then apenas "E" e "F" são adicionados ao grid
    And "B" e "C" (duplicatas, case-insensitive) são ignorados
    And o botão exibe "(+2)"

  Scenario: Feedback 👍 em card é persistido
    Given o card "🚨 Alertas de Sobrecarga" está exibido
    When o usuário clica em 👍
    Then o card recebe classe "voted-good" (fundo verde)
    And avai_insight_fb recebe: {title:"Alertas de Sobrecarga", vote:"good", timestamp}
    And após fechar e reabrir o app, o feedback está em "Treinamento → Feedback"

  Scenario: Timeout de 90s exibe mensagem e reabilita botões
    Given o LLM não responde dentro de 90 segundos
    When o timeout do client-side dispara
    Then o spinner é substituído por "⏱ Tempo esgotado. Clique em ↻ para tentar novamente"
    And o botão "↻ Mais insights" está habilitado
    And o botão "✕ Limpar insights" está habilitado

  Scenario: Remover card individual não afeta outros cards
    Given 5 cards de insight estão exibidos
    When o usuário clica em "✕" no 3º card
    Then apenas o 3º card é removido do DOM
    And os outros 4 cards permanecem inalterados
```

---

## Feature: Chat IA Flutuante

```gherkin
Feature: Chat de perguntas livres com IA
  Como Agile Master
  Eu quero fazer perguntas livres sobre a sprint
  Para obter respostas rápidas e contextualizadas

  Scenario: Abrir e fechar o painel de chat
    Given o app está em qualquer tela
    When o usuário clica no botão FAB "💬" (fixo no canto inferior direito)
    Then o painel de chat abre com animação (fcIn: translate + scale + fade)
    When o usuário clica em "✕"
    Then o painel fecha

  Scenario: Enviar pergunta com Enter
    Given o painel de chat está aberto
    When o usuário digita "Como está a sprint?" e pressiona Enter
    Then a mensagem aparece como bubble do usuário (alinhada à direita)
    And o sistema monta o prompt e chama o LLM

  Scenario: Resposta renderiza Markdown corretamente
    Given o LLM retorna body com: "**Crítico**: A sprint está com..."
    When a resposta é exibida
    Then "Crítico" aparece em negrito
    And o restante em texto normal

  Scenario: LLM responde com dados reais do time
    Given o time tem 9 membros (1 QA, 4 Backend, 4 Frontend)
    When o usuário pergunta "Quantos QA tem no time?"
    Then a resposta menciona "1 membro em Quality Analyst"
    And cita o nome correto do membro QA
    And não inventa membros inexistentes

  Scenario: Histórico de conversas persiste entre sessões (modo PIN)
    Given modo PIN ativo e 3 conversas existentes
    When o usuário fecha o browser e reabre
    And informa o PIN correto
    Then as 3 conversas ainda aparecem no histórico do chat

  Scenario: Criar nova conversa limpa o chat
    Given uma conversa em andamento com 5 mensagens
    When o usuário clica em "✏️" (nova conversa)
    Then o painel de mensagens é limpo
    And um novo ID de conversa é gerado
    And a conversa anterior ainda está no histórico lateral

  Scenario: Retomar conversa anterior via histórico
    Given 3 conversas salvas no histórico lateral
    And a conversa "Como está a sprint?" tem 3 pares de mensagens
    When o usuário abre o histórico e clica na conversa
    Then as 3 pares de mensagens são carregadas no chat

  Scenario: Excluir conversa do histórico
    Given 3 conversas no histórico lateral
    When o usuário hover em uma conversa e clica no ícone "🗑️"
    Then a conversa é removida da lista
    And do avai_chat_convs no localStorage

  Scenario: Double-submit é bloqueado
    Given uma pergunta está sendo processada pelo LLM
    When o usuário tenta clicar em "↑" novamente
    Then o botão está desabilitado (disabled = true)
    And a pergunta duplicada não é enviada

  Scenario: Timeout de 60s reabilita o campo
    Given o LLM não responde em 60 segundos
    When o timeout dispara
    Then a textarea e o botão enviar são reabilitados
    And "⏱ Tempo esgotado" é exibido no lugar do spinner de resposta
```

---

## Feature: Módulo Eficiência (Multi-sprint)

```gherkin
Feature: Análise histórica de eficiência
  Como Agile Master
  Eu quero analisar métricas históricas de múltiplas sprints
  Para identificar tendências e tomar decisões de melhoria de processo

  Scenario: Seleção rápida de 3 meses
    Given o time tem sprints dos últimos 6 meses
    When o usuário clica em "3 meses"
    Then as sprints com startDate >= (hoje - 90 dias) são selecionadas
    And o dropdown mostra "Sprints selecionadas" com o count

  Scenario: Cálculo de métricas de eficiência
    Given 3 sprints selecionadas com: 10, 12, 8 itens Done respectivamente
    And lead times por item disponíveis
    When o usuário clica em "⚡ Calcular"
    Then:
      | Métrica | Valor |
      | Throughput médio | 10,0 itens/sprint ((10+12+8)/3) |
      | Lead Time médio | calculado sobre todos os itens Done com datas |
      | Cycle Time médio | calculado sobre itens com ActivatedDate |

  Scenario: Filtrar backlog histórico por status
    Given o backlog das sprints selecionadas tem 30 itens
    When o usuário filtra por status "In Progress"
    Then apenas os itens com esse estado são exibidos
    And o filtro combina com outros filtros ativos (título, executor)

  Scenario: Tempo por coluna identifica gargalo
    Given de 20 itens Done, todos passaram pela coluna "In Review" com média de 5 dias
    And pela coluna "In Progress" com média de 2 dias
    When o módulo de eficiência renderiza os dados
    Then o gráfico de tempo por coluna mostra "In Review" como maior coluna (5 dias)
    And isso indica gargalo no processo de revisão

  Scenario: Eficiência exclui outliers de coluna
    Given um item ficou em "In Progress" por 200 dias (outlier)
    When o processador calcula colTimes
    Then o delta de 200 dias é excluído (filtro: delta < 180)
    And a média de "In Progress" não é distorcida pelo outlier
```

---

## Feature: Módulo Qualidade

```gherkin
Feature: Análise de bugs e qualidade do produto
  Como Gestor e PO
  Eu quero visualizar métricas de qualidade do produto
  Para tomar decisões sobre investimento em qualidade e técnica

  Scenario: Carregar todos os bugs do projeto
    Given o projeto "MeuProjeto" tem 150 bugs e defects (incluindo Removed)
    When o usuário clica em "🎯 Carregar"
    Then a query WIQL filtra: WorkItemType IN ('Bug','Defect') AND State <> 'Removed'
    And os itens carregados não incluem bugs removidos

  Scenario: Filtrar por tipo e estado
    Given 80 Bugs e 30 Defects, sendo 60 abertos e 50 fechados
    When o usuário define: Tipo=Bug, Estado=aberto
    Then apenas os Bugs com state NOT IN (Done/Closed/Resolved) são exibidos

  Scenario: Análise de qualidade com IA usa dados dos bugs
    Given 15 bugs abertos: 3 Critical, 5 High, 7 Medium
    When o usuário clica em "⚡ Analisar com IA"
    Then o sistema envia os dados de bugs ao LLM
    And a resposta cita os bugs críticos e o envelhecimento dos bugs High
```

---

## Feature: RAG e Treinamento

```gherkin
Feature: Contextualização e treinamento do assistente IA
  Como Agile Master
  Eu quero ensinar contextos específicos do time ao assistente
  Para evitar alertas incorretos e melhorar a qualidade dos insights

  Scenario: RAG de escopo geral é aplicado a todos os times
    Given existe RAG de escopo "geral": "Velocidade histórica do time é 10 itens/sprint"
    And o time ativo é "Backend Dev"
    When os insights são gerados
    Then o contexto geral está no user prompt enviado ao LLM
    And quando o time ativo muda para "Frontend Dev", o contexto geral ainda é incluído

  Scenario: RAG de escopo por time é isolado ao time específico
    Given RAG de escopo "team" vinculado ao time "Backend Dev" com ID "team-123"
    And o time ativo é "Frontend Dev" com ID "team-456"
    When os insights são gerados para "Frontend Dev"
    Then o RAG do "Backend Dev" NÃO está no prompt
    And apenas o RAG geral (se houver) e o RAG de "Frontend Dev" (se houver) são incluídos

  Scenario: RAG concatena múltiplos contextos
    Given 3 contextos ativos para o time ativo:
      - tipo="acordos de time", spec="Bloco A"
      - tipo="riscos conhecidos", spec="Bloco B"
    And 2 contextos gerais:
      - tipo="velocidade histórica", spec="Bloco C"
    When Store.getActiveRag() é chamado
    Then retorna:
      "## acordos de time\nBloco A\n\n## riscos conhecidos\nBloco B\n\n## velocidade histórica\nBloco C"

  Scenario: Desativar contexto exclui do prompt
    Given contexto RAG ativo "Itens negociados: PBI #X"
    When o usuário desativa o contexto (active = false)
    Then o contexto não aparece no próximo getActiveRag()
    And os insights não consideram mais aquele contexto

  Scenario: Customizar prompt do Agente A1
    Given o usuário edita o prompt de A1 substituindo o texto padrão
    When o usuário salva em "Agentes de IA"
    Then avai_agent_prompts['a1'] é atualizado
    And a próxima geração de insights usa o prompt customizado

  Scenario: Restaurar prompt padrão do agente
    Given o prompt de A2 foi customizado
    When o usuário clica em "Restaurar padrão" para A2
    Then avai_agent_prompts['a2'] é apagado ou substituído pelo AGENT_DEFAULTS.a2
    And a próxima geração usa o prompt padrão novamente
```

---

## Feature: Export e Compartilhamento

```gherkin
Feature: Export e compartilhamento do dashboard
  Como Agile Master e Gestor
  Eu quero compartilhar o status da sprint com stakeholders
  Sem depender de acesso ao Azure DevOps ou ao app

  Scenario: Download HTML standalone contém insights embutidos
    Given a sprint tem dados sincronizados e LLM configurado
    When o usuário clica em "⬇ HTML"
    Then o sistema gera insights via chamada ao LLM
    And o arquivo HTML contém os cards de insights embutidos
    And não há spinner de carregamento
    And não há botões de "Mais insights", "Fazer pergunta" ou "Download"

  Scenario: Download HTML funciona offline
    Given o arquivo dashboard-sprint-42.html foi baixado
    When o usuário abre o arquivo sem conexão à internet
    Then o dashboard renderiza completamente
    And os filtros de backlog funcionam (tab Todos / Bloqueados / etc.)
    And o expand das tarefas filhas funciona
    And os links #ID estão presentes mas requerem internet para abrir

  Scenario: Impressão expande todos os itens automaticamente
    Given o arquivo HTML está aberto no browser
    When o usuário inicia impressão (Ctrl+P)
    Then o evento beforeprint dispara
    And todos os children-row ficam visíveis (display:block)
    And o CSS @media print remove botões e barras de scroll
    And margens de 15mm são aplicadas

  Scenario: Exportar configurações não inclui tokens
    Given o app tem 2 times, 3 contextos RAG e 2 tokens LLM cifrados
    When o usuário clica em "Exportar JSON"
    Then o arquivo JSON contém apenas times, orgs e RAG contexts
    And NÃO contém nenhum token LLM ou PAT (mesmo cifrado)
    And é seguro para compartilhar entre colegas

  Scenario: Importar configurações faz merge sem duplicatas
    Given o app já tem o time "Backend Dev"
    And o arquivo JSON importado também tem "Backend Dev" (mesmo nome)
    When a importação ocorre
    Then "Backend Dev" não é duplicado
    And times novos presentes no JSON são adicionados
```

---

## Feature: Responsividade e Acessibilidade

```gherkin
Feature: Interface responsiva para diferentes dispositivos
  Como usuário mobile ou tablet
  Eu quero usar o AgileViewAI
  Sem perda de funcionalidade em telas menores

  Scenario: Sidebar substituída por bottom nav em mobile
    Given o viewport é 375px de largura (iPhone SE)
    When a página carrega
    Then #sidebar está oculto (display:none via CSS)
    And #mobile-bottom-nav está visível com 5 botões: Dashboard, Times, IA, Treino, Config

  Scenario: Modal vira bottom sheet em mobile
    Given o viewport é 375px
    When o usuário abre o modal de "Novo time"
    Then o modal tem border-radius 16px 16px 0 0 (apenas no topo)
    And ocupa 100% da largura e max-height:92vh

  Scenario: KPIs mostram 2 colunas em mobile
    Given o viewport é 375px
    When o dashboard renderiza os KPIs
    Then a grade de KPIs usa 2 colunas (grid-template-columns: repeat(2,1fr))

  Scenario: Sidebar fica com ícones no tablet
    Given o viewport é 768px de largura (tablet)
    When a página carrega
    Then #sidebar está visível mas com width:60px
    And apenas os ícones estão visíveis (labels ocultas)
    When o usuário hover sobre um item
    Then o tooltip com o label aparece ao lado direito do ícone

  Scenario: Chat FAB sobe para não sobrepor bottom nav
    Given o viewport é 375px (mobile) com bottom nav visível
    When o chat FAB é exibido
    Then seu bottom é calc(56px + 12px) = 68px
    And o painel do chat tem bottom: calc(56px + 62px)
    And o FAB não cobre os botões da bottom nav

  Scenario: Safe-area-inset respeitada em iPhone com notch
    Given o usuário abre o app em iPhone 14 Pro (com Dynamic Island)
    When a página renderiza
    Then a bottom nav tem padding-bottom: env(safe-area-inset-bottom)
    And os botões da nav não ficam atrás da área de sistema
```
