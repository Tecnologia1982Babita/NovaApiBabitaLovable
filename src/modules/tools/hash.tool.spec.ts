import { describe, expect, test } from 'vitest';
import { hashHelper } from './hash.tool';

describe('Bateria de testes para o hashtool', () => {
  test('Testando hasheamento e comparação da string', async () => {
    const clean_password = '1q2w3e';
    const hash_password = await hashHelper.generate(clean_password);
    expect(await hashHelper.compare(clean_password, hash_password)).toBe(true);
  });

  test('Testando hasheamento e comparação com senha inválida', async () => {
    const clean_password = '1q2w3e';
    const invalid_password = '123456'; // Uma senha diferente
    const hash_password = await hashHelper.generate(clean_password);
    expect(await hashHelper.compare(invalid_password, hash_password)).toBe(
      false,
    );
  });

  test('Testando hasheamento e comparação com senha vazia', async () => {
    const clean_password = '';
    const hash_password = await hashHelper.generate(clean_password);
    expect(await hashHelper.compare(clean_password, hash_password)).toBe(true);
  });

  test('Testando o método encrypt', async () => {
    const text = 'Texto para teste de hashing irreversível';
    const result = await hashHelper.encrypt(text);
    expect(result).not.toBe(text);
  });
});
