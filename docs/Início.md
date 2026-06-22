---
title: NovaAPIBabita — Início
tags: [moc, api, nestjs, babita]
atualizado: 2026-06-01
---

# 🏠 NovaAPIBabita — Mapa do Sistema

> Documentação viva (estilo Obsidian) para **IA e devs** entenderem rapidamente a API.
> Comece por aqui e siga os `[[wikilinks]]`.

## O que é
API REST do ecossistema **Think! Babita**, em **NestJS + TypeScript + Prisma**, que expõe
dados do ERP (banco `bd_think` na **CLOUD**). Pacote npm: `backend-horta`.

- **Servidor**: `Servicos` (192.168.0.202), pasta `/tibabita_scripts/node/BackEnd/NovaAPIBabita/`
- **Porta**: `3354` (ver `.env` → `PORT`)
- **Swagger** (só em DESENVOLVIMENTO): `http://localhost:3354/doc`

## Navegação
- [[Arquitetura]] — camadas, fluxo de uma request, módulo raiz
- [[Rotas]] — todos os endpoints expostos
- [[Autenticação]] — login, MD5, normalização de credenciais
- [[Convenções]] — padrões de código e **regra do Swagger**
- [[Legado]] — o que foi ignorado e por quê
- Módulos: [[Usuarios]] · [[Vendedoras]] · [[Fashionstars]]
- Banco: [[erp_usuario]] · [[erp_vendedores]]

## Estado atual (jun/2026)
- Módulo raiz é **[[Arquitetura|RootModule]]** (NÃO o `AppModule` legado).
- Rotas ativas: `GET /` · `POST /vendedoras/login` · `GET /usuarios/login` · CRUD `/usuarios` · `GET /fashionstars`.
- Pasta `app` e `auth.service` legados estão **fora do build** (ver [[Legado]]).
