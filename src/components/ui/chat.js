/**
 * AgileViewAI UI Components: Floating Chat
 * Interface de conversação com o Agente IA.
 */

import { ChatService } from '../../services/chat.js';
import { Store } from '../../core/store.js';

export const ChatUI = {
  /**
   * Inicializa o componente de chat flutuante.
   */
  init() {
    this.isOpen = false;
    this.messages = [];
    this.renderBase();
    this.renderSidebar();
    this.setupEvents();
  },

  renderBase() {
    // FAB (Botão flutuante)
    const fab = document.createElement('button');
    fab.id = 'fc-fab';
    fab.className = 'fc-fab';
    fab.innerHTML = '💬'; // Poderia ser um SVG do ICONS
    document.body.appendChild(fab);

    // Painel do Chat
    const panel = document.createElement('div');
    panel.id = 'fc-panel';
    panel.className = 'fc-panel';
    panel.innerHTML = `
      <div class="fc-header">
        <div class="fc-header-title">AgileViewAI Bot</div>
        <button class="fc-hbtn" id="fc-close">×</button>
      </div>
      <div class="fc-body">
        <div class="fc-sidebar" id="fc-sidebar"></div>
        <div class="fc-messages" id="fc-messages">
          <div class="fc-welcome">Como posso ajudar seu time hoje?</div>
        </div>
      </div>
      <div class="fc-input-area" style="flex-shrink:0">
        <textarea class="fc-textarea" id="fc-textarea" placeholder="Pergunte sobre a sprint..."></textarea>
        <button class="fc-send-btn" id="fc-send">➤</button>
      </div>
    `;
    document.body.appendChild(panel);
  },

  setupEvents() {
    const fab = document.getElementById('fc-fab');
    const panel = document.getElementById('fc-panel');
    const closeBtn = document.getElementById('fc-close');
    const sendBtn = document.getElementById('fc-send');
    const textarea = document.getElementById('fc-textarea');

    fab.addEventListener('click', () => this.toggle());
    closeBtn.addEventListener('click', () => this.toggle());

    sendBtn.addEventListener('click', () => this.sendMessage());
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  },

  toggle() {
    this.isOpen = !this.isOpen;
    const panel = document.getElementById('fc-panel');
    panel.classList.toggle('open', this.isOpen);
    if (this.isOpen) {
      this.renderSidebar();
      document.getElementById('fc-textarea').focus();
    }
  },

  renderSidebar() {
    const sidebar = document.getElementById('fc-sidebar');
    if (!sidebar) return;
    const convs = Store.getChatConvs();
    if (!convs.length) {
      sidebar.innerHTML = '<div style="padding:15px;color:var(--gray);font-size:11px">Sem histórico</div>';
      return;
    }
    sidebar.innerHTML = convs.reverse().map(c => `
      <div class="fc-conv-item" onclick="ChatUI.openConv('${c.id}')">
        <div style="font-weight:600;margin-bottom:2px">${c.title || 'Nova conversa'}</div>
        <div style="opacity:0.6;font-size:10px">${new Date(c.createdAt).toLocaleDateString()}</div>
      </div>
    `).join('');
  },

  openConv(id) {
    const convs = Store.getChatConvs();
    const conv = convs.find(c => c.id === id);
    if (!conv) return;
    
    this.currentConvId = id;
    const msgEl = document.getElementById('fc-messages');
    msgEl.innerHTML = '';
    conv.messages.forEach(m => this.addMessage(m.role, m.content));
    
    if (!this.isOpen) this.toggle();
  },

  async sendMessage() {
    const textarea = document.getElementById('fc-textarea');
    const text = textarea.value.trim();
    if (!text) return;

    textarea.value = '';
    this.addMessage('user', text);

    // Placeholder de "Pensando..."
    const thinkId = 'think-' + Date.now();
    this.addMessage('ai', '...', thinkId);

    try {
      // Integração real com o ChatService (Fase 3)
      const response = await ChatService.ask(text);
      this.updateMessage(thinkId, response);
    } catch (error) {
      this.updateMessage(thinkId, `Erro: ${error.message}`);
    }
  },

  addMessage(role, content, id = null) {
    const msgEl = document.getElementById('fc-messages');
    const div = document.createElement('div');
    if (id) div.id = id;
    div.className = role === 'user' ? 'fc-msg-user' : 'fc-msg-ai';
    div.innerHTML = this.formatMarkdown(content);
    msgEl.appendChild(div);
    msgEl.scrollTop = msgEl.scrollHeight;
  },

  updateMessage(id, content) {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = this.formatMarkdown(content);
      const msgEl = document.getElementById('fc-messages');
      msgEl.scrollTop = msgEl.scrollHeight;
    }
  },

  /**
   * Conversor simples de Markdown (Bold, Italics, Lists)
   */
  formatMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }
};
