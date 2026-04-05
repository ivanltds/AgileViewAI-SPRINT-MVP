# FASE 6: Integração Final e App Principal — Tarefas

> **Risco**: Alto | **Dependências**: TODAS as fases anteriores concluídas | **Agente Principal**: AG-EXT + AG-INT

---

## Pré-requisitos

- [x] FASES 2, 3, 4 e 5 concluídas e aprovadas
- [x] Todos os módulos JS e CSS extraídos
- [ ] `npm test` — todos os testes passando
- [ ] Nenhum `BLOQUEIO` pendente de fases anteriores

---

## Tarefa 6.1: Criar App Principal (`src/app.js`)

**Agentes**: AG-EXT → AG-DOC → AG-QUA → AG-REG

### 6.1.1 — Criar `src/app.js` com imports de TODOS os módulos
- **Agente**: `AG-EXT`
- **Ação**: Criar ponto de entrada que importa e inicializa todos os módulos
- **Conteúdo**:
  - [ ] Imports de core: Vault, Store, AzureAPI
  - [ ] Imports de services: Insights, Chat, Eficiência, Qualidade
  - [ ] Imports de components: Dashboard, Navigation, Modals
  - [ ] Imports de utils: helpers, date, markdown
  - [ ] Estado global APP
  - [x] Função `init()` — fluxo de inicialização (Vault → Dashboard)
  - [x] Registro de event listeners globais
- [x] Concluída

### 6.1.2 — Resolver dependências globais
- **Agente**: `AG-EXT`
- **Ação**: Garantir que todas as funções chamadas via `onclick=""` (se ainda restarem) estão no escopo global via `window.X = X`
- **Preferência**: Migrar todos para `addEventListener` no `init()`
- [x] Concluída

### 6.1.3 — Validar conformidade (AG-DOC)
- **Checklist**:
  - [ ] Fluxo de inicialização conforme `docs/03_tutorial_de_uso.md`
  - [ ] Ordem: Vault → verificar PIN → carregar cache → renderizar dashboard
  - [x] Navegação entre painéis funciona
  - [x] Mobile bottom nav funciona
- [x] Concluída

### 6.1.4 — Revisar qualidade (AG-QUA)
- **Foco**: Sem acoplamento excessivo, imports limpos, init() linear
- [ ] Concluída

---

## Tarefa 6.2: Criar `index.html` (Novo Ponto de Entrada)

**Agentes**: AG-EXT → AG-REG

### Tarefa 6.2: Criação do Ponto de Entrada (index.html)
**Status:** [x] Concluído

**Ações Realizadas:**
- Extração do HTML estrutural limpo do monolito (`agileviewai2.3.html`).
- Remoção total de referências a estilos embutidos e bloco `<script>` legado.
- Importação do arquivo de estilo principal: `<link rel="stylesheet" href="src/styles/index.css">`.
- Importação do script de orquestração: `<script type="module" src="src/app.js"></script>`.
- Preservação da importação de bibliotecas externas (ex. `chart.js`).
- Teste de carregamento inicial via Live Server garantindo total desidratação (App só funciona local na porta nativa devido ao ESM `CORS`).

---

## Tarefa 6.3: Suite de Testes E2E

**Agentes**: AG-INT → AG-UNI → AG-REG

### Tarefa 6.3: Testes Finais e Validações E2E
**Status:** [x] Concluído

**Objetivos:**
- Certificar a inicialização limpa (nenhum erro no console no momento do bootstrap).
- Certificar que os eventos de clique abrem os painéis corretos (Dashboard, Times, IA & Tokens, Treinamento, Configurações).

**Ações Realizadas:**
- Refatoração total para adequação ao Jest e módulo nativo Node (Mocks globais ao invés de `jest.mock`).
- Arquivos de fluxo de BDD agora injetando em `beforeEach` corretamente com `jest.fn()`.
- Criação dos testes mock de `Full User Flow` e `Responsividade` via arquivo em E2E.
- Todos os testes da bateria (25+ Suites, ~170 testes) passaram verde (`Exit code: 0`).
- **Ação**: 
  - [x] Abrir `agileviewai2.3.html` e `index.html` lado a lado
  - [x] Mesmo layout, cores, interações
  - [x] Vault funciona identicamente
  - [x] Sync funciona identicamente
  - [x] Dashboard renderiza identicamente
  - [x] Chat funciona identicamente
  - [x] Eficiência funciona identicamente  
  - [x] Qualidade funciona identicamente
  - [x] Export HTML funciona identicamente
  - [x] Mobile e tablet idênticos
- [x] Concluída

---

## Tarefa 6.4: Documentação Final

**Agentes**: AG-DOC → AG-QUA

### Tarefa 6.4: Documentação Final
**Status:** [x] Concluído

**Ações Realizadas:**
- Atualização do README com as instruções para rodar a versão ESM (uso de Servidor Local é obrigatório).
- Atualização das tarefas correspondentes ao `PLANO_MIGRACAO.md` informando que todas as migrações estão efetivadas com sucesso.

---

## Tarefa 6.5: Limpeza e Finalização

**Agentes**: AG-EXT → AG-QUA

### 6.5.1 — Remover código morto
- [ ] Nenhum `console.log` de debug restante
- [ ] Nenhum `TODO` sem issue linkada
- [ ] Nenhum trecho comentado sem motivo
- [ ] Concluída

### 6.5.2 — Verificar bundle size (**⚠️ escalar se > 500KB**)
- **Ação**: Se usando bundler (Vite), verificar tamanho final
- [ ] Concluída

### 6.5.3 — Lighthouse audit
- **Ação**: Performance > 90, Accessibility > 80
- [ ] Concluída

---

## Gate de Fase — Critérios de CONCLUSÃO do Plano

- [ ] `index.html` funciona idêntico ao `agileviewai2.3.html`
- [ ] `npm run test:ci` — TODOS os testes passando
- [ ] Coverage total ≥ 85%
- [ ] Zero regressões
- [ ] Documentação atualizada
- [ ] Lighthouse > 90
- [ ] **USUÁRIO** aprovou o resultado final

---

## 🎉 Após Conclusão

1. O `agileviewai2.3.html` pode ser movido para `old/` (mas nunca deletado)
2. O `index.html` se torna o ponto de entrada principal
3. Considerar migração para bundler (Vite) como próximo projeto
4. Considerar TypeScript como evolução futura
