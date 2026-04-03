---
description: Cria e executa testes de integração entre 2+ módulos
---

# Workflow: Criar Testes de Integração

## Pré-condições

1. Os módulos envolvidos já existem e passam nos testes unitários
2. Leia `agents/integration-tester.md` para os 8 fluxos definidos

## Passo 1: Identificar Fluxo

// turbo
3. Leia `agents/integration-tester.md` e identifique qual fluxo de integração testar
4. Identifique os módulos envolvidos

## Passo 2: Criar Teste de Integração

5. Crie `tests/integration/<fluxo>.test.js` com:
   - Import dos módulos REAIS (não mocks de módulos internos)
   - Mock APENAS de APIs externas (fetch, crypto, DOM)
   - Testes que exercitam o fluxo completo end-to-end
   - Testes de propagação de erro entre módulos
   - Testes de contrato (interface respeitada)

**Fluxos disponíveis**:
```
FASE 2: auth-flow (Vault + Store), sync-flow (Store + AzureAPI)
FASE 3: insights-flow, chat-flow, eficiencia-flow, qualidade-flow
FASE 4: team-switch-flow, export-flow
```

## Passo 3: Executar

// turbo
6. Execute: `npm run test:integration -- --testPathPattern="<fluxo>"`
7. Verifique que todos passam

## Passo 4: Regressão Cruzada

// turbo
8. Execute TODOS os testes de integração existentes: `npm run test:integration`
9. Verifique que nenhum fluxo anterior quebrou

## Passo 5: Resultado

10. Reporte:
    - Fluxo testado e módulos envolvidos
    - Número de testes criados
    - Falhas encontradas (se houver)
    - Se algum contrato entre módulos está quebrado → ESCALAR ao USUÁRIO
