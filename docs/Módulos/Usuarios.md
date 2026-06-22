---
title: Módulo Usuarios
tags: [módulo, crud, usuarios]
---

# 👤 Módulo Usuarios

Pasta: `src/modules/routes/usuarios/` · Tabela: [[erp_usuario]]
Veja também: [[Rotas]] · [[Autenticação]] · [[Convenções]]

## Responsabilidade
CRUD da [[erp_usuario]] + autenticação por login/senha.

## Arquivos
- `usuarios.controller.ts` — rotas + Swagger ([[Convenções|regra do Swagger]])
- `usuarios.service.ts` — regra de negócio + Prisma
- `usuarios.module.ts` — registra no [[Arquitetura|RootModule]]
- `dto/create-usuario.dto.ts`, `dto/update-usuario.dto.ts` (PartialType), `dto/login-usuario.dto.ts`

## Endpoints
| Método | Rota | Service |
|---|---|---|
| POST | `/usuarios` | `create` |
| GET | `/usuarios/login?usu_login=&usu_senha=` | `login` |
| GET | `/usuarios` | `findAll` (só `usu_ativo = 1`) |
| GET | `/usuarios/:usu_cod` | `findOne` |
| PATCH | `/usuarios/:usu_cod` | `update` |
| DELETE | `/usuarios/:usu_cod` | `remove` (soft delete) |

## Regras-chave
- `usu_login` → `.trim().toUpperCase()`; `usu_senha` → MD5 (ver [[Autenticação]]).
- Respostas **sem** `usu_senha` (`omit`).
- Login duplicado → `409` (Prisma `P2002`).
- `DELETE` = **soft delete** (`usu_ativo = 0`) para não quebrar FKs (`erp_usuario_acesso`, `fr_usuario_sistema`).
- `GET /usuarios/login` declarado antes de `:usu_cod` (evita colisão de rota).
