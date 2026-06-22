---
title: Rotas
tags: [rotas, endpoints, api]
---

# 🛣️ Rotas (Endpoints)

Veja também: [[Início]] · [[Autenticação]] · [[Convenções]]
Base URL: `http://localhost:3354` · Swagger: `/doc`

## Aplicação
| Método | Rota | Descrição | Módulo |
|---|---|---|---|
| GET | `/` | Status/healthcheck da API | RootController ([[Arquitetura]]) |

## [[Vendedoras]]
| Método | Rota | Descrição |
|---|---|---|
| POST | `/vendedoras/login` | Login da vendedora; retorna `usuario` + `vendedora` |

Body: `{ "usu_login": "JULIANA.FERREIRA", "usu_senha": "12345" }`

## [[Usuarios]]
| Método | Rota | Descrição |
|---|---|---|
| POST | `/usuarios` | Cria usuário (senha→MD5, login→MAIÚSCULO) |
| GET | `/usuarios/login` | **Login por query** `?usu_login=...&usu_senha=...` |
| GET | `/usuarios` | Lista ativos (`usu_ativo = 1`) |
| GET | `/usuarios/:usu_cod` | Busca por código |
| PATCH | `/usuarios/:usu_cod` | Atualiza (parcial) |
| DELETE | `/usuarios/:usu_cod` | **Soft delete** (`usu_ativo = 0`) |

> ⚠️ `GET /usuarios/login` foi declarado **antes** de `GET /usuarios/:usu_cod` no controller
> para a palavra `login` não cair na rota de busca por id.

## [[Fashionstars]]
| Método | Rota | Descrição |
|---|---|---|
| GET | `/fashionstars` | Lista ativos (`ativo = 'S'`) |
| GET | `/fashionstars/:cpfcnpj` | Busca por CPF/CNPJ + cálculo de saldo |

## Respostas padrão
- `200/201` sucesso · `400` validação · `401` credenciais · `404` não encontrado · `409` login duplicado.
- Nenhuma resposta inclui `usu_senha` (ver [[Convenções]]).
