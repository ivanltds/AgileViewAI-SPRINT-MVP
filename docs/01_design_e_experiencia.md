# AgileViewAI — Design e Experiência do Usuário

> **Versão:** 2.3 · **Última atualização:** Abril 2026

---

## 1. Visão de Design

O AgileViewAI é projetado para **Agile Masters e Tech Leaders** que precisam de diagnóstico de sprint rápido, preciso e sem fricção. O produto existe no contexto de ferramentas corporativas sérias — a identidade visual deve reforçar **confiabilidade dos dados**, transmitir **segurança** e nunca gerar dúvida sobre a credibilidade das informações apresentadas.

| Princípio | Descrição |
|---|---|
| **Institucional, não genérico** | Paleta de azuis profundos derivada de contextos enterprise/fintech. Sem cores vibrantes sem propósito semântico. |
| **Dado acima do decor** | Informação densa sem poluição visual. Cor é usada como semântica, não estética. |
| **Ação a um toque** | Todo elemento importante é acessível sem menus profundos ou nested navigation. |
| **Confiança pelo detalhe** | Tooltips em cada KPI, links diretos ao Azure DevOps, dados com fonte explícita, tipografia legível. |

---

## 2. Sistema Visual

### 2.1 Paleta de Cores — Modo Claro (padrão)

| Token CSS | Valor | Uso |
|---|---|---|
| `--blue` | `#1A6EC8` | Ações primárias, links, estado ativo, gauge de KPI |
| `--blue-dark` | `#1458A8` | Hover de botões azuis |
| `--blue-l` | `#EAF2FB` | Fundo de elementos ativos/selecionados |
| `--navy` | `#061526` | Topo da sidebar, fundo do vault overlay |
| `--slate` | `#0D2137` | Topbar, base da sidebar, header do chat |
| `--gray` | `#5A6882` | Labels, textos secundários, placeholders |
| `--border` | `#D0DAE8` | Bordas de cards e tabelas |
| `--bg` | `#F0F4F8` | Background geral da aplicação |
| `--red` | `#C0392B` | Erros, sobrecarga, bloqueios |
| `--amber` | `#B45309` | Avisos, day offs, fixing |
| `--green` | `#0D7A55` | Sucesso, alocação saudável, sprints ativas |
| `--text-primary` | `#0D1F35` | Texto principal |
| `--text-secondary` | `#4A5568` | Texto secundário, hints |
| `--card-bg` | `#ffffff` | Fundo de cards, modals, painéis |
| `--card-border` | `#D0DAE8` | Borda de cards |
| `--topbar-bg` | `#0D2137` | Fundo do topbar |
| `--sidebar-bg` | `linear-gradient(180deg, #061526 0%, #0D2137 100%)` | Sidebar |

### 2.2 Paleta de Cores — Modo Escuro (`[data-theme="dark"]`)

| Token CSS | Valor | Uso |
|---|---|---|
| `--bg` | `#091420` | Background geral |
| `--card-bg` | `#0F1E30` | Cards, modais, painéis |
| `--card-border` | `rgba(255,255,255,.09)` | Bordas de cards |
| `--border` | `rgba(255,255,255,.09)` | Bordas gerais |
| `--text-primary` | `#DDE8F5` | Texto principal |
| `--text-secondary` | `#8AA5C0` | Texto secundário |
| `--gray` | `#8AA5C0` | Labels |
| `--panel-header-bg` | `#0F1E30` | Fundo de panel-headers |
| `--input-bg` | `#0A1628` | Fundo de inputs |
| `--input-border` | `rgba(255,255,255,.12)` | Borda de inputs |
| `--modal-bg` | `#0F1E30` | Background de modais |
| `--table-hover` | `rgba(26,110,200,.08)` | Hover em linhas de tabela |
| `--table-header-bg` | `#0A1628` | Fundo do cabeçalho de tabela |
| `--btn-bg` | `#0F1E30` | Fundo padrão de botões |
| `--btn-color` | `#DDE8F5` | Texto de botões |
| `--toast-bg` | `#0A1628` | Fundo de toasts |

> **Nota:** a sidebar e topbar mantêm o gradiente marinho em ambos os modos, garantindo consistência da identidade da marca.

### 2.3 Sistema de Temas (Claro / Escuro)

A alternância de tema é implementada via **atributo `data-theme` no `<html>`**, com todas as variáveis CSS redefinidas no seletor `[data-theme="dark"]`. Isso garante troca instantânea sem reload.

**Fluxo:**
1. Na carga da página, um script inline (antes do CSS principal) lê `localStorage.getItem('avai_theme')`
2. Se não houver preferência salva, respeita `prefers-color-scheme` do sistema operacional
3. Ao clicar no botão de alternância, grava a escolha em `localStorage('avai_theme')` e atualiza o atributo

**Posicionamento do botão de alternância:**
- **Desktop / Tablet (>768px):** ícone 🌙/☀️ no rodapé da sidebar (`.sidebar-bottom`)
- **Mobile (≤768px):** ícone aparece no topbar do dashboard (via `window.matchMedia`)

### 2.4 Semântica de Cor (Insights e Status)

| Severidade | Modo Claro | Modo Escuro | Emoji | Significado |
|---|---|---|---|---|
| `critical` | Fundo `#fef2f2`, borda vermelha | Fundo `rgba(192,57,43,.12)` | 🚨 | Sobrecarga >100%, ação urgente |
| `warning` | Fundo `#fffbeb`, borda âmbar | Fundo `rgba(180,83,9,.10)` | ⚠️ | Ociosidade <70%, bloqueio, risco |
| `info` | Fundo `#EAF2FB`, borda azul | Fundo `rgba(26,110,200,.15)` | 💡 | Oportunidade, observação |
| `ok` | Fundo `#f0fdf4`, borda verde | Fundo `rgba(13,122,85,.12)` | ✅ | Conformidade, situação saudável |

### 2.5 Cores de Status do Backlog

| Classe CSS | Cor | Estado |
|---|---|---|
| `.s-todo` | Cinza neutro | To Do / Novo |
| `.s-doing` | Azul institucional (bold) | In Progress / Ativo |
| `.s-testing` | Âmbar | Em teste, validação, aguardando |
| `.s-done` | Verde estrutural | Done, Closed, Resolved |
| `.s-blocked` | Vermelho sóbrio (bold) | Bloqueado |
| `.s-fixing` | Laranja | Em fixing/correção |
| `.s-removed` | Rosado | Removido, cancelado |
| `.s-design` | Violeta | Em análise, design |

### 2.6 Tipografia

- **Fonte principal:** **Inter** (Google Fonts) — `wght@400;500;600;700;800`
  - Carregada via `<link>` com `preconnect` para mínima latência
  - Fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
  - Escolhida pela legibilidade em dashboards densos e neutralidade corporativa
- **Hierarquia de tamanhos:**
  - `26px / font-weight:800` — valores de KPI principais
  - `22px / font-weight:700` — valores de KPI de eficiência/qualidade
  - `18px / font-weight:700` — valores secundários, velocidade
  - `16px / font-weight:700` — títulos de modal
  - `15px / font-weight:700` — botão de Vault
  - `13px / font-weight:500-600` — corpo de texto, linhas de tabela, nav items
  - `12px / font-weight:600` — labels de formulário, badges, tabs
  - `11px e 10px / font-weight:600-700` — metadata, hints, labels uppercase

---

## 3. Layout e Estrutura de Navegação

### 3.1 Desktop (>900px)

```
┌──────────────────────────────────────────────────────┐
│ SIDEBAR (200px)        │  MAIN CONTENT (flex: 1)     │
│ ───────────────────── │  ─────────────────────────  │
│ [AV] AgileViewAI v2.3  │  TOPBAR sticky (#0D2137)    │
│                        │  ─────────────────────────  │
│ [nav items]            │  MODULE TABS (sticky)        │
│   • border-left azul   │  ─────────────────────────  │
│     no item ativo      │  CONTENT AREA (scrollable)   │
│                        │                             │
│ ─────────────────────  │                             │
│ [v2.3]       [🌙/☀️]   │                             │
└──────────────────────────────────────────────────────┘
```

- Logo substituído por badge **"AV"** em `background: var(--blue)` — mais limpo e corporativo
- Rodapé da sidebar (`.sidebar-bottom`) exibe versão e botão de tema

### 3.2 Tablet (≤900px)

- Sidebar reduz para **60px** com apenas ícones centralizados
- Tooltip `data-label` aparece ao hover para manter discoverability
- O atributo `overflow:visible` é mantido para os tooltips não serem cortados
- `.sb-version` e `.sidebar-bottom` ocultam o texto de versão (mantém apenas o ícone do tema)
- KPIs da sprint: grade 3 colunas
- Layout do dashboard: 1 coluna (backlog + progress empilhados)
- Gráficos de Eficiência e Qualidade: 1 coluna

### 3.3 Mobile (≤768px)

- Sidebar removida; substituída por **bottom navigation nativa** (56px, fundo sidebar-bg)
- Botão de alternância de tema aparece no **topbar** (via `display:flex` dinâmico)
- Touch targets mínimos: 40px para botões, 36px para botão-sm
- Bottom navigation com `safe-area-inset-bottom` (iPhones com notch)
- Modais: **bottom sheets** (`border-radius:16px 16px 0 0; max-height:92vh`)
- KPIs: grade 2 colunas
- Tabelas: coluna `rem-col` oculta
- Chat flutuante sobe para `bottom: calc(56px + 12px)`

### 3.4 Painel do Dashboard (tab Sprint)

```
TOPBAR ─────────────────────────────────────────────────
[Nome do Projeto] [Org · Time] [Sprint ativa ●] [Dias pill]
                                        [🌙] [time▾] [sync] [HTML]

KPI GRID (6 colunas — border-left azul por card)
 Total | Concluídos | Em progresso | Bloqueados | Fixing | Aloc.

db-body ─────────────────────────────────────────────────
┌─────────────────────────────┬──────────────────────────┐
│ db-left (backlog)           │ db-right (progress, 320px│
│ filter-tabs                 │ sticky, scroll próprio)   │
│ bl-table (expandível)       │ barras de progresso       │
│                             │ vel. cards                │
│                             │ atividades                │
│                             │ tasks summary             │
│                             │ day offs                  │
└─────────────────────────────┴──────────────────────────┘

INSIGHTS SECTION ──────────────────────────────────────
 ins-grid (2 colunas → 1 no mobile/tablet)

CHAT SECTION (display:none por padrão) ────────────────

MEMBERS SECTION ───────────────────────────────────────
```

---

## 4. Micro-interações e Animações

| Elemento | Animação | Duração |
|---|---|---|
| **Sprint ativa dot** | Pulse (opacidade 1→0.4→1) | 2s infinite |
| **Spinner de loading** | Rotação 360° | 0.8s infinite |
| **Toast notifications** | Fade + translateY(10px→0) | 0.3s |
| **Chat panel (fc-panel)** | `opacity 0→1 + translateY(12px→0) + scale(.97→1)` | 0.18s ease |
| **Botão FAB (chat)** | `scale(1→1.08)` ao hover | 0.15s |
| **Nav items** | `background + color` suave ao hover | 0.15s |
| **Barra de progresso (pbar-fill)** | `width` com ease | 0.5s |
| **Ícone de expand (xicon)** | `rotate(90deg)` ao expandir | 0.2s |
| **Sidebar tooltips (tablet)** | `opacity 0→1` | 0.15s |
| **Sidebar do chat (fc-sidebar)** | `width 190px→0` + `opacity 1→0` | 0.2s |
| **Tema (troca claro/escuro)** | `color`, `background`, `border-color` | 0.2s (CSS `transition`) |
| **Botões** | `background` ao hover | 0.15s |

---

## 5. Componentes de UI

### 5.1 KPI Cards

- Fundo `var(--card-bg)`, borda `var(--card-border)`, border-radius 10px
- **`border-left: 3px solid var(--blue)`** — padrão enterprise/analytics que destaca o card sem peso excessivo
- Variante `.alert`: fundo `rgba(192,57,43,.08)`, border-left e borda vermelhas, valor em `var(--red)`
- Tooltip `ⓘ` com caixa `position:fixed` (não `absolute`) para não ser cortada por `overflow:hidden`
- Caret `::after` na caixa de tooltip aponta para o ícone

### 5.2 Backlog Table

- Wrapper `.bl-table-wrap` com `overflow-x:auto` e scrollbar customizado (6px, `#cbd5e1`)
- `min-width:700px` para garantir legibilidade
- Cabeçalho com `sort-th` e indicadores `▲`/`▼`/`⇅`
- Linha de child `children-row` com `display:none` por padrão
- Hover: `background: var(--table-hover)` — adapta-se automaticamente ao tema
- Linhas bloqueadas/fixing: fundo com `rgba` para compatibilidade com dark mode

### 5.3 Team Dropdown no Topbar

- Dropdown customizado (não `<select>`) com avatar, nome e indicador de check
- Fecha ao clicar fora (`document.addEventListener('click', ...)`)
- Background e bordas usam `rgba(255,255,255,...)` para funcionar sobre o topbar escuro em ambos os temas

### 5.4 Cards de Insight

- `.ins-card` com cor de borda e fundo por severidade (ambos os modos via `rgba`)
- Botão `✕` individual (`.ins-rm`) no canto superior direito
- Barra de feedback `👍/👎` na parte inferior (`.ins-fb-bar`)
- Grid 2 colunas desktop, 1 coluna mobile/tablet

### 5.5 Chat Flutuante (FAB)

- Botão circular fixo `52×52px` — sombra `0 6px 20px rgba(10,34,64,.38)` (marinho, não azul genérico)
- Badge vermelho de notificação sobre o ícone
- Painel `380×600px` com sidebar de histórico retrátil
- Header do painel usa `var(--topbar-bg)` — mesma cor do topbar principal
- Messages renderizadas com parser Markdown próprio
- Todos os fundos e bordas internos usam variáveis de tema

### 5.6 Toast System

- `position:fixed; bottom:24px; right:24px; z-index:9998`
- Fundo `var(--toast-bg)` com borda sutil `rgba(255,255,255,.08)`
- Variantes: `.ok` (`#0D6F4A`), `.err` (`var(--red)`), `.warn` (`var(--amber)`), default (`var(--toast-bg)`)
- Auto-remove após 3500ms com fade-out reverso
- Stacking vertical com `gap:8px`

### 5.7 Modais

- Overlay `var(--modal-overlay)` — `rgba(6,21,38,.65)` claro / `rgba(2,8,16,.8)` escuro
- Modal: `background: var(--modal-bg)` + `border: 1px solid var(--border)`
- Desktop: `width:500px`, centered, `max-height:90vh`
- Mobile: bottom sheet `border-radius:16px 16px 0 0; max-height:92vh`

### 5.8 Formulários

- Inputs: `background: var(--input-bg)`, `border: 1px solid var(--input-border)`, `color: var(--text-primary)`
- Focus ring: `box-shadow: 0 0 0 3px rgba(26,110,200,.15)` — mais sutil que o original
- Labels: `color: var(--text-secondary)`, `font-weight:600`

---

## 6. Vault — Experiência de Entrada

A tela de entrada (Vault) é a primeira impressão do usuário e deve comunicar imediatamente que o produto lida com dados sensíveis com seriedade:

- **Fundo:** `linear-gradient(160deg, var(--navy) 0%, #0A2240 100%)` — azul-marinho profundo e direcional
- **Card:** `background: var(--card-bg)` + `border: 1px solid var(--card-border)` + `box-shadow: 0 25px 60px rgba(0,0,0,.5)`
- **Logo:** ícone 🔐 + nome **AgileViewAI** em `font-weight:700`
- **Duas abas:** **Vault (PIN)** e **Sessão** — claramente diferenciadas, tabs com `font-weight:500`
- **Input PIN:** `letter-spacing:4px` para visualização de PIN, fundo `var(--input-bg)`, cor `var(--text-primary)`
- **Botão principal:** `padding:12px`, `font-weight:700`, `letter-spacing:.3px` — peso visual seguro
- **Área de erro** `.verr`: sempre presente (`min-height:18px`) para evitar layout shift
- **Nota técnica discreta:** "4 a 8 dígitos · tokens cifrados com AES-256-GCM" em `font-size:11px`
- **Tema no vault:** O vault é renderizado antes do app, mas o tema é aplicado via script inline no `<head>` antes do CSS — portanto o card adapta-se automaticamente (claro/escuro)

---

## 7. Acessibilidade

| Aspecto | Implementação |
|---|---|
| ARIA labels | `aria-label` na bottom navigation e FAB |
| Semântica HTML | `<nav>`, `<main>`, `<section>`, `<button>` usados corretamente |
| Contraste (modo claro) | Azul `#1A6EC8` sobre branco: ratio ≥ 4.5:1 (WCAG AA) |
| Contraste (modo escuro) | Texto `#DDE8F5` sobre `#0F1E30`: ratio ≥ 7:1 (WCAG AAA) |
| Toque | `min-height:40px` para botões principais em mobile |
| `-webkit-tap-highlight-color:transparent` | Elimina flash azul no iOS |
| Tooltips KPI fixos | Não cortados por overflow, posição calculada via `position:fixed` |
| `safe-area-inset-bottom` | Suporte a iPhones com área segura (notch) |
| Tema salvo | Preferência do sistema operacional detectada via `prefers-color-scheme` |

---

## 8. Estados do Sistema

| Estado | Experiência |
|---|---|
| **Sem dados sincronizados** | `.no-data` âmbar com instrução clara "Vá em Times, selecione um time e clique em Sincronizar" |
| **Sincronizando** | Toast "🔄 Sincronizando..." + botão desabilitado (`APP.syncRunning`) |
| **IA analisando** | Spinner + texto "Consultando [provider]..." na seção de insights |
| **Timeout (90s)** | Texto "⏱ Tempo esgotado. Clique em ↻ para tentar novamente" |
| **Erro de autenticação** | Toast `.err` com mensagem HTTP + orientação |
| **Dados desatualizados** | Timestamp "Sincronizado há X min" no topbar do time |

---

## 9. Design de Informação — Dashboard Sprint

A ordem dos elementos no dashboard segue uma progressão deliberada de **macro → micro → ação**:

1. **Topbar** — Identidade (projeto, time, sprint) e tempo restante
2. **KPIs** — Diagnóstico em 6 números com border-left semântica (visão imediata)
3. **Backlog** — Detalhe por item com drill-down (tasks, timeline)
4. **Progresso** — Métricas de velocidade e capacidade por atividade
5. **Insights** — Análise de IA consolidada (ação recomendada)
6. **Distribuição** — Breakdown individual de capacidade

---

## 10. Filosofia de Feedback

- **Feedbacks imediatos:** toda ação tem retorno visual em ≤100ms (hover states, disable durante request)
- **Feedbacks de processo:** spinners e toasts para operações assíncronas
- **Feedbacks de resultado:** toasts de sucesso/erro com mensagem específica (`.ok` / `.err` / `.warn`)
- **Feedbacks de validação:** inline nos formulários, sem submissão de dados inválidos
- **Feedbacks de treinamento:** sistema 👍/👎 nos cards de insight que alimenta análise de padrões
- **Feedbacks de tema:** a transição é suave (0.2s CSS transition em `color`, `background`, `border-color`) — sem flash

---

## 11. Decisões de Design (Rationale)

| Decisão | Alternativa descartada | Justificativa |
|---|---|---|
| Inter como fonte principal | Font-stack nativa do SO | Garante consistência visual entre Windows, macOS e Linux; neutralidade corporativa |
| Azul `#1A6EC8` em vez de `#1d4ed8` | Azul mais saturado/elétrico | Menos "playful", mais associado a softwares enterprise sérios |
| `border-left` nos KPI cards | Cards totalmente coloridos | Hierarquia mais sutil; evita poluição visual em dashboards densos |
| Gradiente marinho na sidebar | Fundo sólido | Profundidade visual sem peso; separa claramente a área de navegação |
| Toggle 🌙/☀️ na sidebar (desktop) | Toggle no settings | Mudança de contexto é uma ação frequente; deve estar acessível sem navegar |
| Badge "AV" no logo | Emoji 📊 | Mais profissional e escalável; emojis variam entre SOs |
| `rgba()` em cores de hover (dark mode) | Cores fixas | Garante adaptação automática sem duplicar regras CSS |
