# 🎯 Orquestrador de Migração — AgileViewAI

> Este arquivo é o ponto central de coordenação da migração. Todos os agentes devem consultá-lo para entender o contexto global, a fase atual e suas responsabilidades.

## Referência do Plano

- **Plano completo**: [`docs/PLANO_MIGRACAO.md`](../docs/PLANO_MIGRACAO.md)
- **Cenários BDD**: [`docs/04_cenarios_bdd.md`](../docs/04_cenarios_bdd.md)
- **Funcionalidades**: [`docs/02_funcionalidades.md`](../docs/02_funcionalidades.md)
- **Solução Técnica**: [`docs/06_solucao_tecnica.md`](../docs/06_solucao_tecnica.md)
- **Identidade Visual**: [`docs/00_identidade_visual.md`](../docs/00_identidade_visual.md)
- **Monolito original**: [`agileviewai2.3.html`](../agileviewai2.3.html) (4.937 linhas, ~322 KB)

---

## Agentes Registrados

| ID | Nome | Arquivo | Responsabilidade Principal |
|----|------|---------|---------------------------|
| `AG-ORC` | Orquestrador | `orchestrator.md` | Coordenação global, sequenciamento, decisões |
| `AG-DOC` | Validador de Documentação | `doc-validator.md` | Conformidade com requisitos documentados |
| `AG-REG` | Guardião de Regressão | `regression-guard.md` | Paridade funcional com versão legada |
| `AG-QUA` | Qualidade de Código | `code-quality.md` | Boas práticas, patterns, clean code |
| `AG-UNI` | Testador Unitário | `unit-tester.md` | Criar e executar testes unitários |
| `AG-INT` | Testador de Integração | `integration-tester.md` | Criar e executar testes integrados |
| `AG-EXT` | Extrator de Código | `extractor.md` | Extração de módulos do monolito |

---

## Status Global da Migração

```
FASE 1: Fundação e Testes          ✅ CONCLUÍDA
FASE 2: Módulos Core               ✅ CONCLUÍDA
FASE 3: Módulos de Serviço         ✅ CONCLUÍDA
FASE 4: Componentes UI             ✅ CONCLUÍDA
FASE 5: CSS e Design System        ✅ CONCLUÍDA
FASE 6: Integração e App Principal ✅ CONCLUÍDA

**Fase Atual**: FASE 7: Refino Premium & Profissionalização
**Próxima Ação**: Epic 7.1: Barras de alocação dinâmica no Dashboard

---

## Protocolo de Comunicação Entre Agentes

### Formato de Mensagem

Toda comunicação entre agentes segue este formato:

```
[ORIGEM: AG-XXX] → [DESTINO: AG-YYY]
TIPO: SOLICITAÇÃO | RESPOSTA | ALERTA | BLOQUEIO | APROVAÇÃO
FASE: N
MÓDULO: nome-do-modulo
PRIORIDADE: CRÍTICA | ALTA | MÉDIA | BAIXA
---
CONTEÚDO:
(descrição detalhada)
---
AÇÃO REQUERIDA:
(o que o destinatário deve fazer)
```

### Tipos de Comunicação

| Tipo | Quando usar | Quem responde |
|------|-------------|---------------|
| `SOLICITAÇÃO` | Pedir que outro agente execute sua skill | O agente de destino |
| `RESPOSTA` | Retorno de uma solicitação | O agente que solicitou |
| `ALERTA` | Risco ou problema identificado | Orquestrador decide |
| `BLOQUEIO` | Problema que impede progresso | Orquestrador + USUÁRIO |
| `APROVAÇÃO` | Validação concluída com sucesso | Agente que aguardava |

### Fluxo de Trabalho por Tarefa

```
1. AG-ORC define a tarefa e atribui ao AG-EXT
2. AG-EXT extrai o módulo do monolito
3. AG-EXT → AG-DOC: solicita validação de conformidade
4. AG-DOC valida contra docs/ e responde
5. AG-EXT → AG-QUA: solicita revisão de qualidade
6. AG-QUA avalia boas práticas e responde
7. AG-EXT → AG-UNI: solicita criação de testes unitários
8. AG-UNI cria e executa testes, reporta resultado
9. AG-EXT → AG-REG: solicita verificação de regressão
10. AG-REG compara com monolito original e responde
11. AG-UNI → AG-INT: solicita testes de integração
12. AG-INT valida integração entre módulos extraídos
13. Se todos aprovam → AG-ORC marca tarefa como CONCLUÍDA
14. Se qualquer um bloqueia → AG-ORC escala para USUÁRIO
```

---

## Regra de Ouro: Escalação para o Usuário

> **OBRIGATÓRIO**: Qualquer situação abaixo DEVE ser escalada para o usuário antes de prosseguir.

### Escalar ao Usuário Quando:

1. **Mudança de comportamento**: Qualquer funcionalidade que se comportará diferente na versão modularizada vs monolito original
2. **Decisão de arquitetura ambígua**: Quando há mais de uma forma válida de implementar e não há consenso entre agentes
3. **Falha sem solução**: Bug ou incompatibilidade que nenhum agente consegue resolver
4. **Perda de dados**: Qualquer risco de perda ou corrupção de dados no localStorage
5. **Dependência externa**: Necessidade de instalar nova dependência ou mudar versão de existente
6. **Impacto em segurança**: Qualquer alteração que afete criptografia, tokens ou autenticação

### Formato de Escalação

```
⚠️ ESCALAÇÃO PARA USUÁRIO
==========================
AGENTE: AG-XXX
FASE: N — TAREFA: nome
TIPO: [Mudança de comportamento | Decisão | Falha | Segurança]

CONTEXTO:
(o que está acontecendo)

OPÇÕES:
A) (opção 1 com prós/contras)
B) (opção 2 com prós/contras)

RECOMENDAÇÃO:
(qual opção o agente recomenda e por quê)

RISCO SE NÃO RESOLVIDO:
(o que acontece se prosseguir sem resolver)
```

---

## Regras Globais

1. **Nunca modificar o monolito original** (`agileviewai2.3.html`) — ele é a referência
2. **Cada módulo extraído** deve ser idêntico em funcionalidade ao código original
3. **Testes devem passar** antes de prosseguir para próxima tarefa
4. **Documentação** deve ser consultada ANTES de cada extração
5. **Commits atômicos**: cada tarefa concluída é um commit separado
6. **Rollback**: se 3+ testes falharem numa fase, pausar e escalar

---

## Mapa de Dependências dos Módulos

```
                    ┌─────────┐
                    │  app.js  │
                    └────┬────┘
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────────┐
    │  Vault   │  │  Store   │  │  Navigation  │
    └──────────┘  └─────┬────┘  └──────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ AzureAPI │  │ Insights │  │   Chat   │
    └─────┬────┘  └──────────┘  └──────────┘
          │
    ┌─────┼─────┐
    ▼           ▼
┌────────┐ ┌──────────┐
│Eficiên.│ │Qualidade │
└────────┘ └──────────┘

Legenda:
→ depende de
Vault: sem dependências (puro crypto)
Store: sem dependências (puro localStorage)
AzureAPI: depende de Store
Insights/Chat: dependem de Store + AzureAPI
Eficiência/Qualidade: dependem de Store + AzureAPI + Chart.js
Dashboard: depende de TODOS os acima
```

---

## Checklist de Validação por Fase

### Antes de iniciar qualquer fase:
- [ ] Plano de migração revisitado e atualizado
- [ ] Testes da fase anterior todos passando (`npm test`)
- [ ] Monolito original intacto (diff = 0)
- [ ] Agentes relevantes notificados

### Após concluir cada tarefa:
- [ ] AG-DOC aprovou conformidade
- [ ] AG-QUA aprovou qualidade de código
- [ ] AG-UNI aprovou testes unitários
- [ ] AG-REG aprovou paridade funcional
- [ ] AG-INT aprovou integração (quando aplicável)
- [ ] Nenhum BLOQUEIO pendente
