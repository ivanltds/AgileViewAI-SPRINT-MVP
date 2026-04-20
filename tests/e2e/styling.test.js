import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';

describe('E2E: Styling Integrity', () => {
    test('base.css deve conter a padronização visual completa para campos de seleção (select)', () => {
        const filePath = path.resolve(process.cwd(), 'src/styles/base.css');
        const content = fs.readFileSync(filePath, 'utf8');

        // Verify if generic select elements are being properly styled
        expect(content).toContain('select, .qual-select, .ef-sprint-select {');
        expect(content).toContain('appearance: none;');
        expect(content).toContain('background-image: url("data:image/svg+xml');
        expect(content).toContain('padding-right: 36px;');
        
        // Ensure focus states are handled
        expect(content).toContain('select:focus, .qual-select:focus, .ef-sprint-select:focus {');
        expect(content).toContain('border-color: var(--blue);');
    });
});
