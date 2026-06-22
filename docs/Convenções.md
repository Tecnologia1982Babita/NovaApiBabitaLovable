---
title: Convenções
tags: [convenções, padrões, swagger]
---

# 📐 Convenções de Código

Veja também: [[Arquitetura]] · [[Autenticação]] · [[Início]]

## Padrão de um módulo de rota
Cada recurso vive em `src/modules/routes/<nome>/`:
```
<nome>.controller.ts   # rotas finas + Swagger
<nome>.service.ts      # regra de negócio + Prisma
<nome>.module.ts       # imports: [PrismaModule]
dto/*.dto.ts           # class-validator + @ApiProperty
```
Registre o módulo em `RootModule` (`src/modules/root/root.module.ts`).

## 🔑 REGRA: toda rota nova DEVE ser documentada no Swagger
Sempre que adicionar/alterar uma rota, aplicar os decorators:
- `@ApiTags('<Grupo>')` no controller — e **adicionar a tag em `main.ts` → `createSwaggerConfig()`**.
- `@ApiOperation({ summary, description })` em cada handler.
- Respostas: `@ApiOkResponse` / `@ApiCreatedResponse` / `@ApiUnauthorizedResponse` /
  `@ApiNotFoundResponse` / `@ApiConflictResponse` / `@ApiBadRequestResponse`.
- `@ApiParam` para path params; o DTO em `@Query()`/`@Body()` gera os campos via `@ApiProperty`.

Exemplo (ver [[Usuarios]] e [[Vendedoras]] para o código real):
```ts
@ApiOperation({ summary: 'Cria um novo usuário' })
@ApiCreatedResponse({ description: 'Usuário criado (sem senha).' })
@ApiConflictResponse({ description: 'Login já existe.' })
@Post()
create(@Body() body: CreateUsuarioDto) { ... }
```
> Swagger só é montado quando `AMBIENTE === 'DESENVOLVIMENTO'` (ver `main.ts`). UI em `/doc`.

## Normalização de credenciais
- `usu_login` → **sempre** `.trim().toUpperCase()` (os logins no banco são MAIÚSCULOS).
- `usu_senha` → `.trim()` e gravada/comparada em **MD5**. Ver [[Autenticação]].

## Validação
- `ValidationPipe` global com `whitelist: true` + `forbidNonWhitelisted: true`
  (em `main.ts`). Campos fora do DTO → `400`. **Não há `transform`** — query chega como string.

## Banco / Prisma
- Nunca retornar `usu_senha` em respostas → usar `omit: { usu_senha: true }`.
- Erro de unique (login duplicado) → Prisma lança `P2002` → mapear para `409 Conflict`.
- Após editar `schema.prisma`: `npx prisma generate` (seguro, **não toca no banco**).
- ❌ Nunca rodar `prisma migrate reset` / `db push` / `migrate` (alteram/zeram o banco).

## Nomes
- Models/colunas seguem o ERP: prefixos `usu_`, `ven_`, `pes_`, etc. Ver [[erp_usuario]].
