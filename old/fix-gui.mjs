import fs from 'fs';

try {
  // 1. Read Monolith 
  const html = fs.readFileSync('agileviewai2.3.html', 'utf8');
  const match = html.match(/<script>\s*\n\/\/ ════════([\s\S]*?)<\/script>/);
  if(!match) throw new Error('Script not found');

  // Remove DOMContentLoaded from legacy so it doesn't try to boot itself (app.js handles boot now)
  let legacySrc = match[1];
  legacySrc = legacySrc.replace(/document\.addEventListener\('DOMContentLoaded',\s*init\);/, '// document.addEventListener("DOMContentLoaded", init); by app.js');

  // 2. Create globals.js to expose our modern ES modules to the legacy code
  const globalsSrc = `
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
  `;

  fs.writeFileSync('src/legacy.js', legacySrc, 'utf8');
  fs.writeFileSync('src/globals.js', globalsSrc, 'utf8');

  // 3. Update index.html to include globals.js and legacy.js
  let newHtml = fs.readFileSync('index.html', 'utf8');
  
  // Clean up any previous attempts if they exist
  newHtml = newHtml.replace(/<script type='module' src='src\/globals\.js'><\/script>\n/g, '');
  newHtml = newHtml.replace(/<script src='src\/legacy\.js' defer><\/script>\n/g, '');
  
  const scriptInsert = `<script type='module' src='src/globals.js'></script>
<script src='src/legacy.js' defer></script>
<script type='module' src='src/app.js'></script>`;

  newHtml = newHtml.replace(/<script type='module' src='src\/app\.js'><\/script>/, scriptInsert);
  fs.writeFileSync('index.html', newHtml, 'utf8');

  console.log('Legacy script extraido, globals.js criado, e index.html atualizado.');
} catch(e) {
  console.error(e);
}
