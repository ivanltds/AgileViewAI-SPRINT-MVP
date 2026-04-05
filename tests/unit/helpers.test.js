import { Helpers } from '../../src/utils/helpers.js';

describe('Helpers Utility', () => {
  describe('formatHours()', () => {
    it('deve formatar números para string com "h"', () => {
      expect(Helpers.formatHours(8.5)).toBe('8,5h');
      expect(Helpers.formatHours('10')).toBe('10h');
    });

    it('deve retornar "—" para valores nulos/indefinidos', () => {
      expect(Helpers.formatHours(null)).toBe('—');
      expect(Helpers.formatHours(undefined)).toBe('—');
    });
  });

  describe('initials()', () => {
    it('deve retornar as iniciais de um nome composto', () => {
      expect(Helpers.initials('Ivan Lourenço')).toBe('IL');
      expect(Helpers.initials('Ana Maria Silva')).toBe('AM');
    });

    it('deve retornar "??" para nomes vazios', () => {
      expect(Helpers.initials('')).toBe('??');
      expect(Helpers.initials(null)).toBe('??');
    });
  });

  describe('statusClass()', () => {
    it('deve mapear done/closed para s-done', () => {
      expect(Helpers.statusClass('Done')).toBe('s-done');
      expect(Helpers.statusClass('Closed')).toBe('s-done');
    });

    it('deve mapear progress/doing para s-doing', () => {
      expect(Helpers.statusClass('Doing')).toBe('s-doing');
      expect(Helpers.statusClass('In Progress')).toBe('s-doing');
    });

    it('deve mapear todo/backlog para s-todo', () => {
      expect(Helpers.statusClass('To Do')).toBe('s-todo');
      expect(Helpers.statusClass('Backlog')).toBe('s-todo');
    });
    
    it('deve retornar s-other para estados desconhecidos', () => {
       expect(Helpers.statusClass('RandomState')).toBe('s-other');
    });
  });

  describe('blockStatus()', () => {
    it('deve identificar bloqueio pelo campo Microsoft.VSTS.CMMI.Blocked', () => {
      const item = { fields: { 'Microsoft.VSTS.CMMI.Blocked': 'Yes' } };
      expect(Helpers.blockStatus(item)).toBe(true);
    });

    it('deve identificar bloqueio pelas tags', () => {
      const item = { fields: { 'System.Tags': 'Urgent, Bloqueado, Frontend' } };
      expect(Helpers.blockStatus(item)).toBe(true);
    });

    it('deve retornar false se não houver indicativo de bloqueio', () => {
      const item = { fields: { 'System.Tags': 'Urgent' } };
      expect(Helpers.blockStatus(item)).toBe(false);
    });
  });
});
