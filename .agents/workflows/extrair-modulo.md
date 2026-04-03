---
description: Extrai um módulo específico do monolito agileviewai2.3.html para um arquivo JS independente
---

# Workflow: Extrair Módulo do Monolito

## Pré-condições

1. Identifique o módulo a extrair a partir do plano em `plano-de-migracao/fase-*.md`
2. Leia `agents/extractor.md` para as regras completas de extração

## Passo 1: Localizar Código

// turbo
3. Use `grep_search` no arquivo `agileviewai2.3.html` para encontrar as funções do módulo
4. Use `view_file` para ler o bloco completo de código

## Passo 2: Criar Módulo

5. Crie o arquivo destino em `src/<camada>/<modulo>.js` com:
   - JSDoc header informando origem (linhas do monolito)
   - `import` para dependências de outros módulos
   - `export` em todas as funções/objetos públicos
   - Código copiado do monolito SEM ALTERAÇÃO DE LÓGICA

**REGRAS**:
- ✅ Reorganizar, adicionar export/import, formatar, adicionar JSDoc
- 🚫 NÃO alterar lógica, condições, cálculos, chaves localStorage
- 🚫 NÃO adicionar/remover parâmetros ou mudar tratamento de erros

## Passo 3: Validar Contra Documentação

6. Leia o doc BDD relevante em `docs/04_cenarios_bdd.md` — busque a Feature correspondente
7. Leia `docs/02_funcionalidades.md` para confirmar que todas as funções estão presentes
8. Se alguma função está faltando no módulo extraído → adicione-a

## Passo 4: Revisar Qualidade

9. Avalie o código contra as regras de `agents/code-quality.md`:
   - Nomes descritivos, SRP, máximo 3 params
   - const por padrão, async/await com try/catch
   - Segurança: PAT nunca logado, JSON.parse com try/catch

## Passo 5: Comparar com Monolito (Regressão)

10. Releia o bloco original no monolito com `view_file`
11. Compare função por função: mesma lógica, mesmos cálculos, mesmas condições
12. Se encontrar divergência → corrija no módulo (o monolito é a verdade)
13. Se a divergência é intencional (melhoria) → PARE e pergunte ao USUÁRIO

## Passo 6: Resultado

14. Reporte o resultado:
    - Arquivo criado e caminho
    - Funções extraídas (lista)
    - Divergências encontradas (se houver)
    - Questões para o USUÁRIO (se houver)
