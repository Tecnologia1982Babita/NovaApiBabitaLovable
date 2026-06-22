---
title: Módulo Fashionstars
tags: [módulo, consulta, fashionstars]
---

# ⭐ Módulo Fashionstars

Pasta: `src/modules/routes/fashionstars/` · Tabela: `adfashionstars`
Veja também: [[Rotas]] · [[Arquitetura]]

> Módulo **pré-existente** (não criado nesta rodada). Serviu de **referência de padrão**
> para [[Usuarios]] e [[Vendedoras]] (controller fino → service → Prisma).

## Endpoints
| Método | Rota | Service |
|---|---|---|
| GET | `/fashionstars` | `findAll` — lista `ativo = 'S'`, ordenado por `id` |
| GET | `/fashionstars/:cpfcnpj` | `findOne` — busca + formata datas + calcula `saldoAtual` |

## Lógica de destaque (`findOne`)
- Normaliza `cpfcnpj` (remove não-dígitos).
- Formata datas para `pt-BR`.
- `saldoAtual = pontosfashion - compra7mes + mesatual`.
- `404` se não encontrar.
