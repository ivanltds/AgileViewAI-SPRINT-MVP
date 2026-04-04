# FASE 1: Fundação e Testes — Tarefas

> **Status**: ✅ Concluída | **Risco**: Baixo | **Agente Principal**: Orchestrator / Especialista DevOps

---

## Objetivo da Fase
Estabelecer a base rigorosa e técnica para a migração modular, diagnosticando o tamanho do monolito legado, providenciando as fundações de teste, os frameworks de validação (Jest + jsdom), e implementando os cenários críticos (Rede de Segurança via BDD) antes da delegação dos trabalhos às esteiras de extração.

---

## Tarefa 1.1: Mapeamento e Diagnóstico da Estrutura Atual

### 1.1.1 — Inspeção do Monolito
- **Ação**: Inspecionar e traçar a estrutura arquitetônica do arquivo central `agileviewai2.3.html`.
- **Validação de Linhas (Aprox)**:
  - ~650 linhas de CSS inline.
  - ~750 linhas de marcação HTML e UI.
  - ~3.500 linhas de lógicas JavaScript em namespace unificado.
- [x] Concluída

### 1.1.2 — Identificação dos Módulos Funcionais
- **Ação**: Particionar e registrar componentes independentes (Vault, Store, AzureAPI, Dashboard, Insights, Chat, Serviços de Eficiência, Serviços de Qualidade, UI/Helpers).
- [x] Concluída

---

## Tarefa 1.2: Setup e Configuração do Ambiente de Testes

### 1.2.1 — Inicialização e Dependências Node
- **Ação**: Estruturação via arquivo `package.json` definindo metadados, scripts customizados (e.g. `npm run test`) e repositórios padronizados.
- [x] Concluída

### 1.2.2 — Configuração do Framework e Virtual DOM
- **Ação**: Instalação e parametrização do ambiente **Jest** atrelado ao ecossistema do **jsdom** para emular e testar o funcionamento front-end sem um browser headless ativo.
- [x] Concluída

### 1.2.3 — Implementação do Setup Global (Mocks)
- **Ação**: Codificação do arquivo `tests/setup.js` garantindo estado global estanque. Fornecimento de stubs para a Storage API (`localStorage`), subcamadas nativas (`crypto`), manipulação DOM, assim como as camadas legadas em transição (`APP`, `Vault`, `Store`, `AzureAPI`).
- [x] Concluída

---

## Tarefa 1.3: Redes de Segurança via Testes BDD

### 1.3.1 — Estruturação de Comportamento
- **Ação**: Redigir o descritivo Gherkin-like em forma de `docs/04_cenarios_bdd.md` assegurando que as abstrações e testes reflitam o valor esperado pelo usuário final.
- [x] Concluída

### 1.3.2 — Testes Críticos do Módulo Vault
- **Ação**: Estruturação de base criptográfica via `tests/bdd/vault.feature.test.js`.
- **Cobetura**: Implementados **7 cenários** que avaliam geração e checagem de veracidade de derivação de chaves e PIN.
- [x] Concluída

### 1.3.3 — Testes de Gerenciamento de Times/Store
- **Ação**: Estruturação de dados locais e memória cacheada via `tests/bdd/times.feature.test.js`.
- **Cobertura**: Implementados **5 cenários** blindando gravação e leituras corporativas.
- [x] Concluída

### 1.3.4 — Testes de Tráfego de Sincronização
- **Ação**: Estruturar simulações de fluxo da API com `tests/bdd/sync.feature.test.js`.
- **Cobertura**: Implementados **6 cenários** simulando os ciclos e limites impostos pela sincronização da Azure API.
- [x] Concluída

---

## Gate de Fase — Critérios Consolidados

- [x] Metrificação exata disposta no documento mestre `PLANO_MIGRACAO.md`.
- [x] Suíte `npm test` capaz de rodar testes de forma isolada na CI.
- [x] Os primeiros **18 testes** BDD funcionais e rodando de maneira 'verde' (Sucesso).
- [x] Injeções de Mock do Jest estabilizadas; isolamento do DOM configurado de maneira imutável antes da execução da file.
- [x] Liberada formalmente a FASE 2.
