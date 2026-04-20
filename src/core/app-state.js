/**
 * AgileViewAI - App State Bridge (ESM)
 * Sincroniza o estado entre os novos módulos ESM e o objeto legado window.APP.
 */

const _defaults = {
  vaultKey: null,
  vaultMode: null,
  sprintData: null,
  insightCards: [],
  syncRunning: false,
  allIterations: [],
  eficienciaData: null,
  efChartMode: { flow: 'throughput', time: 'lead' },
  qualidadeData: null,
  qualTipo: 'ambos',
  qualEstado: 'aberto',
  qualSeverity: 'todas',
  sessionTokens: { teams: {}, llms: {}, orgs: {} },
  chatConvId: null,
  chatMessages: [],
};

/**
 * Proxy dinâmico que sempre aponta para globalThis.APP.
 * Essencial para testes onde globalThis.APP é resetado em cada beforeEach.
 */
export const AppState = new Proxy({}, {
  get(_, prop) {
    const target = globalThis.APP || _defaults;
    return target[prop] !== undefined ? target[prop] : _defaults[prop];
  },
  set(_, prop, value) {
    if (!globalThis.APP) globalThis.APP = { ..._defaults };
    globalThis.APP[prop] = value;
    return true;
  }
});
