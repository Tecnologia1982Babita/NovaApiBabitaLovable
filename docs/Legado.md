---
title: Legado (ignorado no build)
tags: [legado, build, atenção]
---

# 🗑️ Legado — o que foi ignorado e por quê

Veja também: [[Arquitetura]] · [[Autenticação]] · [[Convenções]]

## Contexto
Ao regenerar o Prisma Client (`npx prisma generate`, necessário e seguro), ficou exposto que
parte do código antigo estava **desalinhado com o schema atual** e não compilava mais.
Esse código já estava quebrado em runtime — só não aparecia porque o client gerado estava velho.

## O que foi tirado do build
Em `tsconfig.build.json` (campo `exclude`):
- `src/modules/app/` — pasta inteira. Continha `AppController` (`POST /initial-setup`) e
  `AppService`, que faziam `usuarios.create({ LOGIN, SENHA })` — colunas que **não existem**
  na tabela `usuarios` (que tem só `id/email/senha/nivel` e está **vazia**).
- `src/modules/auth/auth.service.ts`, `auth.controller.ts`, `auth.module.ts` —
  login antigo (`/auth/login`, bcrypt) sobre a tabela `usuarios`, usando `LOGIN/SENHA/CODUSU`
  inexistentes. Quebrado.

## O que foi mantido (não dá erro)
- `src/modules/auth/constants/` e `auth/dto/` — usados por `auth.guard`.
- `src/services/auth.guard.ts` — guard JWT, presente mas **não ativo** (ver [[Autenticação]]).

## Substituição
- O `main.ts` agora usa **`RootModule`** no lugar do `AppModule` (ver [[Arquitetura]]).
- A rota raiz quebrada foi substituída por `GET /` (status) no `RootController`.

## ⚠️ Se for reativar o auth
Será preciso alinhar `auth.service`/`app.service` à tabela `usuarios` real (`id/email/senha/nivel`)
ou apontar para a tabela certa, e então remover as exclusões do `tsconfig.build.json`.
