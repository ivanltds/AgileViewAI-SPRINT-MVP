# AgileViewAI — Cenários de Teste em BDD

## Módulo: Setup e Configuração

```gherkin
Feature: Configuração inicial do add-on

  Scenario: Setup cria todas as abas necessárias
    Given a planilha está aberta sem nenhuma aba do AgileViewAI
    When o usuário acessa AgileViewAI → Setup
    Then as abas são criadas: "Presentation & Config", "Sprint_Info",
         "Raw_Backlog_Data", "Raw_Task_Data", "Raw_Capacity_Data",
         "Teams", "Organizations", "LLM_Config", "RAG_Context"

  Scenario: Setup não duplica abas existentes
    Given as abas do AgileViewAI já existem na planilha
    When o usuário acessa AgileViewAI → Setup
    Then as abas existentes são mantidas sem duplicação
    And o sistema exibe mensagem "Setup já realizado"

  Scenario: Cadastro de token LLM com provider Claude
    Given o usuário está na tela de configuração de LLM
    When o usuário seleciona "claude" e insere um token válido
    Then o token é salvo na aba LLM_Config mascarado (ex: "sk-an...xxxx")
    And o status é marcado como "Ativo: SIM"

  Scenario: Token LLM inválido não é aceito
    Given o usuário está na tela de configuração de LLM
    When o usuário insere um token vazio
    Then o sistema exibe validação "Token não pode estar vazio"
    And nenhum registro é salvo
```

---

## Módulo: Gerenciamento de Times

```gherkin
Feature: Gerenciamento de times e organizações

  Scenario: Cadastro de novo time com nova organização
    Given o painel de times está aberto
    And a organização "XerticaBR" não existe cadastrada
    When o usuário preenche nome do time, seleciona "+ Nova organização"
    And insere o PAT da organização
    And clica em Salvar
    Then o time é salvo na aba Teams
    And a organização é salva na aba Organizations com o PAT
    And o time aparece na lista como "Inativo"

  Scenario: Cadastro de time com organização existente reutiliza PAT
    Given a organização "XerticaBR" já está cadastrada com um PAT
    When o usuário cadastra novo time selecionando "XerticaBR"
    Then o PAT da organização é reutilizado automaticamente
    And nenhum campo de PAT adicional é exibido

  Scenario: Ativação de time configura as credenciais
    Given o time "Time de Backend" está cadastrado mas inativo
    When o usuário clica em "Usar este time"
    Then org, projeto, team e PAT são copiados para "Presentation & Config"
    And o time aparece como "Ativo: SIM" na aba Teams
    And os outros times passam para "Ativo: NÃO"

  Scenario: Apenas um time pode estar ativo por vez
    Given o time "Time A" está ativo
    When o usuário ativa o "Time B"
    Then "Time B" fica ativo
    And "Time A" fica inativo automaticamente
```

---

## Módulo: Sincronização com Azure DevOps

```gherkin
Feature: Sincronização de dados do Azure DevOps

  Scenario: Sincronização bem-sucedida com sprint ativa
    Given o time ativo tem PAT válido e organização acessível
    And existe uma sprint ativa no Azure DevOps
    When o usuário acessa AgileViewAI → Sync
    Then os dados são gravados em Sprint_Info, Raw_Backlog_Data,
         Raw_Task_Data e Raw_Capacity_Data
    And o campo "Última Sync" em Presentation & Config é atualizado
    And o dashboard abre automaticamente

  Scenario: Sincronização falha com PAT inválido
    Given o PAT configurado está expirado ou inválido
    When o usuário acessa AgileViewAI → Sync
    Then o sistema exibe mensagem de erro com o código HTTP retornado
    And nenhuma aba é sobrescrita com dados incorretos

  Scenario: Nome do time com espaços é codificado corretamente
    Given o team name é "Time de Backend" (com espaços)
    When o sistema monta a URL da API do Azure DevOps
    Then a URL contém "Time%20de%20Backend" (cada palavra encodada separadamente)
    And a requisição retorna HTTP 200

  Scenario: Dias úteis calculados corretamente incluindo hoje
    Given hoje é quarta-feira e a sprint termina na próxima sexta
    When o sistema calcula os dias úteis restantes
    Then o resultado inclui hoje na contagem
    And feriados e finais de semana são excluídos

  Scenario: Day off em data futura é contabilizado corretamente
    Given um membro tem day off registrado amanhã
    When o sistema calcula a capacidade restante do membro
    Then a capacidade é reduzida por 1 dia
    And o day off aparece na coluna cap. restante do dashboard

  Scenario: Identificação correta da sprint ativa
    Given existem 5 sprints no Azure DevOps
    And apenas a sprint "Sprint 28" tem startDate ≤ hoje ≤ finishDate
    When o sistema busca as iterações
    Then apenas "Sprint 28" recebe status "SIM" na aba Sprint_Info
    And as demais recebem "NÃO"
```

---

## Módulo: Dashboard

```gherkin
Feature: Visualização do dashboard

  Scenario: Dashboard exibe KPIs corretos
    Given a sprint tem 22 PBIs, 0 concluídos, 4 em progresso, 0 bloqueados
    When o dashboard é aberto
    Then os KPIs exibem: Total=22, Concluídos=0, Em progresso=4,
         Bloqueados=0, Em fixing=0

  Scenario: KPI de bloqueados tem fundo vermelho quando > 0
    Given existem 2 itens bloqueados na sprint
    When o dashboard é aberto
    Then o card "Bloqueados" exibe fundo vermelho
    And o valor "2" é exibido em vermelho

  Scenario: Expand de linha exibe tasks filhas
    Given o PBI #10858 tem 10 tasks filhas
    When o usuário clica na linha do PBI #10858
    Then as tasks são exibidas em duas colunas: "Em andamento" e "Concluído"
    And cada task exibe status, horas e responsável

  Scenario: Filtro de backlog por status funciona
    Given o backlog tem 22 itens com diferentes status
    When o usuário clica no filtro "Em progresso"
    Then apenas os itens com status "In Progress" e blockStatus "CLEAR" são exibidos
    And o contador de itens é atualizado corretamente

  Scenario: Membro sobrecarregado exibe barra vermelha
    Given Vinicius Piovesan tem rem=56h e cap=48h (117%)
    When a tabela de distribuição é exibida
    Then a barra de alocação de Vinicius é vermelha
    And o percentual "117%" é exibido em vermelho

  Scenario: Dashboard exibe day offs com destaque âmbar
    Given Lucas Seguessi tem day off em 19/03
    When a tabela de distribuição é exibida
    Then abaixo da capacidade de Lucas aparece "off: 19/03" em cor âmbar
```

---

## Módulo: Insights de IA

```gherkin
Feature: Geração de insights pelo LLM

  Scenario: Insights são gerados assincronamente
    Given o dashboard está aberto e o LLM está configurado
    When a seção de insights é carregada
    Then um spinner é exibido com texto "Consultando [provider]..."
    And o restante do dashboard é acessível normalmente
    And após a resposta do LLM os cards de insights aparecem

  Scenario: Sobrecarga individual gera critical
    Given Piovesan está com 117% de alocação (rem=56h, cap=48h)
    And nenhum contexto RAG justifica essa alocação
    When os insights são gerados
    Then existe um card com severity="critical" citando Piovesan
    And o card menciona "117%" e as horas reais

  Scenario: Sobrecarga consolidada em 1 único card
    Given Piovesan (117%), Aimê (104%) e Anísio (104%) estão sobrecarregados
    When os insights são gerados
    Then existe exatamente 1 card critical para sobrecarga
    And todos os 3 membros são citados nesse card

  Scenario: Ociosidade gera warning por papel
    Given Lucas Maia está com 10% de alocação (rem=5h, cap=48h)
    And Lucas Seguessi está com 35% de alocação (rem=17h, cap=48h)
    When os insights são gerados
    Then existe um card warning sobre "Baixa utilização em Front End"
    And ambos os Lucas são citados com seus percentuais reais

  Scenario: Folga de capacidade não gera alerta de risco
    Given o remaining total é 270h e a capacidade total é 384h
    When os insights são gerados
    Then não existe nenhum card critical sobre "risco de não entrega"
    And se o LLM gerar tal card erroneamente, o validador R0 o corrige para "Capacidade com folga"

  Scenario: Contexto RAG evita alerta sobre situação tratada
    Given existe RAG: "PBI #10858 do Piovesan negociado para próxima sprint"
    When os insights são gerados
    Then o card sobre o PBI #10858 recebe severity="ok"
    And a sobrecarga individual de Piovesan (>100%) ainda aparece como critical

  Scenario: Deduplicação evita cards repetidos
    Given o LLM retorna 2 cards com o mesmo título
    When o validador processa os insights
    Then apenas 1 card com aquele título é exibido
    And o Logger registra "Dedup removeu: [título]"

  Scenario: Timeout de 90s desbloqueia o UI
    Given o LLM não responde dentro de 90 segundos
    When o timeout expira
    Then o spinner é substituído por "⏱ Tempo esgotado. Clique em ↻ para tentar novamente"
    And todos os botões do dashboard voltam a funcionar

  Scenario: Botão Mais Insights acumula sem duplicar
    Given o grid já exibe 4 cards de insights
    When o usuário clica em "↻ Mais insights"
    Then novos cards são adicionados ao grid
    And cards com títulos já exibidos são ignorados
    And o botão exibe "(+N)" com o número de cards adicionados
```

---

## Módulo: Chat de Perguntas

```gherkin
Feature: Chat de perguntas livres ao LLM

  Scenario: Pergunta retorna resposta baseada nos dados reais
    Given o dashboard está aberto com dados de 9 membros
    When o usuário pergunta "Quantos QA tem no time?"
    Then a resposta cita "Quality Analyst: 1 membro" com o nome correto
    And nenhum membro inventado é citado

  Scenario: LLM não inventa membros inexistentes
    Given o time tem 9 membros cadastrados
    When o usuário faz qualquer pergunta
    Then a resposta cita apenas membros da lista real do time
    And nenhum nome como "Bruno" ou "Carlos" (não cadastrados) aparece

  Scenario: Pergunta sobre saúde geral usa todos os dados
    Given a sprint tem sobrecarregados, ociosos e dias off
    When o usuário pergunta "Como está a sprint?"
    Then a resposta menciona pelo menos um dos pontos críticos
    And cita números reais (percentuais, horas)

  Scenario: Enter no campo envia a pergunta
    Given o painel de chat está aberto
    When o usuário digita uma pergunta e pressiona Enter
    Then a pergunta é enviada como se o botão "Perguntar" tivesse sido clicado

  Scenario: Double-submit é bloqueado
    Given uma pergunta está sendo processada
    When o usuário clica em "Perguntar" novamente
    Then a segunda submissão é ignorada (botão está desabilitado)

  Scenario: Timeout de 60s desbloqueia o campo de pergunta
    Given o LLM não responde em 60 segundos
    When o timeout expira
    Then o campo de texto e o botão são reabilitados
    And a mensagem "⏱ Tempo esgotado" é exibida no lugar do spinner
```

---

## Módulo: Download e Impressão

```gherkin
Feature: Download e impressão do dashboard

  Scenario: HTML baixado abre corretamente offline
    Given o usuário clica em "⬇ Baixar HTML"
    When o arquivo é aberto no browser sem conexão com internet
    Then o dashboard é exibido com todos os dados
    And os filtros de backlog funcionam
    And o expand de tasks funciona
    And não há referências a google.script.run ou jsapi

  Scenario: HTML baixado contém insights embutidos
    Given o LLM está configurado e a sprint tem dados
    When o usuário clica em "⬇ Baixar HTML"
    Then o arquivo HTML contém os cards de insights gerados
    And não existe spinner de carregamento no arquivo

  Scenario: HTML baixado não contém botões interativos do servidor
    When o arquivo HTML é gerado via getDashboardHtml()
    Then os botões "Mais insights", "Limpar insights", "Fazer pergunta" não estão presentes
    And os botões de download não estão presentes

  Scenario: Impressão expande automaticamente todos os itens
    Given o arquivo HTML está aberto no browser
    When o usuário inicia a impressão (Ctrl+P)
    Then o evento beforeprint expande todos os children-row
    And o painel de atividades é exibido
    And o CSS de impressão remove barras de scroll e formata para papel

  Scenario: PDF é gerado e salvo no Google Drive
    Given o usuário clica em "📄 Baixar PDF"
    When o servidor executa generateDashboardPDF()
    Then um arquivo HTML temporário é criado no Drive
    And convertido para PDF via DriveApp.getAs(MimeType.PDF)
    And o HTML temporário é movido para a lixeira
    And o PDF permanece no Drive com link público de download
```

---

## Módulo: RAG e Validação Determinística

```gherkin
Feature: Contexto RAG e regras determinísticas de validação

  Scenario: RAG de escopo geral é aplicado a todos os times
    Given existe RAG de escopo "geral" com contexto sobre velocidade histórica
    When qualquer time gera insights
    Then o contexto geral é incluído no prompt do LLM

  Scenario: RAG de escopo por time é aplicado apenas ao time ativo
    Given existe RAG de escopo "time" vinculado ao "Time de Backend"
    When o "Time de Frontend" gera insights
    Then o contexto específico do "Time de Backend" NÃO é incluído no prompt

  Scenario: Regra R0 corrige risco de entrega matematicamente impossível
    Given totalRem=270h e capacityTotal=384h (rem < cap)
    And o LLM gera um card critical "Alta probabilidade de não entrega"
    When o validador R0 processa o insight
    Then o card é alterado para severity="info" com título "Capacidade com folga"
    And o body descreve a folga de 30%

  Scenario: Regra R7 consolida múltiplos criticals em 1
    Given o LLM gerou 3 cards critical (um por papel)
    When o validador R7 processa os insights
    Then existe exatamente 1 card critical no resultado final
    And os bodies dos 3 cards são concatenados com " | "

  Scenario: Regra R8 injeta warning para membro ocioso não coberto
    Given Lucas Maia tem 10% de alocação e não foi citado em nenhum card
    When o validador R8 executa após o map
    Then um card warning "⚠️ Baixa utilização em Developer Front End" é injetado
    And cita Lucas Maia com rem, cap e percentual reais
```
