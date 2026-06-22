---
title: Tabela erp_usuario
tags: [banco, tabela, usuarios]
---

# 🗃️ erp_usuario

Banco: `bd_think` (CLOUD) · Model Prisma: `erp_usuario`
Usada por: [[Usuarios]], [[Vendedoras]], [[Autenticação]]

## Colunas
| Coluna | Tipo | Notas |
|---|---|---|
| `usu_cod` | int (PK, auto) | Identificador |
| `usu_login` | varchar(50) **unique** | Sempre MAIÚSCULO (ver [[Convenções]]) |
| `usu_senha` | varchar(64) | **MD5** (32 chars) — ver [[Autenticação]] |
| `usu_email` | varchar(120) | default `'0'` |
| `usu_ativo` | int | `1` = ativo, `0` = inativo (soft delete) |
| `usu_datinc` | timestamptz | default `now()` |
| `usu_datalt` | timestamptz | atualizado em update/soft delete |
| `usu_usuinc` / `usu_usualt` | int | quem incluiu/alterou (CODUSU) |
| `pes_cod` | int | → `erp_pessoa.pes_cod` |
| `ven_numero` | int | → [[erp_vendedores]]`.ven_numero` |
| `usu_tipo` | int | `1` = vendedora (135 regs); `0/2/3/4` outros; `null` diversos |
| `usu_loja` | varchar(10) | Código da loja |

## Relações
- `erp_usuario_acesso[]` e `fr_usuario_sistema[]` referenciam `usu_cod`
  → por isso o DELETE é **soft** (ver [[Usuarios]]).
- `ven_numero` liga à [[erp_vendedores]] (nome da vendedora).

## Não confundir com `usuarios`
A tabela `usuarios` (id/email/senha/nivel) é **outra**, está **vazia** e pertence ao [[Legado]].
O sistema atual usa **`erp_usuario`**.
