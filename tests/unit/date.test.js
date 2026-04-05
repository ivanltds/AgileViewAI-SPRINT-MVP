import { DateUtils } from '../../src/utils/date.js';

describe('DateUtils', () => {
  let OriginalDate;

  beforeAll(() => {
    OriginalDate = global.Date;
  });

  afterAll(() => {
    global.Date = OriginalDate;
  });

  describe('bizDaysLeft()', () => {
    it('deve calcular os dias úteis entre hoje e a data alvo', () => {
      // Mock de data atual para quarta-feira, 1 de Novembro de 2023
      const mockToday = new Date('2023-11-01T12:00:00Z');
      global.Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) return new OriginalDate(mockToday);
          return new OriginalDate(...args);
        }
      };

      // Alvo: Terça-feira, 7 de Novembro de 2023
      // Dias previstos: 1(qua), 2(qui), 3(sex), [fim de semana], 6(seg), 7(ter) -> 5 dias
      expect(DateUtils.bizDaysLeft('2023-11-07T12:00:00Z')).toBe(5);
    });

    it('deve retornar 0 se não houver finishDate', () => {
      expect(DateUtils.bizDaysLeft(null)).toBe(0);
    });
  });

  describe('formatDate()', () => {
    it('deve formatar data para dd/mm', () => {
      expect(DateUtils.formatDate('2023-12-05T00:00:00Z')).toBe('05/12');
    });

    it('deve formatar data para dd/mm/aaaa se flag full for true', () => {
      expect(DateUtils.formatDate('2023-12-05T00:00:00Z', true)).toBe('05/12/2023');
    });
    
    it('deve retornar "—" para valores nulos', () => {
      expect(DateUtils.formatDate(null)).toBe('—');
    });
  });

  describe('isWeekend()', () => {
    it('deve retornar true para sábado', () => {
      expect(DateUtils.isWeekend('2023-11-04T12:00:00Z')).toBe(true);
    });
    
    it('deve retornar true para domingo', () => {
      expect(DateUtils.isWeekend('2023-11-05T12:00:00Z')).toBe(true);
    });

    it('deve retornar false para dias de semana', () => {
      expect(DateUtils.isWeekend('2023-11-03T12:00:00Z')).toBe(false); // Sexta
    });
  });
});
