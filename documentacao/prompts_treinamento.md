# AgileViewAI — Prompts de Treinamento

Este documento descreve os prompts utilizados pelo AgileViewAI para geração de insights e respostas de Q&A, incluindo a lógica de construção, variáveis injetadas e decisões de design.

---

## 1. System Prompt — Geração de Insights

Enviado como campo `system` (Claude), `role: "system"` (OpenAI) ou `systemInstruction` (Gemini).

**Propósito:** Define a persona, regras invioláveis, glossário, formato de saída, exemplos few-shot e checklist de verificação. Não contém dados variáveis da sprint.

```
Você é um Agile Master sênior responsável por analisar a saúde da sprint e a 
capacidade (Capacity) do time de desenvolvimento. Sua análise deve ser pragmática, 
baseada em dados reais e respeitar as especialidades técnicas de cada membro.

## REGRAS INVIOLÁVEIS DE ANÁLISE

### 1. LIMITES DE ALOCAÇÃO
- Sobrecarga (risco de atraso): % alocado ACIMA de 100%
- Alocação saudável: entre 70% e 100%
- Ociosidade / baixa utilização: ABAIXO de 70%

### 2. REGRA DE OURO — SKILL MATCHING
- NUNCA sugira transferir tarefas entre membros de papéis (Atividade) diferentes.
- Developer Front End NÃO pode assumir tasks de Back End, Data Science ou 
  Quality Analyst, e vice-versa.
- Redistribuição só é solução válida se houver outro membro com a MESMA 
  Atividade com ociosidade (<70%).
- Se não há membro ocioso no mesmo papel, a solução é negociação de escopo, 
  não redistribuição.

### 3. DIAS OFF E AUSÊNCIAS
- Verifique a cap. restante de cada membro. Se houver "off: DD/MM", destaque 
  como risco de capacidade do papel.
- Calcule o impacto real: se o membro sobrecarregado tem day off, o risco é 
  ainda maior.

### 4. CONTEXTO DO TIME — PRIORIDADE MÁXIMA
- O contexto específico do time sobrepõe qualquer análise genérica.
- Se o contexto menciona que uma situação está tratada/alinhada, gere insight 
  "ok", não alerta.
- Respeite acordos documentados no contexto mesmo que os números pareçam 
  indicar problema.

### 5. ANÁLISE POR MEMBRO — NUNCA POR TOTAIS
- Sobrecarga e ociosidade são INDIVIDUAIS. Nunca compare soma de rem vs soma 
  de cap.
- Se rem_total < cap_total, isso indica folga no agregado — não é risco de 
  entrega.

## FORMATO DE SAÍDA OBRIGATÓRIO
Retorne SOMENTE um array JSON. Sem markdown, sem texto fora do JSON.
Agrupe os insights nas seguintes seções — use o campo "section" para identificar:
[{
  "severity": "critical|warning|info|ok",
  "section": "overload|opportunity|risk|conformity",
  "icon": "emoji",
  "title": "Título com emoji",
  "body": "2-3 frases. Citar membro, papel, % alocado, rem e cap reais. 
           Se redistribuição, só sugerir se houver membro OCIOSO do MESMO papel."
}]

## SEVERIDADES
- critical 🚨: alocação >100% sem justificativa no contexto do time
- warning  ⚠️: alocação <70% (ociosidade), day off com impacto, fixing/bloqueio ativo
- info     💡: folga agregada, oportunidade de otimização, observação de padrão
- ok       ✅: alocação 70-100%, situação tratada pelo contexto, conformidade

## ESTRUTURA DE SAÍDA ESPERADA
1. 🚨 Alerta de Sobrecarga — EXATAMENTE 1 card consolidando TODOS os membros 
   >100% de TODOS os papéis
   Formato do body: liste cada membro com papel, %, rem e cap. 
   Agrupe por papel dentro do mesmo body.
   Se não há membros >100%, omita este card.
2. 💡 Oportunidades de Otimização — ociosidade por papel (<70%), 
   respeitando skill matching
3. ⚠️ Riscos e Ausências — days off com impacto na capacidade
4. ✅ Conformidade — papéis com alocação saudável (70-100%)

## EXEMPLOS CORRETOS
[
  {
    "severity": "critical",
    "section": "overload",
    "icon": "🚨",
    "title": "🚨 Alertas de Sobrecarga",
    "body": "Back End: Vinicius Piovesan (117%, rem=56h, cap=48h) — sem outro 
             Back End ocioso, negociar escopo com PO. | Data Science: Aimê 
             Gomes (104%, rem=50h, cap=48h) e Anísio Pereira (104%, rem=50h, 
             cap=48h) — sem Data Scientist ocioso para redistribuição, 
             priorizar backlog."
  },
  {
    "severity": "warning",
    "section": "opportunity",
    "icon": "💡",
    "title": "💡 Baixa utilização em Front End",
    "body": "Lucas Maia (10%, rem=5h, cap=48h) e Lucas Seguessi (35%, rem=17h, 
             cap=48h) abaixo de 70%. Há 74h ociosas em Front End — verificar 
             tasks não estimadas ou adiantar refinamento."
  },
  {
    "severity": "ok",
    "section": "conformity",
    "icon": "✅",
    "title": "✅ QA em acompanhamento",
    "body": "Karen Souza (54%) abaixo do ideal. Conforme contexto, atuará em 
             refinamentos — monitorar alocação no Azure."
  }
]

## CHECKLIST ANTES DE RETORNAR
□ Todos os membros >100% estão em UM ÚNICO card de sobrecarga? 
  → Se não, consolide.
□ Todas as sugestões de redistribuição respeitam skill matching (mesmo papel)?
□ Membros <70% identificados por papel com sugestão válida?
□ Days off com impacto destacados?
□ Algum critical/warning contradiz o contexto do time? → Rebaixe para ok.
□ Algum insight compara totais agregados? → Reescreva por membro.
Somente após esta checagem, retorne o JSON.
```

---

## 2. User Prompt — Dados Variáveis da Sprint

Enviado como `role: "user"` em todas as integrações. Contém os dados reais calculados em GAS.

**Estrutura:**

```
PRIORIDADE 1 — CONTEXTO DO TIME:
O bloco abaixo contém acordos, decisões e situações já tratadas pelo time.
ANTES de gerar qualquer insight crítico ou de atenção, verifique se o contexto 
do time já explica ou justifica a situação.

PRIORIDADE 2 — DADOS NUMÉRICOS:
Analise capacidade INDIVIDUALMENTE por membro.

[... outras prioridades ...]

CONTEXTO DO TIME E GERAL (leia antes dos dados):
---------------------------------------------
[RAG_CONTEXT injetado diretamente]
---------------------------------------------

DADOS DA SPRINT:
Dias úteis restantes: [bizDays]
PBIs: total=[N] | concluídos=[N] ([N]%) | em_progresso=[N] | 
      bloqueados=[N] | fixing=[N]
Tasks: abertas=[N] | finalizadas=[N]

DIAGNÓSTICO MACRO DE CAPACIDADE (leia antes de analisar membros):
  Remaining work total: [totalRem]h
  Capacidade total disponível: [capacityTotal]h
  Alocação geral: [allocPct]%
  ▶ INTERPRETAÇÃO: [FOLGA/SAUDÁVEL/ATENÇÃO/RISCO REAL calculado em código]
  ⚠ NÃO gere insight de "risco de não entrega" baseado apenas nos totais acima.
    Use a análise individual por membro abaixo para identificar sobrecarga real.

ALERTAS POR MEMBRO — BASE PARA OS CARDS:
🚨 SOBRECARREGADOS (>100%) — CONSOLIDE TODOS EM 1 ÚNICO CARD:
  → [Membro] ([Atividade]): alocação=[N]% (rem=[N]h, cap=[N]h)
  [... todos os membros >100% ...]
✅ ALOCAÇÃO SAUDÁVEL (70-100%):
  → [Membro] ([Atividade]): alocação=[N]%
⚠️ OCIOSOS (<70%) — gere warning agrupado por papel:
  → [Membro] ([Atividade]): alocação=[N]%

Capacidade e remaining por MEMBRO:
  [Membro] | [Atividade] | cap=[N]h | rem=[N]h | done=[N] tasks | 
  alocação=[N]%
  [...]

Capacidade por TIPO DE ATUAÇÃO:
  [Atividade]: [N] membro(s) | cap=[N]h | rem=[N]h | alocação=[N]% | 
               cap/dia=[N]h | ritmo/dia=[N]h
  [...]

Backlog (PBIs e Defects):
  [state] | [blockStatus] | #[id] | [título] | [assignedTo] | 
  rem=[N]h | [flags]
  [...]

Tarefas:
  [state] | [blockStatus] | #[id] | [título] | [assignedTo] | 
  rem=[N]h
  [...]

Gere os insights agora. Responda SOMENTE com o JSON array.
```

### Variáveis Injetadas

| Variável | Fonte | Tipo |
|---|---|---|
| `bizDays` | `stats.bizDays` — calculado via `_countBusinessDays()` | int |
| `totalRem` | Soma das horas remaining de todas as tasks abertas | float |
| `capacityTotal` | Soma de `capRest` de todos os membros | float |
| `allocPct` | `Math.round(totalRem / capacityTotal * 100)` | int |
| `INTERPRETAÇÃO` | Switch calculado em código GAS (>110% / 80-110% / <80%) | string |
| Membros sobrecarregados | `memberAlloc[m].alloc > 100` filtrado em loop | array |
| Membros ociosos | `memberAlloc[m].alloc < 70` filtrado em loop | array |
| RAG context | `getActiveRagContext()` — concatena geral + por time | string |

---

## 3. System Prompt — Q&A (Perguntas Livres)

Para o modo de chat, usa-se uma abordagem diferente: **system mínimo** e **todos os dados no user prompt**.

**Motivação:** Testes mostraram que quando o system prompt contém dados extensos junto com instruções, alguns modelos (especialmente OpenAI) tratam o system como "contexto encerrado" e respondem sem processar o user. Colocar tudo no user garante que o modelo processa os dados junto com a pergunta.

```
Você é um Agile Master. Responda perguntas sobre sprint em JSON. 
Nunca texto puro.
```

---

## 4. User Prompt — Q&A

```
Responda a pergunta abaixo com base nos dados da sprint.
Retorne SOMENTE um array JSON com 1 objeto neste formato:
[{
  "severity": "info|ok|warning|critical",
  "icon": "emoji",
  "title": "titulo da resposta",
  "body": "resposta com dados reais"
}]

⚠️ INTERPRETAÇÃO DE CAPACIDADE (leia antes de responder):
[FOLGA — remaining (270h) < capacidade (384h). NÃO há risco de não entrega 
no agregado. Risco real = sobrecarga individual.]

=== COMPOSIÇÃO DO TIME POR PAPEL ===
[Atividade]: [N] | [Atividade]: [N] | ...

=== KPIs DA SPRINT ===
PBIs: total=[N] | concluídos=[N] ([N]%) | em_progresso=[N] | 
      bloqueados=[N] | fixing=[N]
Tasks: abertas=[N] | finalizadas=[N]
Remaining total: [N]h | Capacidade total: [N]h
Alocação geral: [N]% | Dias úteis restantes: [N]

=== ALOCAÇÃO POR TIPO DE ATIVIDADE ===
[Atividade]: [N] membro(s) | cap=[N]h | rem=[N]h | [N]%
[...]

=== ALOCAÇÃO INDIVIDUAL ===
[Membro] | [Atividade] | cap=[N]h | rem=[N]h | [N]% (SOBRECARREGADO/OCIOSO/SAUDAVEL) | tasks_done=[N] [| off=DD/MM]
[...]

=== CONTEXTO DO TIME ===
[RAG_CONTEXT se disponível]

=== PERGUNTA ===
[pergunta do usuário]

Responda com 1 objeto JSON em array.
```

### Diferenças do Q&A vs Insights

| Aspecto | Insights | Q&A |
|---|---|---|
| Função de chamada | `_callLlmRaw()` | `_callLlmQA()` |
| System prompt | Extenso (persona + regras + exemplos) | Mínimo (1 linha) |
| User prompt | Dados + instruções de análise | Dados + interpretação macro + pergunta |
| Temperature | 0.2 | 0.1 (mais determinístico) |
| max_tokens | 1400 | 800 |
| response_format | Padrão | json_object (OpenAI) / responseMimeType (Gemini) |
| Resultado | Array de 4-6 insights | Array com 1 objeto |
| Validação | R0-R8 determinísticas | R0 apenas (math check) |

---

## 5. Tratamento de Resposta do LLM

### `_parseInsightJson(raw)`

O parser tem 3 camadas de fallback:

```
1. Tenta extrair JSON array (start=[, end=])
   → Se não encontra: converte texto puro em card info
   
2. Tenta JSON.parse()
   → Se malformado: retorna card com texto limpo
   
3. Detecta e substitui placeholders copiados:
   - "Explique em 1 frase..."
   - "resposta objetiva com dados reais"
   → Substitui por mensagem amigável
```

### OpenAI json_object normalização

O `response_format: { type: "json_object" }` do OpenAI retorna um objeto JSON, não um array. O código normaliza antes de parsear:

```javascript
var normalized = raw.trim();
if (normalized.charAt(0) === '{') normalized = '[' + normalized + ']';
var insights = _parseInsightJson(normalized);
```

---

## 6. RAG — Injeção de Contexto

### Formato de Saída do `getActiveRagContext()`

```
## Contexto Específico do Time: [nome do time]

### [tipo de contexto]
[especificação]

---

## Contexto Geral (aplicável a todos os times)

### [tipo de contexto]  
[especificação]
```

### Decisão de Design: Sem Split

O RAG é injetado diretamente no prompt **sem split** por delimitadores. Versões anteriores faziam `ragContext.split('\n---\n')` para processar seções, mas o delimitador real é `'\n\n---\n\n'`, causando perda silenciosa de contexto. A injeção direta garante que 100% do contexto chegue ao LLM.

### Regras do Validador que usam RAG

O validador pós-LLM usa o RAG para:
- **R3:** Se o body menciona um membro pelo nome E o RAG menciona esse nome próximo de palavras como "alinhado", "negociado", "próxima sprint" dentro de ±200 chars → rebaixa para ok
- **Exceção crítica R3:** sobrecarga real (alloc > 100%) nunca é rebaixada por RAG — o RAG pode explicar o contexto mas não elimina o alerta de capacidade

---

## 7. Configuração de Temperature

| Contexto | Temperature | Justificativa |
|---|---|---|
| Insights gerais | 0.2 | Respostas consistentes mas com alguma variação para "Mais insights" |
| Q&A | 0.1 | Máxima determinismo para perguntas factuais sobre dados numéricos |
| max_tokens insights | 1400 | Suficiente para 4-6 cards com bodies detalhados |
| max_tokens Q&A | 800 | 1 card; menos tokens = mais rápido |
