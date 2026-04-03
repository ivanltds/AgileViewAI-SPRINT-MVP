# FASE 6: Integração Final e App Principal — Tarefas

> **Risco**: Alto | **Dependências**: TODAS as fases anteriores concluídas | **Agente Principal**: AG-EXT + AG-INT

---

## Pré-requisitos

- [ ] FASES 2, 3, 4 e 5 concluídas e aprovadas
- [ ] Todos os módulos JS e CSS extraídos
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
  - [ ] Função `init()` — fluxo de inicialização (Vault → Dashboard)
  - [ ] Registro de event listeners globais
- [ ] Concluída

### 6.1.2 — Resolver dependências globais
- **Agente**: `AG-EXT`
- **Ação**: Garantir que todas as funções chamadas via `onclick=""` (se ainda restarem) estão no escopo global via `window.X = X`
- **Preferência**: Migrar todos para `addEventListener` no `init()`
- [ ] Concluída

### 6.1.3 — Validar conformidade (AG-DOC)
- **Checklist**:
  - [ ] Fluxo de inicialização conforme `docs/03_tutorial_de_uso.md`
  - [ ] Ordem: Vault → verificar PIN → carregar cache → renderizar dashboard
  - [ ] Navegação entre painéis funciona
  - [ ] Mobile bottom nav funciona
- [ ] Concluída

### 6.1.4 — Revisar qualidade (AG-QUA)
- **Foco**: Sem acoplamento excessivo, imports limpos, init() linear
- [ ] Concluída

---

## Tarefa 6.2: Criar `index.html` (Novo Ponto de Entrada)

**Agentes**: AG-EXT → AG-REG

### 6.2.1 — Criar `index.html`
- **Agente**: `AG-EXT`
- **Ação**: Novo HTML com:
  - [ ] `<link rel="stylesheet" href="src/styles/index.css">`
  - [ ] `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>`
  - [ ] `<script type="module" src="src/app.js"></script>`
  - [ ] Todo o markup HTML do monolito (sem `<style>` e sem `<script>` inline)
  - [ ] IDs e classes INTOCADOS
- [ ] Concluída

### 6.2.2 — Verificar paridade com monolito (AG-REG)
- **Agente**: `AG-REG`
- **Ação**: 
  - [ ] Abrir `agileviewai2.3.html` e `index.html` lado a lado
  - [ ] Mesmo layout, cores, interações
  - [ ] Vault funciona identicamente
  - [ ] Sync funciona identicamente
  - [ ] Dashboard renderiza identicamente
  - [ ] Chat funciona identicamente
  - [ ] Eficiência funciona identicamente  
  - [ ] Qualidade funciona identicamente
  - [ ] Export HTML funciona identicamente
  - [ ] Mobile e tablet idênticos
- [ ] Concluída

---

## Tarefa 6.3: Suite de Testes E2E

**Agentes**: AG-INT → AG-UNI → AG-REG

### 6.3.1 — Teste E2E: Fluxo completo do usuário
- **Arquivo**: `tests/e2e/full-flow.test.js`
- **Fluxo**:
  1. App carrega → Vault exibido
  2. Configurar PIN → App abre
  3. Criar time → Salvar
  4. Ativar time → Dashboard atualiza
  5. Sincronizar → Dados aparecem
  6. Ver insights → Cards renderizados
  7. Abrir chat → Enviar mensagem → Receber resposta
  8. Trocar módulo → Eficiência → Calcular
  9. Trocar módulo → Qualidade → Carregar
  10. Exportar HTML → Download funciona
- [ ] Concluída

### 6.3.2 — Teste E2E: Responsividade
- **Arquivo**: `tests/e2e/responsividade.test.js`
- **Viewports**: 375px, 768px, 1280px
- **Cenários**: Navegação, KPIs, tabelas, chat FAB, modais
- [ ] Concluída

### 6.3.3 — Teste E2E: Regressão completa
- **Agente**: `AG-REG`
- **Ação**: Executar TODOS os testes (BDD + Unit + Integration + E2E)
- **Comando**: `npm run test:ci`
- [ ] Concluída

---

## Tarefa 6.4: Documentação Final

**Agentes**: AG-DOC → AG-QUA

### 6.4.1 — Atualizar `docs/PLANO_MIGRACAO.md`
- **Agente**: `AG-DOC`
- **Ação**: Marcar todas as fases como concluídas, documentar decisões tomadas
- [ ] Concluída

### 6.4.2 — Criar documentação de API dos módulos
- **Agente**: `AG-DOC`
- **Ação**: JSDoc de cada módulo com exemplos de uso
- [ ] Concluída

### 6.4.3 — Atualizar README.md
- **Agente**: `AG-DOC`
- **Ação**: Instruções de como rodar, testar e contribuir com a versão modularizada
- [ ] Concluída

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
