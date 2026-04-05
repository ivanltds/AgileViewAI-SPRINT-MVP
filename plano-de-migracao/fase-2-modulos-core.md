# FASE 2: Módulos Core — Tarefas

> **Risco**: Baixo | **Dependências**: Nenhuma (módulos puros) | **Agente Principal**: AG-EXT

---

## Pré-requisitos

- [x] `npm install` executado com sucesso
- [x] `npm test` — todos os 18 testes passando
- [x] Monolito `agileviewai2.3.html` intacto (backup confirmado)
- [x] Diretório `src/core/` criado

---

## Tarefa 2.1: Extrair Módulo Vault

**Agentes**: AG-EXT → AG-DOC → AG-QUA → AG-UNI → AG-REG

### 2.1.1 — Localizar código Vault no monolito
- **Agente**: `AG-EXT`
- **Ação**: Buscar no monolito o bloco do Vault (funções `deriveKey`, `encrypt`, `decrypt`, `getSalt`, `isSetup`, `setupPin`, `verifyPin`, `encryptToken`, `decryptToken`, `reencryptAll`)
- **Saída**: Linhas exatas no monolito documentadas
- [x] Concluída

### 2.1.2 — Extrair para `src/core/vault.js`
- **Agente**: `AG-EXT`
- **Ação**: Copiar funções para novo arquivo, adicionar `export`, preservar lógica 100%
- **Referência**: `docs/06_solucao_tecnica.md` (seção criptografia)
- [x] Concluída

### 2.1.3 — Validar conformidade documental
- **Agente**: `AG-DOC`
- **Ação**: Comparar `src/core/vault.js` com `docs/04_cenarios_bdd.md` (Feature: Vault) e `docs/02_funcionalidades.md`
- **Checklist**:
  - [x] Todas 10 funções do Vault estão presentes
  - [x] PBKDF2 com 600.000 iterações conforme doc
  - [x] AES-256-GCM conforme doc
  - [x] Salt de 16 bytes conforme doc
- [x] Concluída

### 2.1.4 — Revisar qualidade de código
- **Agente**: `AG-QUA`
- **Ação**: Avaliar `src/core/vault.js` contra checklist de clean code e segurança
- **Foco especial**: Segurança (chaves, salt, IV aleatório)
- [x] Concluída

### 2.1.5 — Criar testes unitários
- **Agente**: `AG-UNI`
- **Ação**: Criar `tests/unit/core/vault.test.js` com testes para CADA função exportada
- **Cobertura mínima**: 90%
- **Cenários**:
  - [x] `deriveKey()` — PIN válido, PIN inválido, salt corrompido
  - [x] `encrypt()` — texto normal, texto vazio, dados binários
  - [x] `decrypt()` — base64 válido, base64 inválido, chave errada
  - [x] `isSetup()` — com salt, sem salt, salt parcial
  - [x] `setupPin()` — fluxo completo, PIN curto, PIN repetido
  - [x] `verifyPin()` — PIN correto, PIN incorreto, vault não configurado
  - [x] `encryptToken()` / `decryptToken()` — round-trip
  - [x] `reencryptAll()` — com dados, sem dados, falha parcial
- [x] Concluída

### 2.1.6 — Verificar regressão
- **Agente**: `AG-REG`
- **Ação**: Comparar `src/core/vault.js` com bloco Vault no monolito
- **Criterio**: Mesma lógica, mesmos resultados, mesmas chaves localStorage
- [x] Concluída

### 2.1.7 — Atualizar testes BDD existentes
- **Agente**: `AG-UNI`
- **Ação**: Atualizar `tests/bdd/vault.feature.test.js` para importar módulo real ao invés de mock, e adicionar cenários faltantes (Limpar vault, Apagar tudo)
- [x] Concluída

---

## Tarefa 2.2: Extrair Módulo Store

**Agentes**: AG-EXT → AG-DOC → AG-QUA → AG-UNI → AG-REG

### 2.2.1 — Localizar código Store no monolito
- **Agente**: `AG-EXT`
- **Ação**: Buscar funções `_g`, `_s`, `getTeams`, `saveTeams`, `getOrgs`, `saveOrgs`, etc.
- [x] Concluída

### 2.2.2 — Extrair para `src/core/store.js`
- **Agente**: `AG-EXT`
- **Ação**: Copiar para novo arquivo, preservar todas as chaves `avai_*`
- **Referência**: `docs/08_dados.md` (schema de dados)
- [x] Concluída

### 2.2.3 — Validar conformidade documental
- **Agente**: `AG-DOC`
- **Ação**: Comparar com `docs/08_dados.md` e `docs/04_cenarios_bdd.md` (Feature: Times)
- **Checklist**:
  - [x] Todas as chaves `avai_*` documentadas estão presentes
  - [x] Formato de dados conforme `docs/08_dados.md`
  - [x] Funções de leitura/escrita para cada entidade
- [x] Concluída

### 2.2.4 — Revisar qualidade de código
- **Agente**: `AG-QUA`
- **Ação**: Avaliar clean code, tratamento de JSON.parse, defaults seguros
- [x] Concluída

### 2.2.5 — Criar testes unitários
- **Agente**: `AG-UNI`
- **Ação**: Criar `tests/unit/core/store.test.js`
- **Cobertura mínima**: 90%
- **Cenários**:
  - [x] `_g()` / `_s()` — get/set básico, dados corrompidos, chave inexistente
  - [x] `getTeams()` / `saveTeams()` — CRUD completo
  - [x] `getOrgs()` / `saveOrgs()` — CRUD completo
  - [x] `getActiveTeam()` — com time ativo, sem time, time inválido
  - [x] `getActiveRag()` — concatenação de contextos, filtro por escopo
  - [x] `getSprintCache()` / `saveSprintCache()` — round-trip
- [x] Concluída

### 2.2.6 — Verificar regressão
- **Agente**: `AG-REG`
- **Ação**: Verificar paridade de chaves, formatos JSON, defaults
- [x] Concluída

### 2.2.7 — Atualizar testes BDD existentes
- **Agente**: `AG-UNI`
- **Ação**: Atualizar `tests/bdd/times.feature.test.js` para importar módulo real
- [x] Concluída

---

## Tarefa 2.3: Extrair Módulo AzureAPI

**Agentes**: AG-EXT → AG-DOC → AG-QUA → AG-UNI → AG-REG → AG-INT

### 2.3.1 — Localizar código AzureAPI no monolito
- **Agente**: `AG-EXT`
- **Ação**: Buscar funções `_fetch`, `_auth`, `_encTeam`, `getIterations`, `getTeamCapacity`, `getWorkItemIds`, `getWorkItemDetails`, `getWorkItemRevisions`
- [x] Concluída

### 2.3.2 — Extrair para `src/core/azure-api.js`
- **Agente**: `AG-EXT`
- **Ação**: Copiar para novo arquivo, adicionar `import { Store }` se necessário
- **Referência**: `docs/06_solucao_tecnica.md` (seção API Azure DevOps)
- [x] Concluída

### 2.3.3 — Validar conformidade documental
- **Agente**: `AG-DOC`
- **Ação**: Comparar com `docs/04_cenarios_bdd.md` (Feature: Sincronização) e `docs/06_solucao_tecnica.md`
- **Checklist**:
  - [x] Endpoints da Azure DevOps API corretos
  - [x] Codificação de team name com %20 (não encodeURIComponent)
  - [x] WIQL query sem itens Removed
  - [x] Lotes de 200 IDs
  - [x] Busca de revisões para estimativa
- [x] Concluída

### 2.3.4 — Revisar qualidade de código
- **Agente**: `AG-QUA`
- **Ação**: Segurança de PATs, tratamento de HTTP errors, async patterns
- [x] Concluída

### 2.3.5 — Criar testes unitários
- **Agente**: `AG-UNI`
- **Ação**: Criar `tests/unit/core/azure-api.test.js`
- **Cobertura mínima**: 90%
- **Cenários**:
  - [x] `_fetch()` — sucesso, 401, 404, timeout, network error
  - [x] `_encTeam()` — com espaços, sem espaços, caracteres especiais
  - [x] `getIterations()` — múltiplas sprints, array vazio
  - [x] `getWorkItemIds()` — WIQL com resultados, sem resultados
  - [x] `getWorkItemDetails()` — lote < 200, lote > 200 (batching)
  - [x] `getTeamCapacity()` — com daysOff, sem daysOff
- [x] Concluída

### 2.3.6 — Verificar regressão
- **Agente**: `AG-REG`
- **Ação**: Comparar URLs geradas, headers, body de requests
- [x] Concluída

### 2.3.7 — Criar testes de integração (Vault + Store + AzureAPI)
- **Agente**: `AG-INT`
- **Ação**: Criar `tests/integration/auth-flow.test.js` e `tests/integration/sync-flow.test.js`
- **Fluxos a testar**:
  - [x] Vault.setupPin → Store._s → tokens cifrados acessíveis
  - [x] Store.getActiveTeam → AzureAPI.getIterations → Store.saveSprintCache
- [x] Concluída

### 2.3.8 — Atualizar testes BDD existentes
- **Agente**: `AG-UNI`
- **Ação**: Atualizar `tests/bdd/sync.feature.test.js` para imports reais + cenários faltantes
- [x] Concluída

---

## Gate de Fase — Critérios para avançar para FASE 3

- [x] **Todos os 3 módulos** extraídos e em `src/core/`
- [x] **AG-DOC** aprovou conformidade dos 3 módulos
- [x] **AG-QUA** aprovou qualidade dos 3 módulos
- [x] **AG-UNI** — testes unitários passando com cobertura ≥ 90%
- [x] **AG-REG** — zero regressões identificadas
- [x] **AG-INT** — testes de integração passando
- [x] **`npm test`** — toda a suite passando (BDD + Unitários + Integração)
- [x] Nenhum `BLOQUEIO` pendente
