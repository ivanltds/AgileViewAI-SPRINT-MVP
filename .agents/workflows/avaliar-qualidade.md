---
description: Avalia boas práticas de programação num módulo extraído (clean code, segurança, patterns JS)
---

# Workflow: Avaliar Qualidade de Código

## Pré-condições

1. O módulo já existe em `src/<camada>/<modulo>.js`
2. Leia `agents/code-quality.md` para os checklists completos

## Passo 1: Ler o Código

// turbo
3. Leia o módulo completo com `view_file`

## Passo 2: Clean Code

4. Avalie contra o checklist:
   - [ ] Nomes descritivos em camelCase (funções) e UPPER_SNAKE_CASE (constantes)
   - [ ] Cada função faz UMA coisa (SRP), máximo ~30 linhas
   - [ ] Máximo 3 parâmetros por função
   - [ ] Sem código duplicado (DRY)
   - [ ] Máximo 3 níveis de indentação
   - [ ] Early returns para evitar else
   - [ ] Sem magic numbers (constantes nomeadas)
   - [ ] JSDoc em todas as funções exportadas

## Passo 3: Patterns JavaScript

5. Avalie:
   - [ ] Usa import/export (ESM)
   - [ ] Imports agrupados no topo
   - [ ] Sem circular dependencies
   - [ ] async/await (não .then())
   - [ ] Todo await tem try/catch
   - [ ] const por padrão, let quando necessário, NUNCA var
   - [ ] Sem catch vazio

## Passo 4: Segurança (se módulo core)

6. Avalie (especialmente Vault, Store, AzureAPI):
   - [ ] Chave/PIN nunca em localStorage (apenas memória)
   - [ ] PAT nunca logado em console
   - [ ] PAT nunca em mensagens de erro
   - [ ] JSON.parse com try/catch
   - [ ] Sem eval() ou innerHTML com dados não confiáveis
   - [ ] Tokens cifrados no localStorage

## Passo 5: Resultado

7. Reporte com níveis de severidade:
   - 🔴 CRÍTICO: bloqueia progresso (segurança, bug funcional)
   - 🟠 ALTO: exige correção antes de merge
   - 🟡 MÉDIO: sugestão de melhoria
   - 🟢 BAIXO: estilo/formatação

> **Nota**: Código mais verboso/legível que o monolito é ACEITÁVEL e até desejável. O monolito usa abreviações e código compactado que devem ser expandidos na modularização.
