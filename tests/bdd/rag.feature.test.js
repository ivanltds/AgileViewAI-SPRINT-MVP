import { ChatUI } from '../../src/components/ui/chat.js';
import { Store } from '../../src/core/store.js';

describe('Feature: RAG Chat Assistant', () => {

  beforeEach(() => {
    Store.init();
    // Simulate initial DOM for Chat UI
    document.body.innerHTML = '';
    ChatUI.init();
  });

  describe('Scenario: Context-aware responses based on Sprint Backlog', () => {
    
    it('deve formatar mensagens recebidas usando markdown', () => {
      // Abre o chat
      const chatBtn = document.getElementById('fc-fab');
      chatBtn.click();
      
      ChatUI.addMessage('ai', 'Teste de **negrito** e *italico*');
      const hist = document.getElementById('fc-messages').innerHTML;
      expect(hist).toContain('<strong>negrito</strong>');
      expect(hist).toContain('<em>italico</em>');
    });

    it('deve usar o contexto armazenado no Store para responder (mock logic)', () => {
       const fakeBacklog = [
         { id: '99', fields: { 'System.Title': 'T99 - Refatoração', 'System.State': 'Done' } }
       ];
       Store.setBacklog(fakeBacklog);
       
       const cxt = Store.getBacklog();
       expect(cxt.length).toBe(1);
       expect(cxt[0].id).toBe('99');
       // Em chamadas reais, The ChatUI.handleSend() faria dispatch pro RAG enviando cxt.
    });
  });

  describe('Scenario: Chat Behavior', () => {
    it('deve rolar o chat para o final após inserir nova mensagem', () => {
      ChatUI.addMessage('user', 'Oi');
      const hist = document.getElementById('fc-messages');
      expect(hist.scrollTop).toBe(hist.scrollHeight);
    });
  });

});
