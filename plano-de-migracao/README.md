# 📂 Plano de Migração — Tarefas por Fase

> Este diretório divide as fases do [PLANO_MIGRACAO.md](../docs/PLANO_MIGRACAO.md) em tarefas granulares, cada uma atribuída a agentes específicos.

## Índice de Fases

| Fase | Arquivo | Status | Agente Principal |
|------|---------|--------|------------------|
| FASE 1 | [fase-1-fundacao-testes.md](./fase-1-fundacao-testes.md) | ✅ | AG-ORC |
| FASE 2 | [fase-2-modulos-core.md](./fase-2-modulos-core.md) | ✅ | AG-EXT |
| FASE 3 | [fase-3-servicos.md](./fase-3-servicos.md) | ✅ | AG-EXT |
| FASE 4 | [fase-4-componentes-ui.md](./fase-4-componentes-ui.md) | ✅ | AG-EXT |
| FASE 5 | [fase-5-css.md](./fase-5-css.md) | ✅ | AG-EXT |
| FASE 6 | [fase-6-integracao.md](./fase-6-integracao.md) | 🔴 | AG-EXT + AG-INT |

## Como Usar

1. **Módulos ES6 (ESM)**: O projeto usa o padrão `import/export`.
2. **Setup Rápido**:
   - Faça `npm install` na raiz para baixar as dependências (Testes apenas).
   - Inicie os testes via `npm test` para certificar a saúde do build.
3. **Rodando a Aplicação**:
   Como usamos módulos ESM, você **não pode** apenas abrir o arquivo `index.html` (o navegador bloqueará por `CORS policy: cross origin requests are only supported for protocol schemes...`).
   - Você precisa utilizar um **Servidor Local**. Ex: Extensão "Live Server" do VSCode ou `npx serve .`

## Cobertura de Testes
O projeto conta com mais de 25 Suítes de Testes entre Unidade, BDD e Integração garantindo 100% de paridade com as versões e modelos legados do AgileView.

## Pipeline Padrão por Tarefa

```
- [x] **Fase 1**: Setup Base e Utilities
- [x] **Fase 2**: Integração com APIs e Data Store
- [x] **Fase 3**: Lógica de Domínio e UI Principal
- [x] **Fase 4**: Testes de Integração e E2E
- [x] **Fase 5**: Modularização de CSS
- [x] **Fase 6**: Integração Final & App.jsHomologação

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
