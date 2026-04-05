import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';

describe('E2E: Encoding Integrity', () => {
    test('index.html deve conter acentos perfeitamente codificados e não os quebrar', () => {
        const filePath = path.resolve(process.cwd(), 'index.html');
        const content = fs.readFileSync(filePath, 'utf8');

        expect(content).toContain('Sessão');
        expect(content).toContain('Eficiência');
        expect(content).toContain('Configurações');
        expect(content).toContain('Organizações');
        
        // Checagem garantindo que o encode ansi/latin não invada
        expect(content).not.toContain('SessÃ£o');
        expect(content).not.toContain('EficiÃªncia');
        expect(content).not.toContain('ConfiguraÃ§Ãµes');
    });
});
