# 📂 Plano de Migração — Tarefas por Fase

> Este diretório divide as fases do [PLANO_MIGRACAO.md](../docs/PLANO_MIGRACAO.md) em tarefas granulares, cada uma atribuída a agentes específicos.

## Índice de Fases

| Fase | Arquivo | Status | Agente Principal |
|------|---------|--------|------------------|
| FASE 1 | [fase-1-fundacao-testes.md](./fase-1-fundacao-testes.md) | ✅ | AG-ORC |
| FASE 2 | [fase-2-modulos-core.md](./fase-2-modulos-core.md) | 🔴 | AG-EXT |
| FASE 3 | [fase-3-servicos.md](./fase-3-servicos.md) | 🔴 | AG-EXT |
| FASE 4 | [fase-4-componentes-ui.md](./fase-4-componentes-ui.md) | 🔴 | AG-EXT |
| FASE 5 | [fase-5-css.md](./fase-5-css.md) | 🔴 | AG-EXT |
| FASE 6 | [fase-6-integracao.md](./fase-6-integracao.md) | 🔴 | AG-EXT + AG-INT |

## Como Usar

1. Abra o arquivo da fase atual
2. Execute as tarefas na ordem listada
3. Para cada tarefa, siga o pipeline de agentes definido
4. Marque como `[x]` ao concluir
5. Só avance para próxima fase quando TODAS as tarefas da atual estiverem concluídas

## Pipeline Padrão por Tarefa

```
AG-ORC atribui tarefa → AG-EXT executa
    → AG-DOC valida conformidade
    → AG-QUA revisa qualidade
    → AG-UNI cria/executa testes unitários
    → AG-REG verifica regressão
    → AG-INT testa integração (se aplicável)
    → AG-ORC marca como concluída
```

## Referências dos Agentes

- [Orquestrador](../agents/orchestrator.md) — `AG-ORC`
- [Validador de Documentação](../agents/doc-validator.md) — `AG-DOC`
- [Guardião de Regressão](../agents/regression-guard.md) — `AG-REG`
- [Qualidade de Código](../agents/code-quality.md) — `AG-QUA`
- [Testador Unitário](../agents/unit-tester.md) — `AG-UNI`
- [Testador de Integração](../agents/integration-tester.md) — `AG-INT`
- [Extrator de Código](../agents/extractor.md) — `AG-EXT`
