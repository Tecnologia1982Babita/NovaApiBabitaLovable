---
title: Módulo Vendedoras
tags: [módulo, login, vendedoras]
---

# 🛍️ Módulo Vendedoras

Pasta: `src/modules/routes/vendedoras/` · Tabelas: [[erp_usuario]] + [[erp_vendedores]]
Veja também: [[Rotas]] · [[Autenticação]] · [[Usuarios]]

## Responsabilidade
Login específico de vendedoras, retornando os dados do usuário **e** da vendedora vinculada.

## Endpoint
| Método | Rota | Service |
|---|---|---|
| POST | `/vendedoras/login` | `login` |

Body: `{ "usu_login": "...", "usu_senha": "..." }`

## Fluxo do `login`
1. Normaliza login (MAIÚSCULO/trim) e senha (trim) — ver [[Autenticação]].
2. MD5 da senha → busca em [[erp_usuario]] por `usu_login`.
3. Valida ativo + senha (`401` se falhar).
4. Se `ven_numero != null`, busca [[erp_vendedores]] por `ven_numero` (pega `ven_nome`).
5. Retorna `{ autenticado, usuario (sem senha), vendedora }`.

## Relação com [[Usuarios]]
A lógica de validação é idêntica à do `GET /usuarios/login`. Se um dia quiser unificar,
o de vendedoras é o que enriquece com [[erp_vendedores]].
