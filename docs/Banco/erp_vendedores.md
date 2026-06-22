---
title: Tabela erp_vendedores
tags: [banco, tabela, vendedoras]
---

# 🗃️ erp_vendedores

Banco: `bd_think` (CLOUD) · Model Prisma: `erp_vendedores`
Usada por: [[Vendedoras]]

## Colunas
| Coluna | Tipo | Notas |
|---|---|---|
| `ven_cod` | int (PK, auto) | Identificador da linha |
| `ven_numero` | int | **Chave de ligação** com [[erp_usuario]]`.ven_numero` |
| `ven_nome` | varchar(100) | Nome da vendedora |
| `ven_loja` | int | Loja |
| `ven_data` / `ven_datinc` / `ven_datalt` | date/timestamp | Datas |
| `ven_usuinc` / `ven_usualt` | int | Auditoria |

## Uso
No login de [[Vendedoras]], após autenticar em [[erp_usuario]], busca-se aqui por
`ven_numero` para enriquecer a resposta com `ven_nome` (e demais dados da vendedora).

> Obs.: a junção é por `ven_numero` (não por `ven_cod`).
