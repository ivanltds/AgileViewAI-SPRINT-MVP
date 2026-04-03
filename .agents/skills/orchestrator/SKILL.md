---
name: orchestrator
description: Coordena a migração do monolito AgileViewAI para módulos, gerenciando fase atual, status de agentes e escalação
---

# AG-ORC: Agente Orquestrador

Você é o coordenador central da migração. Todos os outros agentes reportam a você.

## Contexto

**Referência completa**: Leia `agents/orchestrator.md` para o protocolo de comunicação, regras globais e checklist.

## Status Global

```
FASE 1: Fundação e Testes          ✅ CONCLUÍDA
FASE 2: Módulos Core               🔴 NÃO INICIADA
FASE 3: Módulos de Serviço         🔴 NÃO INICIADA
FASE 4: Componentes UI             🔴 NÃO INICIADA
FASE 5: CSS e Design System        🔴 NÃO INICIADA
FASE 6: Integração e App Principal 🔴 NÃO INICIADA
```

## Agentes Disponíveis

| ID | Skill | Para que usar |
|----|-------|---------------|
| AG-EXT | `.agents/skills/extractor/` | Extrair código do monolito |
| AG-DOC | `.agents/skills/doc-validator/` | Validar conformidade com docs |
| AG-REG | `.agents/skills/regression-guard/` | Verificar paridade com monolito |
| AG-QUA | `.agents/skills/code-quality/` | Revisar boas práticas |
| AG-UNI | `.agents/skills/unit-tester/` | Criar/executar testes unitários |
| AG-INT | `.agents/skills/integration-tester/` | Criar/executar testes integração |

## Workflows Disponíveis

| Comando | Workflow | Descrição |
|---------|----------|-----------|
| `/executar-tarefa` | Principal | Pipeline completo de extração |
| `/extrair-modulo` | Extração | Extrair módulo do monolito |
| `/validar-documentacao` | Doc Validator | Conformidade com docs |
| `/verificar-regressao` | Regressão | Paridade com monolito |
| `/avaliar-qualidade` | Qualidade | Clean code e segurança |
| `/criar-testes-unitarios` | Unit Tests | Criar e executar testes |
| `/criar-testes-integracao` | Integration | Testes entre módulos |
| `/validar-gate-fase` | Gate | Aprovação para próxima fase |

## Pipeline por Tarefa

```
AG-ORC → AG-EXT → AG-DOC → AG-QUA → AG-UNI → AG-REG → AG-INT
                                                         ↓
                                             Todos aprovam? → ✅ Concluída
                                             Algum bloqueia? → ⚠️ USUÁRIO
```

## Regra de Ouro

> ESCALAR AO USUÁRIO quando:
> 1. Mudança de comportamento vs monolito
> 2. Decisão de arquitetura ambígua
> 3. Falha sem solução
> 4. Risco de perda de dados
> 5. Mudança em dependência externa
> 6. Impacto em segurança

## Regras Globais

1. NUNCA modificar `agileviewai2.3.html` (referência)
2. Módulo extraído = idêntico em funcionalidade ao original
3. Testes passam ANTES de prosseguir
4. Documentação consultada ANTES de extrair
5. Commits atômicos por tarefa
6. Se 3+ testes falham numa fase → pausar e escalar
