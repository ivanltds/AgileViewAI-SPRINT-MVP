import { jest } from '@jest/globals';
import { AzureAPI } from '../../../src/core/azure-api.js';

describe('AzureAPI Module (src/core/azure-api.js)', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    // polyfill for test environment
    if (!globalThis.btoa) {
      globalThis.btoa = (str) => Buffer.from(str).toString('base64');
    }
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('_fetch()', () => {
    it('deve retornar JSON parseado quando requisicao for OK', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'ok' })
      });

      const res = await AzureAPI._fetch('http://test');
      expect(res).toEqual({ data: 'ok' });
    });

    it('deve lancar erro contendo HTTP status qdo !ok', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden details')
      });

      await expect(AzureAPI._fetch('http://test')).rejects.toThrow('HTTP 403: Forbidden details');
    });
  });

  describe('_auth()', () => {
    it('deve gerar header de basic auth corretamente', () => {
      const headers = AzureAPI._auth('mypat');
      expect(headers['Authorization']).toContain('Basic ');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('_encTeam()', () => {
    it('deve encodar nome do time preservando espacos como %20', () => {
      expect(AzureAPI._encTeam('Meu Time Dev')).toBe('Meu%20Time%20Dev');
    });
  });

  describe('getIterations()', () => {
    it('retorna a lista de iteracoes', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: [{ id: 1 }, { id: 2 }] })
      });

      const res = await AzureAPI.getIterations('org', 'proj', 'time a', 'pat');
      expect(res.length).toBe(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('_apis/work/teamsettings/iterations?api-version=7.1'),
        expect.any(Object)
      );
    });

    it('lanca erro se array ou valor vier vazio', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: [] })
      });

      await expect(AzureAPI.getIterations('org', 'proj', 'time', 'pat')).rejects.toThrow('Nenhuma sprint encontrada para o time "time"');
    });
  });

  describe('getTeamCapacity()', () => {
    it('retorna teamMembers se disponivel', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ teamMembers: [{ name: 'Ivan' }] })
      });
      const res = await AzureAPI.getTeamCapacity('o', 'p', 't', '1', 'pat');
      expect(res).toEqual([{ name: 'Ivan' }]);
    });

    it('retorna value array se nao houver teamMembers', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: [{ name: 'Dev' }] })
      });
      const res = await AzureAPI.getTeamCapacity('o', 'p', 't', '1', 'pat');
      expect(res).toEqual([{ name: 'Dev' }]);
    });

    it('retorna array vazio em caso de erro na rede ou json sem arrays padroes', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      const res = await AzureAPI.getTeamCapacity('o', 'p', 't', '1', 'pat');
      expect(res).toEqual([]);
    });
  });

  describe('getWorkItemIds()', () => {
    it('monta a query e retorna array de ids', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ workItems: [{ id: 101 }, { id: 102 }] })
      });
      const ids = await AzureAPI.getWorkItemIds('o', 'p', 'sprint 1', 'pat');
      expect(ids).toEqual([101, 102]);
      
      const args = global.fetch.mock.calls[0];
      expect(args[1].method).toBe('POST');
      expect(args[1].body).toContain('SELECT [System.Id] FROM WorkItems');
    });
  });

  describe('getWorkItemsBatch()', () => {
    it('retorna vazio se o array de ids estiver vazio', async () => {
      const res = await AzureAPI.getWorkItemsBatch('o', 'p', [], 'pat');
      expect(res).toEqual([]);
    });

    it('busca em lotes de 200', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ value: [{ id: 'mocked' }] })
      });

      const bigArray = new Array(250).fill(1).map((_, i) => i);
      const res = await AzureAPI.getWorkItemsBatch('o', 'p', bigArray, 'pat');
      
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(res.length).toBe(2);
    });

    it('continua mesmo se um lote falhar', async () => {
      global.fetch
        .mockRejectedValueOnce(new Error('Lote 1 failed'))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ value: [{ id: 'lote2' }] }) });

      const bigArray = new Array(250).fill(1);
      const res = await AzureAPI.getWorkItemsBatch('o', 'p', bigArray, 'pat');
      
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(res).toEqual([{ id: 'lote2' }]);
    });
  });
});
