---
description: Orquestra a migração do monolito AgileViewAI, coordenando todos os agentes na extração de módulos
---

# Workflow: Executar Tarefa de Migração

Este workflow é o ponto de entrada para qualquer tarefa de migração. Antes de iniciar, leia o plano completo.

## Pré-condições
// turbo
1. Leia o arquivo `agents/orchestrator.md` para entender o contexto global, fase atual e agentes disponíveis.
2. Leia o arquivo da fase atual em `plano-de-migracao/` para identificar a próxima tarefa pendente (marcada com `[ ]`).
3. Leia `docs/PLANO_MIGRACAO.md` para contexto técnico do módulo a ser extraído.

## Execução da Tarefa

4. **AGENTE EXTRATOR**: Leia `agents/extractor.md` e execute a SKILL correspondente:
   - Localize o código no monolito `agileviewai2.3.html` usando `grep_search` e `view_file`
   - Extraia o módulo para `src/<camada>/<modulo>.js`
   - Siga RIGOROSAMENTE as regras de extração (não alterar lógica, apenas reorganizar)
   
5. **AGENTE VALIDADOR DE DOCUMENTAÇÃO**: Leia `agents/doc-validator.md` e execute:
   - Compare o módulo extraído com `docs/04_cenarios_bdd.md` e `docs/02_funcionalidades.md`
   - Verifique que TODAS as funções documentadas estão presentes
   - Se encontrar não-conformidade, corrija antes de prosseguir

6. **AGENTE QUALIDADE DE CÓDIGO**: Leia `agents/code-quality.md` e execute:
   - Avalie clean code, patterns JS, segurança
   - Verifique JSDoc nas funções exportadas
   - Se encontrar issue CRÍTICA ou ALTA, corrija antes de prosseguir

7. **AGENTE TESTADOR UNITÁRIO**: Leia `agents/unit-tester.md` e execute:
   - Crie testes unitários em `tests/unit/<camada>/<modulo>.test.js`
   - Execute com `npm run test:unit`
   - Coverage mínimo: 90% (core), 80% (services), 70% (UI)

8. **AGENTE GUARDIÃO DE REGRESSÃO**: Leia `agents/regression-guard.md` e execute:
   - Compare o módulo extraído com o bloco original no monolito
   - Verifique paridade de lógica, estado e localStorage
   - Se encontrar divergência, corrija ou escale ao USUÁRIO

9. **AGENTE TESTADOR DE INTEGRAÇÃO** (quando módulo tem dependências):
   - Leia `agents/integration-tester.md`
   - Crie teste de integração em `tests/integration/<fluxo>.test.js`
   - Execute com `npm run test:integration`

## Validação Final
// turbo
10. Execute `npm test` para verificar que TODOS os testes passam (BDD + Unit + Integration)

## Finalização

11. Marque a tarefa como `[x]` no arquivo da fase em `plano-de-migracao/`
12. Se TODAS as tarefas da fase estiverem concluídas, valide o Gate de Fase

## Regra de Escalação

> ⚠️ Se em QUALQUER etapa houver: mudança de comportamento, falha sem solução, risco de perda de dados, ou decisão ambígua → PARE e pergunte ao USUÁRIO antes de continuar. Use o formato de escalação definido em `agents/orchestrator.md`.
