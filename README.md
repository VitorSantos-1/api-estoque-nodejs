# API de Estoque (Node.js + Express + MySQL)

API REST de estoque ("falcons-stock-api") construída em Node.js/Express com MySQL2, demonstrando
back-end e banco relacional com um front-end simples em HTML para teste. O projeto exemplifica a
construção de um serviço REST configurável e conectado a um banco relacional, base para qualquer
integração de estoque.

> **Nota de confidencialidade:** os dados presentes neste repositório são fictícios, gerados apenas
> para demonstração. Os dados reais da operação são confidenciais e estão protegidos — nenhum dado
> real, credencial ou informação de terceiros foi incluído aqui.

---

## Visão Geral

O serviço expõe endpoints REST para consulta e manipulação de dados de estoque, conectando-se a um
banco MySQL definido por um schema versionado. A configuração (banco, CORS, portas) é feita por
variáveis de ambiente, e um front-end de teste em HTML permite exercitar a API sem ferramentas externas.

## Contexto de Negócio

O controle de estoque é o coração operacional do varejo: falta de produto vira ruptura e venda perdida;
excesso vira capital parado e risco de perda. Antes de qualquer dashboard, é preciso um serviço que
exponha o dado de estoque de forma padronizada para outros sistemas consumirem. Esta API cumpre esse
papel de base — a camada de acesso sobre a qual integrações e telas se apoiam.

## O Problema que Resolve

- **Dado de estoque preso** em um banco sem uma interface de acesso padronizada.
- **Falta de uma camada REST** para outros sistemas consumirem os dados.
- **Configuração rígida:** conexão e CORS que precisam variar por ambiente.

## Público e Decisões Apoiadas

- **Integrações e front-ends:** consomem o estoque por uma API padronizada.
- **Operação:** consulta dados de estoque a partir de uma fonte única.

## Impacto e Valor Gerado

- Disponibiliza o estoque por uma API REST reutilizável por outros sistemas.
- Isola a configuração (banco, CORS) em variáveis de ambiente, facilitando o deploy.
- Entrega um banco relacional versionado (`schema.sql`) como base do serviço.

---

## Arquitetura e Abordagem Técnica

- **API REST em Express** com CORS configurável e variáveis de ambiente (`dotenv`).
- **Banco relacional MySQL** definido em `schema.sql` (via driver MySQL2).
- **Front-end de teste** (`index.client.html`) para exercitar os endpoints.

## Stack

Node.js - Express - MySQL2 - REST API - JavaScript - HTML - dotenv.

## Como Rodar

```bash
npm install
copy .env.example .env      # configure a conexão MySQL
mysql -u root < schema.sql
npm start                   # sobe a API
```

## Estrutura do Projeto

```text
schema.sql          -> Definição do banco relacional (MySQL)
index.client.html   -> Front-end simples de teste da API
.env.example        -> Modelo de variáveis de ambiente (sem segredos)
```

## Autor

José Vitor Santos Pinheiro — Análise de Dados e Inteligência Comercial (Varejo e Supply Chain).
Contato: vytorsantt@gmail.com
