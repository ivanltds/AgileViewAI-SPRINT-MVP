import fs from 'fs';
import path from 'path';

/**
 * @jest-environment jsdom
 */

describe('Timeline Logic (legacy.js)', () => {
  let _build;
  let _fmt;

  beforeAll(() => {
    const legacyPath = path.resolve('src/legacy.js');
    const legacyCode = fs.readFileSync(legacyPath, 'utf8');
    const script = document.createElement('script');
    script.textContent = legacyCode;
    document.head.appendChild(script);

    _build = window._buildColumnTimeline;
    _fmt = window._fmtBlockTime;
  });

  test('deve calcular corretamente a duração em dias entre colunas (formato Xd)', () => {
    const revs = [
      { fields: { 'System.BoardColumn': 'Todo', 'System.ChangedDate': '2024-01-01T10:00:00Z' } },
      { fields: { 'System.BoardColumn': 'Doing', 'System.ChangedDate': '2024-01-03T10:00:00Z' } }
    ];
    
    const result = _build(revs);
    expect(result.html).toContain('Todo');
    expect(result.html).toContain('2d'); // O código legado usa o sufixo 'd'
  });

  test('deve calcular corretamente o tempo bloqueado acumulado (arredondado para horas)', () => {
    const revs = [
      { fields: { 'System.BoardColumn': 'Doing', 'System.ChangedDate': '2024-01-01T10:00:00Z' } },
      // Bloqueou por 3 horas (180 minutos)
      { fields: { 'Custom.Block': true, 'System.ChangedDate': '2024-01-01T12:00:00Z' } },
      { fields: { 'Custom.Block': false, 'System.ChangedDate': '2024-01-01T15:00:00Z' } }
    ];
    
    const result = _build(revs);
    const expectedMs = 180 * 60000;
    expect(result.totalBlockMs).toBe(expectedMs);
    expect(result.html).toContain('3h'); // O código legado arredonda para horas inteiras se < 8h
  });

  test('deve formatar o tempo bloqueado seguindo as regras de arredondamento do legado', () => {
    // 45 minutos (0.75h) -> arredonda para 1h (comportamento atual do legado)
    expect(_fmt(45 * 60000)).toBe('1h');
    
    // 120 minutos -> 2h
    expect(_fmt(120 * 60000)).toBe('2h');
    
    // 2 dias -> 2d
    expect(_fmt(48 * 3600000)).toBe('2d');
  });

  test('deve retornar mensagem de "Sem histórico" para revisões vazias', () => {
    const result = _build([]);
    expect(result.html).toContain('Sem histórico disponível');
  });
});
