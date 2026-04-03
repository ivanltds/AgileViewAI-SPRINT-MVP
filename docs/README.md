# AgileViewAI — Documentação Técnica Completa

> **Versão documentada:** v2.3  
> **Data:** Abril 2026  
> **Arquivo principal:** `agileviewai2.3.html`

---

## Índice de Documentos

| Nº | Documento | Conteúdo |
|---|---|---|
| 01 | [Design e Experiência](./01_design_e_experiencia.md) | Sistema visual, layout, responsividade, micro-animações, componentes de UI |
| 02 | [Funcionalidades](./02_funcionalidades.md) | Catálogo completo de todas as funcionalidades implementadas |
| 03 | [Tutorial de Uso](./03_tutorial_de_uso.md) | Guia passo a passo para usuários finais |
| 04 | [Cenários BDD](./04_cenarios_bdd.md) | Especificações Gherkin para todas as features |
| 05 | [Casos de Uso](./05_casos_de_uso.md) | Fluxos completos (UC-01 a UC-12) com atores, pré-condições e alternativas |
| 06 | [Solução Técnica](./06_solucao_tecnica.md) | Arquitetura, módulos JS, cifragem, validador R0-R8, prompts LLM |
| 07 | [Escalabilidade](./07_escalabilidade.md) | Vetores de crescimento, roadmap de fases, estimativas de custo |
| 08 | [Dados](./08_dados.md) | Fontes, endpoints Azure, campos coletados, tratamentos, privacidade |

---

## Resumo Executivo

**AgileViewAI** é um app web standalone (arquivo HTML único) para monitoramento inteligente de sprints Azure DevOps com análise de IA. Roda 100% no browser do usuário, sem backend próprio.

### Principais Capacidades

```
┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  Azure DevOps   │───▶│  AgileViewAI    │───▶│  Dashboard +     │
│  REST API v7.1  │    │  (Browser SPA)  │    │  Insights de IA  │
└─────────────────┘    └────────┬────────┘    └──────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              OpenAI       Anthropic     Google
              (GPT-4o)     (Claude)      (Gemini)
```

### Fluxo Principal

```
1. Abertura → Vault (PIN ou Sessão)
2. Configurar → Time + PAT + Token LLM
3. Sincronizar → Azure API → Dados da Sprint
4. Visualizar → Dashboard (KPIs + Backlog + Progresso)
5. Analisar → Insights de IA (A1→A2→A3→Validador R0-R8)
6. Treinar → RAG (contextos de time)
7. Compartilhar → Download HTML offline
```

### Stack Tecnológico

| Componente | Tecnologia |
|---|---|
| Runtime | Browser nativo (vanilla JS ES2020+) |
| Cifragem | Web Crypto API (AES-256-GCM + PBKDF2) |
| Persistência | localStorage |
| HTTP | Fetch API (sem biblioteca) |
| Gráficos | Chart.js 4.4.4 (CDN) |
| Markdown | Parser próprio (sem biblioteca) |
| CSS | Vanilla CSS com custom properties |
| Azure | REST API v7.1 |
| LLMs | OpenAI, Anthropic, Google APIs |

### Números do Projeto

| Métrica | Valor |
|---|---|
| Linhas de código | ~5.053 (HTML único) |
| Tamanho do arquivo | ~313 KB |
| Módulos JS principais | 12 (Vault, Store, AzureAPI, DataProcessor, EficienciaProcessor, QualidadeAPI, DB, FC, ...) |
| Regras do validador | 8 (R0-R8) |
| Agentes de IA | 3 (A1 Analista, A2 Revisor, A3 Comunicador) |
| Tipos de RAG | 10 categorias pré-definidas |
| Breakpoints CSS | 3 (desktop >900px, tablet ≤900px, mobile ≤768px) |
| Casos de uso documentados | 12 (UC-01 a UC-12) |
| Cenários BDD | 60+ |
| Vetores de escalabilidade | 7 |

---

## Decisões de Arquitetura Importantes

### Por que Single File App (SFA)?

1. **Zero fricção de instalação** — abrir o arquivo = usar o app
2. **Privacidade máxima** — dados nunca saem do browser sem autorização explícita do usuário
3. **Zero custo operacional** — sem servidor, sem banco de dados, sem cloud
4. **Portabilidade** — funciona em qualquer OS/browser sem instalação
5. **Compartilhamento trivial** — um arquivo .html resolve o problema de distribuição

### Por que localStorage + Vault em vez de backend?

1. Tokens de API (PAT, LLM) armazenados localmente com cifragem AES-256-GCM
2. Sem risco de vazar tokens em breach de servidor
3. O usuário tem controle total dos seus dados
4. Modo Sessão como alternativa zero-persistence para ambientes corporativos restritos

### Por que validador determinístico (R0-R8)?

LLMs cometem erros matemáticos previsíveis em análises de capacidade:
- Ignoram o contexto RAG ao gerar alertas
- Geram múltiplos cards duplicados de sobrecarga
- Confundem totais com alocações individuais
- Não percebem que a situação está "tratada" pelo time

O validador não tenta substituir o LLM — ele corrige inconsistências verificáveis deterministicamente, garantindo que os insights reflitam a realidade dos dados.

---

## Glossário

| Termo | Definição |
|---|---|
| **PAT** | Personal Access Token — chave de autenticação na API do Azure DevOps |
| **PBI** | Product Backlog Item — item principal do backlog no Azure DevOps |
| **Defect** | Tipo de work item similar ao Bug no Azure DevOps |
| **Sprint ativa** | Iteração com startDate ≤ hoje ≤ finishDate + buffer de 1 dia |
| **capRest** | Capacidade restante do membro (h/dia × dias úteis restantes na span - futuros days off) |
| **capTotal** | Capacidade total do membro na sprint inteira |
| **allocPct** | Percentual de alocação = remaining / capRest × 100 |
| **Estimativa original** | Maior valor de RemainingWork já registrado nas revisões de uma task |
| **RAG** | Retrieval-Augmented Generation — injeção de contexto específico no prompt do LLM |
| **Throughput** | Número de itens concluídos por sprint |
| **Lead Time** | Tempo entre criação e fechamento de um item (dias) |
| **Cycle Time** | Tempo entre ativação e fechamento de um item (dias) |
| **BLOCKED** | Work item com impedimento ativo que requer ação externa |
| **FIXING** | Work item em correção interna de impedimento |
| **Vault** | Módulo de cifragem local que protege PATs e tokens LLM |
| **SFA** | Single File Application — app inteiramente contido em um único HTML |
| **DORA** | DevOps Research and Assessment — 4 métricas de maturidade DevOps |
