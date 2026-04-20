# AgileViewAI (v3.0 Modular)

## 🎯 Objetivo

Migração completa da aplicação monolítica `agileviewai2.3.html` (4.937 linhas) para uma arquitetura moderna, **100% modular (ESM)**, com foco em segurança, performance e testabilidade (BDD/Unit/E2E).

## 📋 Status Atual: Fase 6 Concluída ✅

A aplicação foi totalmente reconstruída seguindo os padrões "Premium" de design e engenharia:

- ✅ **Fase 1/2 (Core)**: Vault (Segurança), Store (Estado) e AzureAPI (Integração) isolados.
- ✅ **Fase 3 (Serviços)**: Motores de Insights, Chat (LLM), Eficiência e Qualidade reconstruídos em ESM.
- ✅ **Fase 4 (Componentes UI)**: Camada de visualização consolidada em `src/components/ui/`.
- ✅ **Fase 5 (CSS Moderno)**: Design System modularizado via `/src/styles/` com variáveis CSS e suporte a Dark Mode.
- ✅ **Fase 6 (Integração Final)**: Orquestração via `src/app.js` e ponte de compatibilidade com scripts legados em `src/legacy.js`.

## 🚀 Início Rápido

### Pré-requisitos
- Node.js 18+
- Extensão de navegador ou servidor local para módulos ESM.

### Execução Local
Devido ao uso de Módulos ES (ESM), a aplicação deve ser servida via protocolo HTTP:

```bash
# Iniciar servidor de desenvolvimento
npx serve . -l 8080
```
Acesse: [http://localhost:8080](http://localhost:8080)

### Setup de Desenvolvimento
```bash
# Instalar dependências de teste
npm install

# Executar bateria completa de testes (BDD, Unit, E2E)
npm test
```

## 🧪 Estrutura de Testes

Implementamos uma pirâmide de testes robusta (Passando Verde 🟢):

- **BDD (Behavior Driven Development)**: Validação de fluxos de negócio em `tests/bdd/`.
- **Unitários**: Testes de lógica pura para serviços e core em `tests/unit/`.
- **Integração**: Fluxos entre múltiplos módulos em `tests/integration/`.
- **E2E/Integridade**: Validação de encoding, responsividade e estilização em `tests/e2e/`.

## 📁 Estrutura do Projeto Atualizada

```
├── src/
│   ├── core/           # Módulos fundamentais (Vault, Store, AzureAPI)
│   ├── services/       # Lógica de negócio e IA (Insights, Chat, Qualidade)
│   ├── components/ui/  # Componentes visuais orquestrados
│   ├── styles/         # Design System (CSS Modular)
│   ├── utils/          # Helpers e utilitários
│   ├── app.js          # Ponto de entrada (Bootstrap)
│   ├── globals.js      # Injeção de dependências no contexto window
│   └── legacy.js       # Script legado higienizado e extraído
├── tests/
│   ├── bdd/            # Especificações Cucumber-style
│   ├── unit/           # Testes de unidade
│   ├── integration/    # Testes de fluxo composto
│   └── e2e/            # Testes de integridade visual e técnica
├── docs/               # Documentação técnica e visual
├── old/                # Backup de arquivos do processo de migração
└── index.html          # Ponto de entrada HTML desidratado
```

## 🛠️ Tecnologias Utilizadas

- **Core**: Vanilla JavaScript (ESM), HTML5.
- **Estilo**: CSS3 (Variáveis, Flexbox, Grid, Glassmorphism).
- **Segurança**: AES-256-GCM, PBKDF2 para proteção de tokens.
- **Testes**: Jest, Puppeteer, JSDOM.
- **AI**: Integração com OpenAI (GPT-4o), Anthropic (Claude 3.5), Gemini 1.5 Pro.

---

**Status**: ✅ Concluído (Pronto para Produção)  
**Versão**: v3.0 Modular  
**Qualidade**: 175+ Testes passando (`Exit code: 0`)