---
description: Verifica que o módulo extraído mantém paridade funcional com o código original no monolito
---

# Workflow: Verificar Regressão

## Pré-condições

1. O módulo já existe em `src/<camada>/<modulo>.js`
2. Leia `agents/regression-guard.md` para as regras completas e mapa de handlers

## Passo 1: Localizar Código Original

// turbo
3. Use `grep_search` em `agileviewai2.3.html` para encontrar CADA função que foi extraída
4. Use `view_file` para ler o bloco original no monolito

## Passo 2: Comparação Função por Função

5. Para CADA função exportada no módulo:
   - Compare a assinatura (params, return)
   - Compare as condições (if/else, ternários)
   - Compare os cálculos e transformações de dados
   - Compare o tratamento de erros (catch)
   - Compare acessos a `APP.*` e `localStorage`
   
   Se encontrar QUALQUER divergência de lógica:
   - Se foi um erro de extração → corrija no módulo
   - Se foi uma melhoria intencional → PARE e pergunte ao USUÁRIO

## Passo 3: Verificar Handlers (se módulo UI)

// turbo
6. Use `grep_search` para encontrar TODOS os `onclick=`, `onchange=`, `oninput=`, `onkeydown=` em `agileviewai2.3.html` que referenciam funções do módulo
7. Verifique que cada handler tem correspondência no código modularizado

## Passo 4: Verificar localStorage

// turbo
8. Use `grep_search` para encontrar TODAS as chaves `avai_*` usadas nas funções originais
9. Verifique que o módulo usa as MESMAS chaves com o MESMO formato

## Passo 5: Resultado

10. Reporte:
    - ✅ Paridade confirmada (sem regressão)
    - ⚠️ Divergências encontradas (listar cada uma com linhas do monolito)
    - 🔴 Regressão confirmada → corrigir ou escalar ao USUÁRIO
    - Handlers verificados: X/Y conectados
    - Chaves localStorage: todas preservadas
