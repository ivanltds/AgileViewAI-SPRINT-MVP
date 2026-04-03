---
description: Cria e executa testes unitários para um módulo recém-extraído
---

# Workflow: Criar Testes Unitários

## Pré-condições

1. O módulo já existe em `src/<camada>/<modulo>.js`
2. Leia `agents/unit-tester.md` para as regras completas de testes

## Passo 1: Analisar o Módulo

// turbo
3. Leia o módulo em `src/<camada>/<modulo>.js` com `view_file`
4. Liste todas as funções exportadas

## Passo 2: Consultar Cenários BDD

// turbo
5. Busque a Feature correspondente em `docs/04_cenarios_bdd.md`
6. Identifique cenários que devem virar testes

## Passo 3: Criar Arquivo de Testes

7. Crie `tests/unit/<camada>/<modulo>.test.js` com:
   - Import do módulo real (não mock)
   - Mock APENAS de APIs externas (localStorage, crypto, fetch)
   - Para CADA função exportada, no mínimo 3 testes:
     a) Caso feliz (happy path)
     b) Caso de erro (input inválido)
     c) Caso de borda (null, vazio, limites)
   - Nomes de testes em português do Brasil

**Estrutura**:
```javascript
import { jest } from '@jest/globals';

describe('<NomeDoModulo>', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('<funcao>()', () => {
    it('deve <comportamento> quando <condição>', () => {
      // Arrange → Act → Assert
    });
  });
});
```

## Passo 4: Executar Testes

// turbo
8. Execute os testes: `npm run test:unit -- --testPathPattern="<modulo>"`
9. Verifique que todos passam

## Passo 5: Validar Coverage

10. Execute com coverage: `npm run test:coverage -- --testPathPattern="<modulo>"`
11. Verifique thresholds:
    - Core (vault, store, azure-api): ≥ 90%
    - Services (insights, chat, eficiencia, qualidade): ≥ 80%
    - UI (components, utils): ≥ 70%

## Passo 6: Resultado

12. Reporte:
    - Número de testes criados
    - Coverage alcançado
    - Testes que falharam (se houver) e motivo
