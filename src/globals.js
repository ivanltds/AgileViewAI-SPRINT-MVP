
import { Store } from './core/store.js';
import { Vault } from './core/vault.js';
import { AzureAPI } from './core/azure-api.js';
import { InsightsService } from './services/insights.js';
import { EficienciaService } from './services/eficiencia.js';
import { QualidadeService } from './services/qualidade.js';

window.Store = Store;
window.Vault = Vault;
window.AzureAPI = AzureAPI;
window.InsightsService = InsightsService;
window.EficienciaService = EficienciaService;
window.QualidadeService = QualidadeService;
// Inject also a mock for old global "APP" context if needed, though the legacy code initializes it
console.log('AgileViewAI: Servicos injetados no contexto global para legacy UI.');
  