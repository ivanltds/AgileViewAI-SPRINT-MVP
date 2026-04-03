---
description: Valida o Gate de uma fase completa antes de avançar para a próxima
---

# Workflow: Validar Gate de Fase

## Pré-condições

1. Todas as tarefas da fase estão marcadas como `[x]` no arquivo `plano-de-migracao/fase-N-*.md`

## Passo 1: Verificar Completude

// turbo
2. Leia o arquivo da fase em `plano-de-migracao/` e confirme que TODAS as tarefas estão `[x]`
3. Se alguma está `[ ]` → não pode avançar, execute-a primeiro

## Passo 2: Executar Todos os Testes

// turbo
4. Execute `npm test` (toda a suite: BDD + Unit + Integration)
5. Se algum teste falha → corrija antes de prosseguir

## Passo 3: Verificar Monolito Intacto

// turbo
6. Execute `git diff agileviewai2.3.html` — deve retornar VAZIO
7. Se o monolito foi alterado → PARE e restaure do git

## Passo 4: Auditoria de Documentação

8. Leia `agents/doc-validator.md` — execute SKILL 4 (Auditoria de Cobertura)
9. Verifique mapa de cobertura BDD: cenários documentados vs testes implementados

## Passo 5: Verificar Bloqueios

10. Busque por qualquer `BLOQUEIO` pendente nos arquivos de tarefa
11. Se houver bloqueio não resolvido → PARE e escale ao USUÁRIO

## Passo 6: Atualizar Status

12. Atualize o status da fase em `agents/orchestrator.md` (de 🔴 para ✅)
13. Atualize `docs/PLANO_MIGRACAO.md` com a data de conclusão

## Resultado

14. Reporte:
    - Fase N concluída
    - Testes: X passando, Y falhando
    - Coverage: N%
    - Bloqueios: 0 pendentes
    - Próxima fase: N+1
