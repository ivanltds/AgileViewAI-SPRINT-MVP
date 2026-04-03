---
description: Valida conformidade do código com os documentos de requisitos (BDD, funcionalidades, identidade visual)
---

# Workflow: Validar Documentação

## Pré-condições

1. O módulo já existe em `src/<camada>/<modulo>.js`
2. Leia `agents/doc-validator.md` para as regras completas

## Passo 1: Identificar Documentos de Referência

// turbo
3. Para o módulo em questão, identifique quais documentos consultar:
   - **Sempre**: `docs/04_cenarios_bdd.md` (cenários Gherkin) e `docs/02_funcionalidades.md` (features)
   - **Se módulo core**: `docs/06_solucao_tecnica.md` (arquitetura)
   - **Se módulo UI/CSS**: `docs/00_identidade_visual.md` e `docs/01_design_e_experiencia.md`
   - **Se módulo de dados**: `docs/08_dados.md` (schema localStorage)

## Passo 2: Validar Conformidade Funcional

// turbo
4. Leia o módulo extraído com `view_file`
5. Leia a Feature correspondente em `docs/04_cenarios_bdd.md`
6. Para CADA cenário BDD da feature, verifique:
   - [ ] A função correspondente existe no módulo
   - [ ] Os parâmetros estão de acordo
   - [ ] O comportamento descrito no cenário é implementado
   - [ ] Mensagens de erro em português

## Passo 3: Validar Completude

// turbo
7. Leia `docs/02_funcionalidades.md` — seção do módulo
8. Verifique que NENHUMA funcionalidade documentada foi omitida
9. Se encontrar funcionalidade faltando → reporte quais estão faltando

## Passo 4: Gerar Relatório

10. Reporte:
    - ✅ Conformidades encontradas
    - ⚠️ Não-conformidades (listar cada uma)
    - 🔴 Bloqueios (documentação ambígua ou contraditória → perguntar ao USUÁRIO)
    - Mapa de cobertura: cenários BDD vs funções implementadas
