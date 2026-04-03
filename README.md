# AgileViewAI-SPRINT-MVP

## 🎯 Objetivo

Modularização do código monolítico `agileviewai2.3.html` (4.937 linhas) em arquitetura moderna com testes BDD.

## 📋 Status Atual

- ✅ **Análise completada**: Estrutura do monolito mapeada
- ✅ **Testes BDD criados**: Vault, Times, Sync scenarios
- ✅ **Ambiente configurado**: Jest + jsdom + BDD framework
- 🔄 **Em andamento**: FASE 2 - Módulos Core

## 🚀 Início Rápido

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Setup
```bash
# Instalar dependências
npm install

# Executar testes BDD
npm test

# Testes específicos
npm run test:vault
npm run test:times
npm run test:sync
```

## 📁 Estrutura do Projeto

```
├── docs/
│   ├── PLANO_MIGRACAO.md    # Plano detalhado de migração
│   └── 04_cenarios_bdd.md   # Cenários BDD completos
├── tests/
│   ├── bdd/                 # Testes BDD por feature
│   │   ├── vault.feature.test.js
│   │   ├── times.feature.test.js
│   │   └── sync.feature.test.js
│   └── setup.js            # Configuração ambiente de testes
├── agileviewai2.3.html     # Aplicação monolítica (legado)
└── package.json            # Configuração testes e dependências
```

## 🧪 Testes BDD

Baseado em `docs/04_cenarios_bdd.md`, implementamos cenários para:

### ✅ Vault Security
- Configuração inicial com PIN
- Validação de autenticação
- Modo sessão vs persistência
- Troca de PIN com recifragem

### ✅ Teams Management  
- Cadastro de organizações e times
- Ativação e切换 de times
- Reutilização de PATs

### ✅ Azure DevOps Sync
- Sincronização de sprints
- Tratamento de erros (401, 404)
- Identificação de sprint ativa
- Codificação de team names

## 📋 Plano de Migração

Veja `docs/PLANO_MIGRACAO.md` para o plano completo:

### Fases
1. ✅ **Fundação**: Testes e setup
2. 🔄 **Core**: Vault → Store → AzureAPI  
3. ⏳ **Serviços**: Insights → Chat → Eficiência
4. ⏳ **UI**: Componentes → Dashboard
5. ⏳ **Integração**: App modular final

### Mitigação de Riscos
- Testes BDD completos antes de cada fase
- Rollback imediato disponível
- Deploy incremental por módulo

## 🎯 Próximos Passos

### Imediato
1. Executar testes existentes
2. Validar cobertura BDD
3. Iniciar FASE 2: Módulos Core

### Curto Prazo  
1. Extrair módulo Vault para `src/core/vault.js`
2. Implementar testes unitários
3. Validar integração

## 📊 Métricas

- **Código atual**: 4.937 linhas monolíticas
- **Testes criados**: 19 cenários BDD
- **Módulos identificados**: 10 principais
- **Cobertura alvo**: 85%+

## 🆘 Suporte

- **Documentação**: `docs/PLANO_MIGRACAO.md`
- **Testes**: `tests/bdd/`
- **Issues**: Reportar no repositório

---

**Status**: 🔄 Migração em andamento  
**Versão**: v2.3 → v3.0 modular