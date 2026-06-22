import { describe, expect, test } from 'vitest';
import { FormatTools } from './formatter.tool';

describe('Bateria de testes para o FormatTools', () => {
  test('testando formatacao em CamelCase', () => {
    const formatTools = new FormatTools();
    expect(formatTools.formatCamelCase('ALAN RAMALHO')).toBe('Alan Ramalho');
  });

  test('Testando formatacao de CNPJ', () => {
    const formatTools = new FormatTools();
    expect(formatTools.formatCNPJ('12345678901234')).toBe('12.345.678/9012-34');
  });

  test('Testando formatacao de CPF', () => {
    const formatTools = new FormatTools();
    expect(formatTools.formatCPF('12345678901')).toBe('123.456.789-01');
  });

  test('Testando formatacao automatica CNPJ e CPF de acordo com entrada', () => {
    const formatTools = new FormatTools();

    expect(formatTools.formatBothCPFnCNPJ('39820883000111')).toBe(
      '39.820.883/0001-11',
    );
    expect(formatTools.formatBothCPFnCNPJ('12232112313')).toBe(
      '122.321.123-13',
    );
  });
});
