import { jest } from '@jest/globals';
import { Store } from '../../../src/core/store.js';

describe('Store Resilience (TDD)', () => {
  beforeEach(() => {
    localStorage.clear();
    if (Store.clearMemory) Store.clearMemory();
  });

  it('deve falhar silenciosamente no localStorage e usar fallback de memória em caso de QuotaExceededError', () => {
    // Note: Em jsdom/jest setup, localStorage é um objeto mockado em window.localStorage.
    const setItemSpy = jest.spyOn(localStorage, 'setItem').mockImplementation(() => {
      const err = new Error('Quota exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    });

    const testData = { team: { name: 'Alpha' }, stats: { pct: 50 }, syncedAt: new Date().toISOString() };
    
    // SUT
    Store.saveSprintCache(testData);

    // Verificação
    // 1. O localStorage deve estar vazio (ou não conter a nova chave)
    // No mock do Store, se falhou, ele NÃO deveria ter gravado com sucesso.
    // Mas no nosso código, ele tenta o setItem, falha, entra no catch.
    expect(localStorage.getItem('avai_sprint_cache')).toBeNull();
    
    // 2. O getter deve retornar o dado (vido da memória)
    expect(Store.getSprintCache()).toEqual(testData);

    setItemSpy.mockRestore();
  });

  it('deve otimizar (cull) dados pesados antes de tentar salvar', () => {
    const heavyData = {
      team: { name: 'Beta' },
      backlog: [
        { id: 1, title: 'Item 1', _raw: 'very heavy string payload that should be removed' },
        { id: 2, title: 'Item 2', metadata: { internal: { junk: 'more heavy stuff' } } }
      ],
      tasks: [
        { id: 101, _links: { self: { href: '...' }, heavy: '...' } }
      ]
    };

    Store.saveSprintCache(heavyData);
    const saved = Store.getSprintCache();

    // Verificação de otimização
    expect(saved.backlog[0]._raw).toBeUndefined();
    expect(saved.backlog[1].metadata).toBeUndefined();
    expect(saved.tasks[0]._links).toBeUndefined();
  });
});
