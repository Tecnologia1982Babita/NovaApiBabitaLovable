/**
 * Vendedoras que sairam da empresa.
 *
 * Elas nao podem mais aparecer como dona do cliente (`vendedora_proprietaria`) nem como
 * vendedora de referencia (`view_base_12meses.ven_nome`) em nenhuma rota. O cliente
 * CONTINUA na lista: so a atribuicao muda - cai para a ultima vendedora que o atendeu
 * na janela, e fica nulo quando nao houve nenhuma outra.
 *
 * Por que lista manual: o banco nao tem de onde deduzir isso. `erp_vendedores` nao tem
 * coluna de ativo, e `erp_usuario.ven_numero` repete - o codigo 85 bate em 5 usuarios
 * (PRISCILA.MATEUS, ROSIANE.FERNADES, ALESSANDRA.NASCIMENTO, BARBARA.HELLEN e
 * MODIGLIANY.ADELAIDE), todos com `usu_ativo = 1`, e `usu_loja` e nulo.
 *
 * 16/09/2026 - 85 = MODIGLIANY (ven_loja 8), ultima venda em 14/08/2026.
 */
export const VENDEDORAS_FORA: number[] = [85];

/** Codigo da vendedora (`vendedora_proprietaria.codigovend`, `erp_vendedores.ven_numero`). */
export function foraPorCodigo(coluna: string): string {
  if (VENDEDORAS_FORA.length === 0) return 'TRUE';
  return `COALESCE(${coluna},0) NOT IN (${VENDEDORAS_FORA.join(',')})`;
}

/**
 * Nome da vendedora: `view_base_12meses` nao tem coluna com o codigo, so `ven_nome`.
 * O nome sai do proprio codigo (via `erp_vendedores`), entao a lista acima continua
 * sendo a unica fonte da verdade - nao existe nome repetido aqui para sair do ar.
 */
export function foraPorNome(coluna: string): string {
  if (VENDEDORAS_FORA.length === 0) return 'TRUE';
  return `btrim(COALESCE(${coluna},'')) NOT IN (
            SELECT btrim(ven_nome) FROM erp_vendedores
            WHERE ven_numero IN (${VENDEDORAS_FORA.join(',')}) AND ven_nome IS NOT NULL
          )`;
}
