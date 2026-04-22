/**
 * AgileViewAI - Training UI Component (ESM)
 */

import { Store } from '../../core/store.js';
import { ChatService } from '../../services/chat.js';

export const TrainingUI = {
  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Escuta mudanças de navegação para re-renderizar se necessário
    document.addEventListener('nav-changed', (e) => {
      if (e.detail.panel === 'rag') {
        this.render();
      }
    });

    // Delegante global para botões de troca de aba interna do treino
    window.showTrainingTab = (name) => this.showTab(name);
  },

  showTab(name) {
    document.querySelectorAll('.train-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.train-panel').forEach(p => p.classList.remove('active'));
    
    document.getElementById('ttab-' + name)?.classList.add('active');
    document.getElementById('tt-' + name)?.classList.add('active');

    if (name === 'feedback') this.renderFeedback();
    if (name === 'conversas') this.renderConversas();
    if (name === 'agentes') this.renderAgentes();
  },

  render() {
    // Por padrão o index.html já tem as abas, apenas garantimos a renderização da aba ativa
    const activeTab = document.querySelector('.train-tab.active');
    if (activeTab) {
      const name = activeTab.id.replace('ttab-', '');
      this.showTab(name);
    }
  },

  renderFeedback() {
    const el = document.getElementById('tt-feedback-content');
    if (!el) return;

    const profile = Store.getUserProfile();
    const inferredLevel = profile.level || 'neutral';
    const LABELS = { technical: 'Técnico', didactic: 'Didático', neutral: 'Equilibrado' };

    el.innerHTML = `
      <div class="ul-profile-box" style="background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:20px">
        <div style="font-size:11px; font-weight:700; color:var(--gray); text-transform:uppercase; margin-bottom:10px">Perfil de Conhecimento</div>
        <div style="display:flex; align-items:center; gap:10px">
          <span class="badge ${inferredLevel}" style="padding:6px 12px; border-radius:20px; font-weight:600">${LABELS[inferredLevel]}</span>
          <span style="font-size:12px; color:var(--gray)">${profile.override ? '(Definido manualmente)' : '(Inferido automaticamente)'}</span>
        </div>
        <div style="margin-top:15px; font-size:13px; color:var(--slate)">
          Sua interação com o AgileViewAI ajuda a treinar nossos modelos para fornecer insights mais precisos e personalizados.
        </div>
      </div>
    `;
  },

  renderConversas() {
    const el = document.getElementById('tt-conversas-content');
    if (!el) return;

    const convs = [...Store.getChatConvs()].reverse();
    const profile = Store.getUserProfile();
    
    // Simula a inferência se necessário (ou integra com ChatService se disponível)
    const inferredLevel = profile.level || 'neutral';
    
    const LABELS = { technical: 'Técnico', didactic: 'Didático', neutral: 'Equilibrado' };
    
    let html = `
      <div class="ul-profile-box" style="background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:20px">
        <div style="font-size:11px; font-weight:700; color:var(--gray); text-transform:uppercase; margin-bottom:10px">Perfil de Conhecimento</div>
        <div style="display:flex; align-items:center; gap:10px">
          <span class="badge ${inferredLevel}" style="padding:6px 12px; border-radius:20px; font-weight:600">${LABELS[inferredLevel]}</span>
          <span style="font-size:12px; color:var(--gray)">${profile.override ? '(Definido manualmente)' : '(Inferido automaticamente)'}</span>
        </div>
      </div>
      <div style="font-size:14px; font-weight:700; margin-bottom:12px; color:var(--slate)">Histórico de Conversas (${convs.length})</div>
    `;

    if (convs.length === 0) {
      html += `<div style="text-align:center; padding:40px; color:var(--gray)">Nenhuma conversa encontrada. Inicie um chat para treinar a IA.</div>`;
    } else {
      html += convs.map(c => `
        <div class="conv-card" style="display:flex; align-items:center; gap:12px; padding:12px; background:var(--card-bg); border:1px solid var(--border); border-radius:10px; margin-bottom:8px">
          <div style="font-size:20px; opacity:0.6">💬</div>
          <div style="flex:1">
            <div style="font-weight:600; font-size:14px">${c.title || 'Conversa sem título'}</div>
            <div style="font-size:11px; color:var(--gray)">${new Date(c.createdAt).toLocaleDateString()} · ${c.messages?.length || 0} mensagens</div>
          </div>
          <button class="btn-sm" onclick="window.ChatUI.openConv('${c.id}')">Abrir</button>
        </div>
      `).join('');
    }

    el.innerHTML = html;
  },

  renderAgentes() {
    const el = document.getElementById('tt-agentes-content');
    if (!el) return;
    el.innerHTML = `<div style="padding:20px; color:var(--gray)">Configuração de Prompts dos Agentes (Fase 7.3)</div>`;
  }
};
