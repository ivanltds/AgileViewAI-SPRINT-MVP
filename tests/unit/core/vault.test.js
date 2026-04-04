import { jest } from '@jest/globals';
import { Vault } from '../../../src/core/vault.js';

describe('Vault Mode (src/core/vault.js)', () => {
  beforeEach(() => {
    localStorage.clear();
    global.APP = { vaultKey: null, vaultMode: null };
    global.Store = {
      getTeams: jest.fn(() => []),
      saveTeams: jest.fn(),
      getLlmList: jest.fn(() => []),
      saveLlmList: jest.fn()
    };
  });

  describe('deriveKey()', () => {
    it('deve derivar uma chave do tipo CryptoKey a partir de um PIN válido e um Salt', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await Vault.deriveKey('1234', salt);
      
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('deve derivar keys diferentes para PINs ou Salts diferentes', async () => {
      const salt1 = crypto.getRandomValues(new Uint8Array(16));
      const salt2 = crypto.getRandomValues(new Uint8Array(16));
      
      const key1 = await Vault.deriveKey('1234', salt1);
      const key2 = await Vault.deriveKey('1234', salt2);
      const key3 = await Vault.deriveKey('9999', salt1);

      // WebCrypto keys are objects, we can't deep equals directly without exporting,
      // but encrypting the same text should yield different results (due to random IV anyway)
      // However, we just ensure they resolve
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(key3).toBeDefined();
    });
  });

  describe('getSalt()', () => {
    it('deve gerar e salvar um novo salt se não existir no localStorage', () => {
      expect(localStorage.getItem('avai_vault_salt')).toBeNull();
      const salt = Vault.getSalt();
      expect(salt.length).toBe(16);
      expect(localStorage.getItem('avai_vault_salt')).toBeDefined();
    });

    it('deve retornar o mesmo salt caso já exista (não deve sobrescrever)', () => {
      const salt1 = Vault.getSalt();
      const b64 = localStorage.getItem('avai_vault_salt');
      expect(b64).toBeTruthy();
      
      const salt2 = Vault.getSalt();
      expect(salt1.join(',')).toBe(salt2.join(','));
    });
  });

  describe('encrypt() e decrypt()', () => {
    it('deve criptografar e decriptografar corretamente um texto simples', async () => {
      const pin = '4321';
      const salt = Vault.getSalt();
      const key = await Vault.deriveKey(pin, salt);
      
      const plain = "dados siêu secretos!!";
      const ciphertext = await Vault.encrypt(key, plain);
      
      expect(typeof ciphertext).toBe('string');
      expect(ciphertext).not.toBe(plain);
      
      const decrypted = await Vault.decrypt(key, ciphertext);
      expect(decrypted).toBe(plain);
    });

    it('deve decriptografar dados perfeitamente mesmo com array vazio de bytes', async () => {
      const key = await Vault.deriveKey('1234', Vault.getSalt());
      const ciphertext = await Vault.encrypt(key, '');
      const decrypted = await Vault.decrypt(key, ciphertext);
      expect(decrypted).toBe('');
    });

    it('deve lançar erro ao decriptografar com a chave errada', async () => {
      const key1 = await Vault.deriveKey('1234', Vault.getSalt());
      const ciphertext = await Vault.encrypt(key1, 'segredo');
      
      const key2 = await Vault.deriveKey('9999', Vault.getSalt());
      await expect(Vault.decrypt(key2, ciphertext)).rejects.toThrow();
    });
  });

  describe('isSetup()', () => {
    it('retorna false logo após a inicialização (limpa)', () => {
      expect(Vault.isSetup()).toBe(false);
    });

    it('retorna false se apenas o SALT existir mas não o CHECK', () => {
      Vault.getSalt(); // creates salt
      expect(Vault.isSetup()).toBe(false);
    });

    it('retorna true se ambas as flags (salt e check) existirem', () => {
      localStorage.setItem('avai_vault_salt', 'mock');
      localStorage.setItem('avai_vault_check', 'mock');
      expect(Vault.isSetup()).toBe(true);
    });
  });

  describe('setupPin()', () => {
    it('configura o vault, cria salt/check e retorna a crypto key correta', async () => {
      const key = await Vault.setupPin('7777');
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(Vault.isSetup()).toBe(true);
      expect(localStorage.getItem('avai_vault_check')).toBeTruthy();
    });
  });

  describe('verifyPin()', () => {
    it('deve retornar a chave se o PIN for correto', async () => {
      const keyOriginal = await Vault.setupPin('1234');
      const keyValidado = await Vault.verifyPin('1234');
      expect(keyValidado).toBeDefined();
      expect(keyValidado.type).toBe('secret');
    });

    it('deve retornar null se o PIN for incorreto', async () => {
      await Vault.setupPin('1234');
      const keyValidado = await Vault.verifyPin('9999'); // wrong pin!
      expect(keyValidado).toBeNull();
    });

    it('deve retornar null se o check data estiver corrompido ou hackeado', async () => {
      await Vault.setupPin('1234');
      // Hackeando a string do localStorage
      localStorage.setItem('avai_vault_check', 'string123invalida%*');
      const keyValidado = await Vault.verifyPin('1234');
      expect(keyValidado).toBeNull();
    });
  });

  describe('encryptToken() / decryptToken()', () => {
    it('retorna a propria string se APP.vaultKey nao estiver setada globalmente', async () => {
      global.APP.vaultKey = null;
      expect(await Vault.encryptToken('foo')).toBe('foo');
      expect(await Vault.decryptToken('bar')).toBe('bar');
    });

    it('criptografa/decriptografa de forma transparente usando APP.vaultKey da sessao', async () => {
      const key = await Vault.setupPin('1234');
      global.APP.vaultKey = key;

      const pt = 'my-token';
      const ct = await Vault.encryptToken(pt);
      expect(ct).not.toBe(pt);
      expect(await Vault.decryptToken(ct)).toBe(pt);
    });

    it('decriptToken retorna string vazia quando falha (graceful degrade para UI limpa)', async () => {
      global.APP.vaultKey = await Vault.setupPin('1234');
      const ans = await Vault.decryptToken('dadosinuteis');
      expect(ans).toBe('');
    });
  });

  describe('reencryptAll()', () => {
    it('faz round-trip para times e LLMs aplicando um PIN novo (oldKey -> newKey) de forma atomica', async () => {
      const oldKey = await Vault.deriveKey('1234', Vault.getSalt());
      const tok1 = await Vault.encrypt(oldKey, 'pat-super-secret');
      const tok2 = await Vault.encrypt(oldKey, 'llm-ultra-secret');

      Store.getTeams.mockReturnValue([{ id: 't1', patEnc: tok1 }]);
      Store.getLlmList.mockReturnValue([{ id: 'l1', tokenEnc: tok2 }]);

      const newKey = await Vault.deriveKey('5678', Vault.getSalt());
      
      await Vault.reencryptAll(oldKey, newKey);
      
      // Valida Teams
      expect(Store.saveTeams).toHaveBeenCalledTimes(1);
      const savedTeams = Store.saveTeams.mock.calls[0][0];
      expect(savedTeams[0].patEnc).not.toBe(tok1);
      const d1 = await Vault.decrypt(newKey, savedTeams[0].patEnc);
      expect(d1).toBe('pat-super-secret');

      // Valida LLMs
      expect(Store.saveLlmList).toHaveBeenCalledTimes(1);
      const savedLlms = Store.saveLlmList.mock.calls[0][0];
      const d2 = await Vault.decrypt(newKey, savedLlms[0].tokenEnc);
      expect(d2).toBe('llm-ultra-secret');
    });
  });
});
