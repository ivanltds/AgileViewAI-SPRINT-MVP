# AgileViewAI — Plano de Escalabilidade

---

## 1. Estado Atual e Limitações Técnicas

### 1.1 Arquitectura Atual (v2.3)

O AgileViewAI v2.3 é uma Single File Application (SFA) que opera 100% no browser do usuário, sem backend próprio. Isso tem vantagens (zero infra, privacidade, sem custo operacional) e limitações para escala.

**Limitações identificadas:**

| Limitação | Causa | Impacto |
|---|---|---|
| 1 cache de sprint por browser | `avai_sprint_cache` é único por localStorage | Sem histórico multi-sprint no cache |
| PATs armazenados no browser | Cada usuário tem suas próprias credenciais | Sem compartilhamento centralizado de configuração |
| Chamadas diretas ao Azure API | Sem pool de rate-limiting | Risco de throttling em times grandes |
| Todas as sprints do time carregadas | `getIterations` traz todas as iterações | Pode ficar lento com times com 200+ sprints |
| Revisões buscadas por item | Batch de 8 paralelos | Eficiência pode demorar minutos com 100+ sprints × 50+ itens |
| Chart.js via CDN | Dependência de internet para 1 arquivo JS | App quebra sem internet na primeira carga |
| localStorage limitado ~5-10MB | Armazenamento no browser | Histórico de chat/feedback pode crescer |

---

## 2. Vetores de Escalabilidade

### 2.1 Vetor 1: Backend Leve (API Gateway + Cache)

**Problema que resolve:** rate limiting, cache compartilhado, PATs centralizados  
**Complexidade:** média  
**Custo:** baixo (pode rodar em Vercel, Railway, Render free tier)

```
Browser ──→ API Gateway (Node.js/Deno)
              │
              ├── Cache Redis (dados da sprint por orgId+teamId+sprintId)
              │   TTL: 1h (dados mudam raramente durante o dia)
              │
              └── Azure DevOps API
                  (Pool de PATs gerenciados pelo servidor)
```

**Benefícios:**
- Dados compartilhados entre membros do time que usam o mesmo app
- Rate limiting controlado (evita throttling da Azure API em times grandes)
- PATs não precisam ser inseridos por cada usuário individualmente
- Histórico de sprints persistido de forma centralizada

**Implementação incremental:**
```javascript
// Fase 1: Apenas cache de payload
// Frontend detecta se backend está disponível
const BASE_URL = window.AGILEVIEW_API || null;

async function fetchSprintData(org, proj, team) {
  if (BASE_URL) {
    // Tenta cache do servidor primeiro
    const cached = await fetch(`${BASE_URL}/cache/${org}/${proj}/${team}`);
    if (cached.ok) return cached.json();
  }
  // Fallback: chamada direta (modo atual)
  return DataProcessor.sync();
}
```

### 2.2 Vetor 2: Progressive Web App (PWA)

**Problema que resolve:** dependência de internet, performance móvel, UX nativa  
**Complexidade:** baixa  
**Custo:** zero

```
Service Worker (sw.js)
  ├── Cache de ativos estáticos (HTML, CSS, JS)
  ├── Cache da Chart.js CDN
  └── Background Sync:
        - Enfileira sincronizações quando offline
        - Executa quando conexão retorna
```

**Manifest para instalação:**
```json
{
  "name": "AgileViewAI",
  "short_name": "AgileView",
  "display": "standalone",
  "background_color": "#1e293b",
  "theme_color": "#1e293b",
  "icons": [{ "src": "icon.png", "sizes": "192x192" }],
  "start_url": "./agileviewai2.3.html"
}
```

**Benefícios:**
- App instalável na tela inicial (iOS, Android, desktop)
- Funciona completamente offline após primeira carga
- Performance equivalente a app nativo

### 2.3 Vetor 3: Multi-tenant SaaS

**Problema que resolve:** escalabilidade para N times de N organizações  
**Complexidade:** alta  
**Custo:** médio-alto

```
┌─────────────────────────────────────────────────────────┐
│                    SAAS BACKEND                         │
│                                                         │
│  Auth (Auth0/Supabase) ─→ User/Org Management           │
│         │                                               │
│  Azure API Proxy ────────→ Cache (Redis/Upstash)        │
│         │                                               │
│  LLM Router ─────────────→ Rate Limiter por tenant      │
│         │                                               │
│  Database (Postgres/Supabase) ──→ RAG storage           │
│                                    Chat history         │
│                                    Insight feedback     │
│                                    Sprint snapshots     │
└─────────────────────────────────────────────────────────┘
```

**Modelo de dados para multi-tenant:**
```sql
organizations (id, name, azure_pat_encrypted, plan_id)
  └── teams (id, org_id, name, azure_project, azure_team)
        └── sprint_snapshots (id, team_id, sprint_path, data_json, synced_at)
        └── rag_contexts (id, team_id, scope, type, spec, active)
        └── insight_feedback (id, team_id, title, vote, created_at)
        └── chat_conversations (id, team_id, user_id, messages_json)

users (id, email, org_id, role)  -- role: admin, member, viewer
llm_configs (id, org_id, provider, token_encrypted, active)
```

### 2.4 Vetor 4: Integrações Adicionais

**Novas fontes de dados além do Azure DevOps:**

| Integração | API | Dados |
|---|---|---|
| **GitHub** | GitHub REST/GraphQL API | PRs, reviews, issues, deployments |
| **Jira** | Jira Cloud REST API | Stories, epics, velocity chart |
| **Linear** | Linear GraphQL API | Issues, cycles, team metrics |
| **Slack** | Slack API | Mensagens de standups, canais de bloqueio |
| **GitHub Actions** | GitHub Actions API | Build failures, deployment frequency (DORA) |
| **Sentry** | Sentry API | Error rates, affected users |

**Arquitetura de connectors:**
```javascript
// Interface comum de connector
class AzureConnector {
  async getSprintData(config) { ... }
  async getCapacity(config) { ... }
  async getWorkItems(config) { ... }
}

class JiraConnector {
  async getSprintData(config) { ... }
  async getCapacity(config) { ... }
  async getWorkItems(config) { ... }
}

// Factory pattern
const connector = ConnectorFactory.create(team.type); // 'azure' | 'jira' | 'github'
const data = await connector.getSprintData(team.config);
```

### 2.5 Vetor 5: Métricas DORA e Engenharia de Plataforma

**DORA Metrics integrados:**

| Métrica | Fonte | Implementação |
|---|---|---|
| **Deployment Frequency** | GitHub Actions / Azure Pipelines | Conta deploys por sprint |
| **Lead Time for Changes** | Commit → Deploy via GitHub API | `deployedAt - commitDate` |
| **Change Failure Rate** | Hotfixes / rollbacks | `hotfixCount / totalDeploys` |
| **MTTR** | Issues de incidente | `resolvedAt - createdAt` médio |

### 2.6 Vetor 6: IA Avançada

**Roadmap de capacidades de IA:**

| Capacidade | Descrição | Complexidade |
|---|---|---|
| **Previsão de risco** | ML simples: com base em velocity histórica, prever probabilidade de não entrega | Média |
| **Anomaly detection** | Detectar automaticamente membros com padrão atípico vs histórico pessoal | Alta |
| **Sprint capacity planning** | Dado histórico + próximos days off: sugerir capacidade e escopo da próxima sprint | Média |
| **RAG vetorial** | Armazenar contextos RAG como embeddings (OpenAI Embeddings / Supabase pgvector) para busca semântica | Alta |
| **Fine-tuning local** | Treinar modelo pequeno (Llama/Mistral) com feedback acumulado do time | Muito alta |
| **Agent pipeline assíncrono** | Web Worker para processamento A1→A2→A3 sem bloquear UI | Baixa |

### 2.7 Vetor 7: Colaboração em Tempo Real

**Funcionalidade:** múltiplos Agile Masters vendo o mesmo dashboard simultaneamente

**Tecnologia:** WebSockets via Supabase Realtime ou Ably

```javascript
// Canal por team_id
const channel = supabase.channel(`sprint:${teamId}`);
channel
  .on('broadcast', { event: 'insight_dismissed' }, (payload) => {
    removeInsightCard(payload.title);
  })
  .on('broadcast', { event: 'new_sync' }, () => {
    toast('Sprint atualizada por outro usuário — recarregar?');
  })
  .subscribe();

// Ao fechar card:
channel.send({ type: 'broadcast', event: 'insight_dismissed', payload: { title: card.title } });
```

---

## 3. Roadmap de Escalabilidade por Fase

### Fase 1 — Quick Wins (0-3 meses)

| Item | Esforço | Impacto |
|---|---|---|
| PWA (Service Worker + manifest) | 2-3 dias | App instalável, offline-first |
| Chart.js embutido no HTML (eliminar CDN) | 1 dia | Zero dependência de internet |
| Cache multi-sprint (por time ID no localStorage) | 3-5 dias | Eficiência mais rápida ao trocar de time |
| Export PDF via jsPDF embutido | 3-5 dias | Eliminar dependência de Google Drive |
| Compartilhar link com dados (URL hash encoding) | 2-3 dias | Compartilhamento sem download de arquivo |

### Fase 2 — Backend Leve (3-6 meses)

| Item | Esforço | Impacto |
|---|---|---|
| API Gateway em Node.js (Vercel/Railway) | 1-2 semanas | Rate limiting, cache compartilhado |
| Autenticação básica (paar compartilhar times dentro de organização) | 1-2 semanas | Multi-usuário |
| Cache Redis de sprint data (TTL 1h) | 3-5 dias | Performance para times grandes |
| Connector Jira Cloud | 2-3 semanas | Expansão de mercado |

### Fase 3 — SaaS Multi-tenant (6-12 meses)

| Item | Esforço | Impacto |
|---|---|---|
| Supabase (Auth + DB + Realtime) | 3-4 semanas | Full multi-tenant |
| Dashboard compartilhável por link | 1-2 semanas | Stakeholder access sem conta |
| Planos de assinatura (Free/Pro/Team) | Processo de negócio | Monetização |
| DORA Metrics dashboard | 3-4 semanas | Diferencial de mercado |
| RAG vetorial (embeddings + pgvector) | 2-3 semanas | IA mais precisa |

### Fase 4 — Enterprise (12-24 meses)

| Item | Esforço | Impacto |
|---|---|---|
| SSO (SAML 2.0 / Azure AD) | 4-6 semanas | Adoção enterprise |
| Self-hosted option | 1-2 meses | Compliance de dados |
| Auditoria e logs de acesso | 2-3 semanas | Segurança enterprise |
| API pública para integração com outras ferramentas | 4-6 semanas | Ecosystem |
| White-label para consultorias ágeis | 2-3 semanas | Canal de parceiros |

---

## 4. Considerações de Performance para Escala

### 4.1 Azure DevOps API Rate Limits

| Limite | Valor | Mitigação |
|---|---|---|
| Global rate limit | 200 req/s por PAT | Pool de PATs no backend |
| WIQL result size | 20.000 IDs | Paginação ou filtros de tempo |
| WorkItems batch | 200 IDs por request | Já implementado |
| Revisões por item | Sem limite documentado | Batch de 8 paralelos |

### 4.2 LLM Cost Optimization

| Estratégia | Descrição |
|---|---|
| Cache de insights por sprint | Mesmo payload → mesmo SHA256 → retorna cached insights (TTL 1h) |
| Streaming responses | `stream: true` + Server-Sent Events — exibe tokens à medida que chegam |
| Model routing | Perguntas simples → Gemini Flash (mais barato); análises complexas → GPT-4o/Claude |
| Prompt compression | Truncar backlog grande para os 20 itens mais relevantes (bloqueados + rem mais alto) |

### 4.3 Estimativa de Custos por Tier

| Componente | Free | Pro ($29/mês) | Enterprise |
|---|---|---|---|
| Hosting | Vercel Free | Vercel Pro | AWS/GCP |
| DB | Supabase Free (500MB) | Supabase Pro ($25) | Managed Postgres |
| LLM | Token próprio do usuário | Token do produto (custo variável) | Azure OpenAI |
| Cache | Upstash 10k requests | Upstash Pro | Redis Enterprise |
| Usuários | 1 time, 5 usuários | 5 times, 20 usuários | Ilimitado |

---

## 5. Limitações Não-técnicas

| Limitação | Descrição | Mitigação |
|---|---|---|
| CORS da Azure API | Azure DevOps permite CORS para browsers em alguns endpoints | Proxy server resolve completamente |
| Segurança de PAT | PAT no browser é risco se sistema comprometido | Backend com token vault centralizado |
| Latência de LLM | A1+A2+A3 sequencial pode levar 30-90s | Web Worker paralelo + streaming |
| Armazenamento de dados sensíveis do time | Nomes, capacidade, dados de performance são sensíveis | Self-hosted ou criptografia ponta-a-ponta |
| Dependência de LLM externo | Se OpenAI/Anthropic sair do ar, insights falham | Fallback: análise determinística sem LLM |
