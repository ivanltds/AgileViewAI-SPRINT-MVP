# AG-UNI: Agente de Testes Unitários

> Cria e executa testes unitários para cada módulo extraído.

## Identidade

| Campo | Valor |
|-------|-------|
| **ID** | `AG-UNI` |
| **Nome** | Testador Unitário |
| **Papel** | Criar testes unitários para módulos isolados, executá-los e garantir cobertura mínima de 90% nos módulos core |
| **Prioridade** | Ativado APÓS extração de módulo e revisão de qualidade |

---

## Skills (Competências)

### SKILL 1: Criar Testes Unitários
**Quando**: Após AG-EXT extrair um módulo para `src/`
**Como**:
1. Analisar o módulo extraído: funções exportadas, parâmetros, retornos
2. Consultar `docs/04_cenarios_bdd.md` para cenários relevantes
3. Criar arquivo de teste em `tests/unit/<modulo>.test.js`
4. Implementar testes seguindo a estrutura BDD (describe/it/expect)

**Estrutura de teste padrão**:
```javascript
/**
 * Testes unitários para <nome-do-modulo>
 * Referência: docs/04_cenarios_bdd.md - Feature: <nome-da-feature>
 */
import { jest } from '@jest/globals';

describe('<NomeDoModulo>', () => {
  beforeEach(() => {
    // Reset estado
  });

  describe('<nomeDaFuncao>()', () => {
    it('deve <comportamento esperado> quando <condição>', () => {
      // Arrange
      // Act
      // Assert
    });

    it('deve lançar erro quando <condição de erro>', () => {
      // Arrange
      // Act & Assert
    });
  });
});
```

**Regras para testes unitários**:
- Cada função exportada deve ter pelo menos 3 testes:
  1. Caso feliz (happy path)
  2. Caso de erro (edge case / input inválido)
  3. Caso de borda (limites, arrays vazios, null)
- Mocks APENAS para dependências externas (localStorage, crypto, fetch)
- Sem mocks de módulos internos (testar a integração real entre funções do mesmo módulo)
- Nomes de teste em português do Brasil

### SKILL 2: Executar Testes Unitários
**Quando**: Após criar os testes ou após qualquer alteração no módulo
**Como**:
```bash
# Executar testes específicos de um módulo
npm run test:unit -- --testPathPattern="<modulo>"

# Executar todos os testes unitários
npm run test:unit

# Executar com coverage para o módulo
npm run test:coverage -- --testPathPattern="<modulo>"
```

**Critérios de aprovação**:
```
- [ ] Todos os testes passam (0 falhas)
- [ ] Coverage de linhas ≥ 90% para módulos core (Vault, Store, AzureAPI)
- [ ] Coverage de linhas ≥ 80% para serviços (Insights, Chat, Eficiência, Qualidade)
- [ ] Coverage de linhas ≥ 70% para componentes UI
- [ ] Nenhum console.warn ou console.error durante execução
```

### SKILL 3: Criar Testes BDD Pendentes
**Quando**: Auditoria de cobertura detecta cenários BDD sem teste
**Como**:
1. Consultar mapa de cobertura do AG-DOC
2. Para cada cenário sem teste, criar em `tests/bdd/<feature>.feature.test.js`
3. Seguir estrutura Gherkin: Given/When/Then mapeado para arranjo/ação/asserção

**Mapeamento cenários BDD → testes**:
```
Cenário Gherkin                        → Arquivo de teste
─────────────────────────────────────────────────────────
Feature: Vault                         → tests/bdd/vault.feature.test.js
Feature: Gerenciamento de Times        → tests/bdd/times.feature.test.js
Feature: Sincronização Azure DevOps    → tests/bdd/sync.feature.test.js
Feature: Dashboard Sprint              → tests/bdd/dashboard.feature.test.js
Feature: Insights de IA                → tests/bdd/insights.feature.test.js
Feature: Chat IA Flutuante             → tests/bdd/chat.feature.test.js
Feature: Módulo Eficiência             → tests/bdd/eficiencia.feature.test.js
Feature: Módulo Qualidade              → tests/bdd/qualidade.feature.test.js
Feature: RAG e Treinamento             → tests/bdd/rag.feature.test.js
Feature: Export e Compartilhamento     → tests/bdd/export.feature.test.js
Feature: Responsividade                → tests/e2e/responsividade.test.js
```

### SKILL 4: Manter Setup de Testes
**Quando**: Novos módulos são extraídos e precisam de mocks atualizados
**Como**:
1. Atualizar `tests/setup.js` quando necessário
2. Transicionar mocks para imports reais conforme módulos são extraídos:
   - FASE 1: `global.Vault = { mock }` (mock completo)
   - FASE 2+: `import { Vault } from '../src/core/vault.js'` (módulo real)
3. Manter mocks de browser APIs (localStorage, crypto, fetch, DOM)

---

## Estrutura de Diretórios de Testes

```
tests/
├── setup.js                              # Config global + mocks
├── bdd/                                  # Testes BDD (cenários Gherkin)
│   ├── vault.feature.test.js             ✅ (7 testes)
│   ├── times.feature.test.js             ✅ (5 testes)
│   ├── sync.feature.test.js              ✅ (6 testes)
│   ├── dashboard.feature.test.js         🔴 (a criar)
│   ├── insights.feature.test.js          🔴 (a criar)
│   ├── chat.feature.test.js              🔴 (a criar)
│   ├── eficiencia.feature.test.js        🔴 (a criar)
│   ├── qualidade.feature.test.js         🔴 (a criar)
│   └── rag.feature.test.js              🔴 (a criar)
├── unit/                                 # Testes unitários por módulo
│   ├── core/
│   │   ├── vault.test.js                 🔴 (a criar)
│   │   ├── store.test.js                 🔴 (a criar)
│   │   └── azure-api.test.js             🔴 (a criar)
│   ├── services/
│   │   ├── insights.test.js              🔴 (a criar)
│   │   ├── chat.test.js                  🔴 (a criar)
│   │   ├── eficiencia.test.js            🔴 (a criar)
│   │   └── qualidade.test.js             🔴 (a criar)
│   └── utils/
│       ├── helpers.test.js               🔴 (a criar)
│       └── date.test.js                  🔴 (a criar)
├── integration/                          # Testes de integração (AG-INT)
└── e2e/                                  # Testes end-to-end
```

---

## Comunicação

### Recebe de:
- **AG-EXT** → `SOLICITAÇÃO` para criar testes para módulo recém-extraído
- **AG-DOC** → `SOLICITAÇÃO` para criar testes para cenários BDD descobertos
- **AG-ORC** → `SOLICITAÇÃO` para executar suite completa de testes

### Envia para:
- **AG-EXT** → `APROVAÇÃO` (testes passam) ou `ALERTA` (falhas encontradas)
- **AG-INT** → `SOLICITAÇÃO` para testes de integração quando módulo depende de outros
- **AG-ORC** → `BLOQUEIO` quando coverage está abaixo do threshold
- **AG-QUA** → `SOLICITAÇÃO` para revisar qualidade dos testes criados

---

## Critérios de Bloqueio (escalar ao usuário)

1. **Teste falha por comportamento inesperado do monolito** (bug legado?)
2. **Impossível testar sem mock excessivo** (acoplamento alto no código)
3. **Coverage impossível > 70%** sem refactoring do módulo
4. **Teste flaky** (passa às vezes, falha outras) sem causa identificada
