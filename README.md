# NovaAPIBabita

API backend do ecossistema **Think!/Babita**, consumida pelo front **Lovable** (NovaApiBabitaLovable). Expõe autenticação de usuários/vendedoras e relatórios da operação (FashionStar / Liga).

## Stack
- **NestJS** + **TypeScript**
- **Prisma** (PostgreSQL — banco `bd_think`)
- **JWT** + **bcrypt**; senhas legadas em **MD5** (tabela `erp_usuario`)
- **Swagger** (OpenAPI) em `/doc`

## Setup
```bash
npm install
npx prisma generate      # gera o client em generated/prisma
npm run start:dev        # desenvolvimento (watch)
npm run start:prod       # produção: node dist/main
```

## Variáveis de ambiente (.env)
| Var | Descrição |
|-----|-----------|
| `PORT` | Porta HTTP da API |
| `DATABASE_URL` | Conexão Postgres (`bd_think`) |
| `JWT_SECRET` | Segredo de assinatura dos tokens JWT |
| `SETUP_SECRET` | Segredo do endpoint de setup inicial |
| `AMBIENTE` | `DESENVOLVIMENTO` habilita o Swagger em `/doc` |

> O `.env` **não** é versionado (está no `.gitignore`).

## Documentação
Com `AMBIENTE=DESENVOLVIMENTO`, a UI do Swagger fica em **`/doc`** (ex.: https://api.lovable.babita.com.br/doc).

## Endpoints atuais
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/` | Healthcheck / status |
| POST | `/vendedoras/login` | Login da vendedora (login + senha MD5) |
| POST | `/usuarios/login` | Login de usuário (MD5) |
| GET/POST/PATCH/DELETE | `/usuarios` | CRUD de usuários (`erp_usuario`, soft-delete via `usu_ativo`) |
| GET | `/fashionstars` · `/fashionstars/{cpfcnpj}` | Consulta FashionStar (estrelas, pontos, saldo) |
| GET | `/meta-vendedoras/liga` | Total de venda da Liga por vendedora |

## Estrutura
```
src/
  main.ts                 # bootstrap + Swagger
  modules/
    root/                 # módulo raiz (agrega as rotas)
    routes/               # vendedoras, usuarios, fashionstars, metaVendedoras
    auth/                 # autenticação (JWT)
    tools/                # helpers (hash, formatters)
  services/               # PrismaService, AuthGuard
prisma/schema.prisma      # espelho do banco bd_think
```

## Convenções
- Login sempre `UPPERCASE` + `trim`; senha em **MD5** (`erp_usuario`).
- Toda rota nova: decorators Swagger (`@ApiTags`/`@ApiOperation`/`@ApiResponse`) + tag registrada em `main.ts`.
- Selects pesados via `prisma.$queryRawUnsafe`.

---
_Babita — Tecnologia._
