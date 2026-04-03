# AgileViewAI — Especificação de Identidade Visual

> **Versão:** 1.0 · **Documento criado:** Abril 2026  
> **Público-alvo deste documento:** Designers, Desenvolvedores Front-end, Product Owners, Stakeholders

---

## 1. Visão e Posicionamento da Marca

### 1.1 Proposta de Valor Visual

O AgileViewAI é uma **plataforma de inteligência de dados ágeis** que consome dados do Azure DevOps e entrega insights de IA para gestores de projeto, Scrum Masters e Product Owners. A identidade visual precisa comunicar, em cada pixel:

- **Confiabilidade:** dados reais, fonte verificável, nada é estimativa sem aviso
- **Autoridade:** ferramenta para líderes que tomam decisões — design maduro, não lúdico
- **Clareza:** informação densa apresentada de forma digestível e hierárquica
- **Tecnologia de ponta:** integração com Azure + IA generativa, sem exibicionismo

### 1.2 Arquétipos de Marca

| Arquétipo | Aplicação no AgileViewAI |
|---|---|
| **O Sábio** | Insights de IA apresentados com linguagem analítica e objetiva |
| **O Guardião** | Vault de segurança, criptografia AES-256-GCM, badges de status |
| **O Governante** | Interface de controle e comando — dashboards sérios, alta densidade |

### 1.3 Público-Alvo e Necessidades Visuais

| Persona | Necessidade principal | Implicação de design |
|---|---|---|
| **Scrum Master** | Diagnóstico rápido de sprint em reuniões diárias | KPIs visíveis acima do fold, sem scroll |
| **Gerente de Projeto** | Visão consolidada de múltiplos times | Cards comparativos, hierarquia clara |
| **Product Owner** | Rastreabilidade de itens de backlog | Tabelas ordenáveis, filtros, drill-down |

---

## 2. Sistema de Cores

### 2.1 Paleta Primária — Azul Institucional

A cor primária é derivada do espectro **azul-marinho corporativo**, associado a contextos enterprise (financeiro, tecnologia, governo). Evita-se o azul saturado/elétrico de aplicações consumer.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NAVY PROFUNDO       SLATE                AZUL AÇÃO
 #061526             #0D2137              #1A6EC8
 ████████████        ████████████         ████████████
 Sidebar / Vault     Topbar / Headers     CTA / Links
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

| Token CSS | Hex | RGB | HSL | Uso |
|---|---|---|---|---|
| `--navy` | `#061526` | `6, 21, 38` | `210°, 73%, 9%` | Sidebar topo, vault background |
| `--slate` | `#0D2137` | `13, 33, 55` | `212°, 61%, 13%` | Topbar, headers, chat header |
| `--blue` | `#1A6EC8` | `26, 110, 200` | `212°, 77%, 44%` | Ações primárias, KPIs, links ativos |
| `--blue-dark` | `#1458A8` | `20, 88, 168` | `212°, 79%, 37%` | Hover de botões azuis |
| `--blue-l` | `#EAF2FB` | `234, 242, 251` | `210°, 71%, 95%` | Bg de estado ativo (claro) |

**Racional:** O azul `#1A6EC8` tem ratio de contraste ≥ 4.5:1 sobre branco (WCAG AA). Não é o azul "padrão" do framework — foi ajustado para ter menos saturação e mais profissão.

### 2.2 Paleta Semântica — Status e Feedback

A cor é **ferramenta semântica**, não decoração. Cada uso de cor carrega significado unívoco:

```
 VERDE            ÂMBAR             VERMELHO         AZUL INFO
 #0D7A55          #B45309           #C0392B           #1A6EC8
 ████████         ████████          ████████          ████████
 ✅ Saudável      ⚠️ Atenção         🚨 Crítico         💡 Info
 Done/OK          Risco/Warning     Bloqueio/Erro     Oportunidade
```

| Token | Hex | Significado operacional |
|---|---|---|
| `--green` | `#0D7A55` | Sprint saudável, alocação OK, item concluído |
| `--amber` | `#B45309` | Capacidade <70%, day off, item em fixing/teste |
| `--red` | `#C0392B` | Sobrecarga >100%, bloqueio, erro de autenticação |
| Azul info | `#1A6EC8` | Insight informativo, oportunidade de melhoria |

> ⚠️ **Regra de ouro:** Nunca usar cor semântica (verde, vermelho, âmbar) por motivos estéticos. Toda aplicação dessas cores deve ter correspondência com um estado de dado real.

### 2.3 Tokens de Tema — Modo Claro (padrão)

```css
:root {
  /* Estrutura */
  --bg:              #F0F4F8;
  --card-bg:         #ffffff;
  --card-border:     #D0DAE8;
  --border:          #D0DAE8;
  --topbar-bg:       #0D2137;
  --sidebar-bg:      linear-gradient(180deg, #061526 0%, #0D2137 100%);

  /* Tipografia */
  --text-primary:    #0D1F35;
  --text-secondary:  #4A5568;
  --gray:            #5A6882;

  /* Componentes */
  --input-bg:        #ffffff;
  --input-border:    #D0DAE8;
  --modal-bg:        #ffffff;
  --modal-overlay:   rgba(6, 21, 38, 0.65);
  --table-hover:     rgba(26, 110, 200, 0.06);
  --table-header-bg: #F8FAFC;
  --btn-bg:          #F0F4F8;
  --btn-color:       #0D1F35;
  --toast-bg:        #0D2137;
}
```

### 2.4 Tokens de Tema — Modo Escuro (`[data-theme="dark"]`)

```css
[data-theme="dark"] {
  /* Estrutura */
  --bg:              #091420;
  --card-bg:         #0F1E30;
  --card-border:     rgba(255, 255, 255, 0.09);
  --border:          rgba(255, 255, 255, 0.09);
  /* topbar e sidebar mantêm-se idênticos — âncora da identidade */

  /* Tipografia */
  --text-primary:    #DDE8F5;
  --text-secondary:  #8AA5C0;
  --gray:            #8AA5C0;

  /* Componentes */
  --input-bg:        #0A1628;
  --input-border:    rgba(255, 255, 255, 0.12);
  --modal-bg:        #0F1E30;
  --modal-overlay:   rgba(2, 8, 16, 0.80);
  --table-hover:     rgba(26, 110, 200, 0.08);
  --table-header-bg: #0A1628;
  --btn-bg:          #0F1E30;
  --btn-color:       #DDE8F5;
  --toast-bg:        #0A1628;
}
```

> **Nota arquitetural:** Topbar e sidebar mantêm o gradiente navy em **ambos os modos**. Isso cria uma âncora visual estável — o usuário sente que está no mesmo produto independente do tema.

### 2.5 Semântica de Cor para Insights de IA

Os cards de insight gerados pela IA seguem uma escala de severidade visual rigorosa:

| Severidade | Fundo (claro) | Fundo (escuro) | Borda | Ícone |
|---|---|---|---|---|
| `critical` | `#fef2f2` | `rgba(192,57,43,.12)` | `--red` | 🚨 |
| `warning` | `#fffbeb` | `rgba(180,83,9,.10)` | `--amber` | ⚠️ |
| `info` | `#EAF2FB` | `rgba(26,110,200,.15)` | `--blue` | 💡 |
| `ok` | `#f0fdf4` | `rgba(13,122,85,.12)` | `--green` | ✅ |

---

## 3. Tipografia

### 3.1 Família Tipográfica

**Inter** (Google Fonts) é a escolha primária.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

**Justificativa:**
- Desenhada especificamente para interfaces digitais em telas de alta densidade
- Legibilidade superior em tamanhos pequenos (10–13px), crítica para dashboards densos
- Neutralidade corporativa — sem personalidade "tech de startup" ou "consumer app"
- Variações de peso bem calibradas de 400 a 800

**Fallback stack:**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### 3.2 Hierarquia de Tamanhos

| Nível | Tamanho | Peso | Uso típico |
|---|---|---|---|
| **Display** | `26px` | `800` | Valor principal de KPI (ex: "47 pontos") |
| **H1 KPI** | `22px` | `700` | KPIs secundários (eficiência, qualidade) |
| **H2 KPI** | `18px` | `700` | KPIs terciários (velocidade, alocação) |
| **Modal title** | `16px` | `700` | Títulos de modais e painéis |
| **Section title** | `14px` | `700` | Cabeçalhos de seções no dashboard |
| **Body / Table** | `13px` | `500–600` | Texto corpo, linhas de tabela, nav items |
| **Label / Badge** | `12px` | `600` | Labels de formulário, status badges, tabs |
| **Metadata** | `11px` | `600` | Hints, tooltips, timestamps |
| **Micro** | `10px` | `600–700` | Labels uppercase, notas técnicas |

### 3.3 Regras Tipográficas

- **Uppercase apenas para:** labels de formulário, badges de status, títulos de colunas de tabela, rótulos de KPI (ex: "TOTAL", "CONCLUÍDOS")
- **Letter-spacing:** `0.5px` em uppercase com `font-size ≤ 12px` (melhora legibilidade)
- **Line-height:** `1.4` para corpo de texto, `1.2` para títulos de KPI (valores maiores)
- **Nunca usar:** `font-style: italic` na interface principal (reservado para citações de IA)

---

## 4. Logotipo e Identidade da Marca

### 4.1 Badge Primário

O identificador da marca é o badge **"AV"** seguido do nome **"AgileViewAI"**.

```
┌─────────────────────────────────┐
│  [AV]  AgileViewAI              │
│        v2.x                     │
└─────────────────────────────────┘
```

**Especificações do Badge "AV":**
- Dimensões: `32×32px` mínimo
- Background: `var(--blue)` → `#1A6EC8`
- Border-radius: `6px`
- Tipografia: `Inter 700`, `13px`, cor `#ffffff`
- Margin-right: `10px` em relação ao texto do nome

**Especificações do nome:**
- `"AgileViewAI"` — fonte Inter 700, 14px, cor `#ffffff` (sobre sidebar escura)
- `"v2.x"` — fonte Inter 500, 11px, cor `rgba(255,255,255,0.55)`

### 4.2 Regras de Uso do Logo

| Contexto | Versão a usar |
|---|---|
| Sidebar desktop | Badge "AV" + nome "AgileViewAI" |
| Sidebar tablet (60px) | Apenas badge "AV" |
| Vault / Tela de entrada | Ícone 🔐 + nome "AgileViewAI" |
| Favicon | Badge "AV" sobre azul |
| E-mails / PDFs exportados | Nome completo + versão |

> ❌ **Não usar:** Emojis como logo principal (ex: 📊). Emojis variam entre sistemas operacionais e comprometem a consistência da marca.

### 4.3 Fundos Permitidos para o Logo

- ✅ Sidebar gradient `#061526` → `#0D2137`
- ✅ Topbar `#0D2137`
- ✅ Vault background `#061526` → `#0A2240`
- ❌ Fundos claros (`#ffffff`, `--bg`) — usar variante com texto escuro

---

## 5. Componentes Visuais — Especificações

### 5.1 KPI Cards

O KPI Card é o elemento mais crítico do sistema — é o primeiro ponto de contato visual ao abrir o dashboard.

```
┌─────────────────────────────────────┐
│▌ TOTAL DE ITENS                  ⓘ │  ← border-left: 3px solid #1A6EC8
│                                     │
│  47                                 │  ← 26px / 800 / text-primary
│  pts de 60 planejados               │  ← 11px / 500 / text-secondary
└─────────────────────────────────────┘
```

**Especificações:**
- `border-left: 3px solid var(--blue)` — padrão enterprise/analytics
- Border-radius: `10px`
- Padding: `16px`
- Background: `var(--card-bg)`
- Shadow (modo escuro): nenhuma — a borda `rgba` cria a separação
- Shadow (modo claro): muito sutil, `0 1px 3px rgba(0,0,0,.06)`
- Variante `.alert`: border-left e borda vermelhas, valor em `var(--red)`, fundo `rgba(192,57,43,.08)`

**Tooltip ⓘ:**
- Posição `fixed` (não `absolute`) para não ser cortado por `overflow:hidden`
- Caret `::after` apontando para o ícone
- Z-index alto, aparece sobre todos os outros elementos

### 5.2 Backlog Table

O design da tabela prioriza **legibilidade de dados densos** e **rastreabilidade**:

- **Cabeçalho:** `var(--table-header-bg)`, `font-size:11px`, `font-weight:700`, uppercase, `letter-spacing:.5px`
- **Linha de dados:** `13px / 500`, hover `var(--table-hover)` (rgba — adapta-se ao tema)
- **Badge de status:** `6px border-radius`, 4px padding, cor semântica (ver seção 5.3)
- **Drill-down:** ícone `▶` que rotaciona 90° ao expandir (0.2s ease)
- **Scrollbar customizado:** `6px`, `border-radius:3px`, cor `#cbd5e1`

### 5.3 Badges de Status de Item

| Classe | Cor de fundo | Cor de texto | Estado |
|---|---|---|---|
| `.s-todo` | `rgba(90,104,130,.12)` | `#5A6882` | To Do / Novo |
| `.s-doing` | `rgba(26,110,200,.12)` | `#1A6EC8` | In Progress |
| `.s-testing` | `rgba(180,83,9,.12)` | `#B45309` | Em teste / Validação |
| `.s-done` | `rgba(13,122,85,.12)` | `#0D7A55` | Done / Closed |
| `.s-blocked` | `rgba(192,57,43,.12)` | `#C0392B` | Bloqueado |
| `.s-fixing` | `rgba(210,100,20,.12)` | `#D26414` | Em fixing |
| `.s-removed` | `rgba(200,80,100,.12)` | `#A0455A` | Removido |
| `.s-design` | `rgba(120,80,200,.12)` | `#7850C8` | Em design / Análise |

> Todos usam `rgba` para fundo — funciona em claro e escuro sem override.

### 5.4 Cards de Insight de IA

```
┌─────────────────────────────────────────────────┐ ← border: severidade
│ ⚠️  Capacidade de sprint em risco              ✕ │ ← título + fechar
│─────────────────────────────────────────────────│
│ Ana Lima está com 127% de alocação. Risco de    │
│ burn-out e atraso no backlog até sexta-feira.   │
│ Considere redistribuir 2 itens de alto esforço. │
│─────────────────────────────────────────────────│
│ Útil?  👍  Não útil  👎                          │ ← feedback de IA
└─────────────────────────────────────────────────┘
```

**Regras:**
- Badge de severidade no título (emoji + nome da severidade)
- Linguagem objetiva, orientada à ação
- Barra de feedback `👍/👎` sempre presente (treina o modelo)
- Botão `✕` no canto superior direito para dispensar o insight

### 5.5 Chat Flutuante (FAB)

O assistente de IA é acessível via botão circular fixo:

- **Dimensão:** `52×52px`, `border-radius:50%`
- **Background:** `var(--blue)` → `#1A6EC8`
- **Sombra:** `0 6px 20px rgba(10,34,64,.38)` — sombra navy, não genérica
- **Posição:** `bottom:24px; right:24px; position:fixed`
- **Badge de notificação:** círculo vermelho `16px` sobre o ícone, `z-index` maior
- **Hover:** `scale(1.08)`, transição `0.15s`

**Painel do chat:**
- Dimensão: `380×600px` desktop, full-screen mobile
- Header: `var(--topbar-bg)` — mesma cor do topbar principal (coerência)
- Sidebar de histórico retrátil (0.2s)

### 5.6 Toast Notifications

```
 ┌──────────────────────────────────┐
 │ ✓  Time sincronizado com sucesso │  ← .ok
 └──────────────────────────────────┘
```

- **Posição:** `bottom:24px; right:24px; position:fixed`
- **Animação:** fade-in + `translateY(10px → 0)` em 0.3s
- **Auto-dismiss:** 3500ms
- **Stacking:** múltiplos toasts com `gap:8px`

| Variante | Borda esquerda | Background |
|---|---|---|
| `.ok` | `#0D6F4A` (verde) | `var(--toast-bg)` |
| `.err` | `var(--red)` | `var(--toast-bg)` |
| `.warn` | `var(--amber)` | `var(--toast-bg)` |
| default | sem borda destaque | `var(--toast-bg)` |

---

## 6. Layout e Estrutura

### 6.1 Grid de Layout Principal

```
┌─────────────┬────────────────────────────────────────────┐
│  SIDEBAR    │  TOPBAR (sticky, 52px)                     │
│  200px      ├────────────────────────────────────────────┤
│             │  MODULE TABS (sticky)                      │
│  nav items  ├────────────────────────────────────────────┤
│             │  CONTENT AREA                              │
│             │  (scrollable, padding: 20px)               │
│─────────────│                                            │
│  v2.x  [🌙] │                                            │
└─────────────┴────────────────────────────────────────────┘
```

### 6.2 Breakpoints de Responsividade

| Breakpoint | Comportamento |
|---|---|
| `> 900px` | Sidebar 200px, layout completo |
| `≤ 900px` | Sidebar 60px (ícones), grid de KPIs 3 colunas |
| `≤ 768px` | Sidebar removida → bottom navigation; KPIs 2 colunas |
| `≤ 480px` | KPIs 1 coluna, tabelas com colunas ocultas |

### 6.3 Espaçamento (Sistema 4px)

Todos os espaçamentos seguem o sistema de múltiplos de 4px:

| Token | Valor | Uso típico |
|---|---|---|
| `--space-xs` | `4px` | Gap entre ícone e texto |
| `--space-sm` | `8px` | Padding interno de badges |
| `--space-md` | `12px` | Padding de botões |
| `--space-lg` | `16px` | Padding de cards |
| `--space-xl` | `20px` | Padding de seções |
| `--space-2xl` | `24px` | Margem entre cards |
| `--space-3xl` | `32px` | Margem entre seções |

---

## 7. Animações e Micro-interações

### 7.1 Princípios de Animação

- **Propósito:** toda animação comunica um estado (carregando, ativo, expansível)
- **Duração:** 100–300ms. Nunca mais de 500ms para transições de UI
- **Easing:** `ease` para transições de estado, `ease-out` para entradas, `linear` para rotações contínuas
- **`prefers-reduced-motion`:** respeitar a preferência do sistema — animações devem ser desabilitáveis

### 7.2 Catálogo de Animações

| Elemento | Animação | Duração | Easing |
|---|---|---|---|
| Sprint ativa dot | Pulse (opacidade 1→0.4→1) | `2s infinite` | `ease` |
| Spinner de loading | Rotação 360° | `0.8s infinite` | `linear` |
| Toast notification | Fade + `translateY(10px→0)` | `0.3s` | `ease-out` |
| Chat panel | `opacity 0→1` + `translateY(12px→0)` + `scale(.97→1)` | `0.18s` | `ease` |
| FAB button hover | `scale(1.08)` | `0.15s` | `ease` |
| Nav items | `background + color` | `0.15s` | `ease` |
| Progress bar fill | `width` animado | `0.5s` | `ease` |
| Expand icon | `rotate(90deg)` | `0.2s` | `ease` |
| Tema claro/escuro | `color + background + border-color` | `0.2s` | `ease` |
| Botões | `background` ao hover | `0.15s` | `ease` |
| Sidebar chat | `width 190px→0` + `opacity 1→0` | `0.2s` | `ease` |

---

## 8. Vault — Tela de Entrada

A Vault é a **primeira impressão do produto**. Deve transmitir segurança e seriedade antes mesmo do usuário digitar qualquer dado.

```
┌─────────────────────────────────────────────────────────────┐  ← bg navy gradient
│                                                             │
│              🔐  AgileViewAI                                │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  [ Vault (PIN) ]    [ Sessão ]                        │  │
│  │─────────────────────────────────────────────────────  │  │
│  │  PIN de segurança                                     │  │
│  │  ┌──────────────────────────────────────────────┐     │  │
│  │  │  · · · · · ·                                 │     │  │
│  │  └──────────────────────────────────────────────┘     │  │
│  │                                                       │  │
│  │  [ Entrar no Vault ]                                  │  │
│  │                                                       │  │
│  │  ⓘ 4 a 8 dígitos · tokens cifrados com AES-256-GCM  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Especificações:**
- **Background:** `linear-gradient(160deg, #061526 0%, #0A2240 100%)`
- **Card:** `background: var(--card-bg)`, `box-shadow: 0 25px 60px rgba(0,0,0,.5)`
- **Input PIN:** `letter-spacing: 4px`, tipo `password`
- **Nota técnica:** `font-size: 11px`, `color: var(--text-secondary)` — presente mas discreta
- **Área de erro:** `min-height: 18px` sempre presente — sem layout shift ao mostrar erro

---

## 9. Acessibilidade

### 9.1 Contraste e Legibilidade

| Combinação | Ratio | WCAG |
|---|---|---|
| Azul `#1A6EC8` sobre branco | ≥ 4.5:1 | ✅ AA |
| Texto `#0D1F35` sobre `#F0F4F8` | ≥ 7:1 | ✅ AAA |
| Texto `#DDE8F5` sobre `#0F1E30` | ≥ 7:1 | ✅ AAA |
| Texto `#DDE8F5` sobre `#0D2137` | ≥ 7:1 | ✅ AAA |

### 9.2 Interatividade

- Touch targets: `min-height: 40px` para botões principales em mobile
- Focus ring: `box-shadow: 0 0 0 3px rgba(26,110,200,.25)` em todos os elementos focáveis
- `-webkit-tap-highlight-color: transparent` — elimina flash azul no iOS
- `safe-area-inset-bottom` na bottom navigation — suporte a iPhones com notch

### 9.3 Semântica HTML

```html
<nav>          <!-- sidebar e bottom navigation -->
<main>         <!-- conteúdo principal -->
<section>      <!-- seções do dashboard -->
<button>       <!-- todos os controles interativos -->
<table>        <!-- dados tabulares -->
<th scope="col"> <!-- cabeçalhos de coluna -->
```

### 9.4 ARIA

- `aria-label` em FAB, bottom navigation, botão de tema
- `role="status"` em toasts
- `aria-expanded` em elementos de drill-down
- `aria-live="polite"` em área de insights (IA)

---

## 10. Estados do Sistema

Cada estado do sistema deve ter uma representação visual consistente:

| Estado | Representação visual |
|---|---|
| **Sem dados** | Bloco âmbar com ícone + instrução clara de ação |
| **Sincronizando** | Toast informativo + botão desabilitado (cursor:not-allowed) |
| **IA analisando** | Spinner + texto "Consultando [provider]..." |
| **Timeout** | Texto inline com botão de retry visível |
| **Erro de auth** | Toast `.err` com detalhes HTTP |
| **Dados desatualizados** | Timestamp "Sincronizado há X min" no topbar |

---

## 11. Diretrizes para Extensão da Interface

### 11.1 ao adicionar um novo KPI Card

1. Definir qual métrica representa e qual `border-left` color (sempre semântica)
2. Definir o tooltip de explicação (campo ⓘ obrigatório)
3. Usar os mesmos tokens de tipografia (26px/800 para valor principal)
4. Nunca adicionar ícone decorativo no card — o `border-left` já É a âncora visual

### 11.2 ao adicionar uma nova seção

1. Usar `<section>` semântico com `aria-label`
2. Padding interno: `var(--space-xl)` (20px)
3. Título da seção: 14px/700, cor `var(--text-secondary)`, uppercase + letter-spacing
4. Border-bottom sutil em `var(--border)` para separar seções

### 11.3 ao adicionar um novo tipo de insight

1. Escolher severidade existente — não criar novo nível sem revisão
2. Linguagem: orientada à ação ("Considere...", "Redistribua...", "Atenção a...")
3. Incluir a barra de feedback — todo insight precisa de possibilidade de avaliação
4. Limite de 3–4 linhas de texto no card — insights longos devem ter modal de detalhe

### 11.4 ao criar um novo modal

1. Overlay: `var(--modal-overlay)`
2. Mobile: bottom sheet com `border-radius: 16px 16px 0 0`
3. Desktop: centralizado, `max-width: 500px`, `max-height: 90vh`
4. Header com borda inferior `var(--border)`, botão `✕` no canto direito
5. Usar `var(--modal-bg)` — nunca hardcode de cor

---

## 12. Anti-padrões — O que Nunca Fazer

| Anti-padrão | Por quê é problemático |
|---|---|
| Cor hardcoded (ex: `color: #333`) | Quebra o dark mode e impossibilita manutenção do tema |
| Animação > 500ms em UI | Percebida como lentidão, não como refinamento |
| Cores vibrantes sem semântica | Polui o sistema de significado de cor |
| Ícone emoji no lugar de badge/logo | Inconsistência entre sistemas operacionais |
| Remover o tooltip ⓘ de KPI | Reduz confiança do usuário nos dados |
| Texto sem hierarquia de peso | Dashboard perde escaneabilidade |
| Shadow excessiva no dark mode | Cria sensação de "plastificado" — usar bordas `rgba` |
| Mais de 4 cores primárias no mesmo card | Ruído visual, perde hierarquia |

---

## 13. Referências e Inspirações

A identidade visual do AgileViewAI é informada pelas seguintes referências de design enterprise:

- **Azure DevOps (Microsoft):** densidade de informação, uso de azul institucional
- **GitHub (modo escuro):** hierarquia tipográfica, bordas sutis em dark mode
- **Linear:** velocidade, KPIs limpos, sans-serif agressiva
- **Metabase / Grafana:** dashboards de alta densidade, semântica de cor em gráficos
- **Figma (product dashboard):** micro-interações, consistência de espaçamento

---

*Documento mantido pela equipe de produto AgileViewAI. Qualquer extensão da identidade visual deve ser revisada neste documento e, se aprovada, incluída na próxima versão.*
