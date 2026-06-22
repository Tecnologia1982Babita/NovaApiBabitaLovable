---
title: Arquitetura
tags: [arquitetura, nestjs, prisma]
---

# 🏗️ Arquitetura

Veja também: [[Início]] · [[Convenções]] · [[Autenticação]]

## Stack
- **NestJS 11** (TypeScript) — módulos, controllers, services, DTOs, `ValidationPipe` global.
- **Prisma 6.10** — ORM. Client gerado em `generated/prisma/` a partir de `prisma/schema.prisma`.
- **Banco**: PostgreSQL `bd_think` na **CLOUD** (177.70.12.42:5432). Conexão em `.env` → `DATABASE_URL`.
- Swagger (`@nestjs/swagger`), `cookie-parser`, `bodyParser` (limite 50mb).

## Camadas (fluxo de uma request)
```
HTTP → Controller (rota + DTO + Swagger) → Service (regra de negócio) → PrismaService → Postgres
```
- **Controller**: fino. Só recebe/valida (via DTO) e delega ao service. Documenta no [[Convenções|Swagger]].
- **Service**: regra de negócio, acesso ao banco via `PrismaService` injetado.
- **DTO**: validação (`class-validator`) + documentação (`@ApiProperty`).
- **Module**: amarra controller + service e importa `PrismaModule`.

## Módulo raiz: `RootModule`
`src/main.ts` cria a app a partir de **`RootModule`** (`src/modules/root/root.module.ts`),
que agrega só os módulos funcionais:
- [[Vendedoras|VendedorasModule]]
- [[Usuarios|UsuariosModule]]
- [[Fashionstars|FashionstarsModule]]
- `RootController` → `GET /` (status/healthcheck)

> ⚠️ O `AppModule` da pasta `src/modules/app/` é **legado** e NÃO é usado. Detalhes em [[Legado]].

## Estrutura de pastas
```
src/
  main.ts                      # bootstrap → RootModule
  modules/
    root/                      # módulo raiz + healthcheck
    routes/
      usuarios/                # CRUD + login GET  → [[Usuarios]]
      vendedoras/              # login POST        → [[Vendedoras]]
      fashionstars/            # consulta          → [[Fashionstars]]
    tools/                     # hash (md5/sha256), formatter
    global/                    # entities/interfaces compartilhadas
    app/    (LEGADO, ver [[Legado]])
    auth/   (parcial LEGADO, ver [[Legado]])
  services/
    prisma.service.ts / prisma.module.ts
    auth.guard.ts              # existe mas NÃO está ativo globalmente
generated/prisma/              # client Prisma (gerado, não editar à mão)
docs/                          # este vault
```

## Como rodar / buildar
- `npm run start:dev` — dev (watch)
- `npm run build` — gera `dist/` (usa `tsconfig.build.json`, que exclui o legado — ver [[Legado]])
- `npm run start:prod` — `node dist/main`
