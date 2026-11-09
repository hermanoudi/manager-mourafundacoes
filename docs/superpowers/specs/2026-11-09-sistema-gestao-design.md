# Sistema de Gestão — Moura Fundações (design)

Data: 2026-11-09 · Autor: Hermano Flávio de Moura (com Claude)

## 1. Contexto

A Moura Fundações (Uberlândia/MG) executa **estacas escavadas com trado mecânico** com perfuratriz e
equipe próprias, atendendo Triângulo Mineiro, GO e MT. Faixa executável: **diâmetro 25–80 cm,
profundidade até 22 m** (site). A cobrança é **por metro perfurado, por diâmetro**, mais
**mobilização** (ver `mourafundacoes-agent/pricing.md`: 30–70 cm, até 15 m tabelado, fora disso "a
negociar"). Pagamento por boleto ou PIX após a execução. Clientes típicos: construtoras (MRV, Conel...).

Já existe um agente de orçamentos por WhatsApp (`/home/hermano/projetos/mourafundacoes-agent`). Este
sistema é **separado** (repositório e banco próprios); a integração "orçamento aprovado → obra" fica
para uma fase futura via API.

## 2. Objetivo

Um sistema de gestão que cubra o ciclo **cliente → obra → medição das perfurações → faturamento
(NFS-e + boleto Sicoob) → contas a receber**, além de **contas a pagar** e cadastro de perfuratrizes,
usável no notebook, no **Galaxy S23** e no **iPhone 14 Pro**.

## 3. Usuários e papéis

| Papel | Quem | Pode |
|---|---|---|
| `admin` | dono | tudo, inclusive usuários |
| `office` | escritório/financeiro | clientes, obras, aprovar medições, faturar, financeiro |
| `operator` | operador da perfuratriz | ver obras em que está alocado, lançar/enviar medições (foto ou digitação) |

## 4. Módulos

1. **Clientes** — PF/PJ, CPF ou CNPJ (inclui **CNPJ alfanumérico**, vigente desde jul/2026), endereço
   com código IBGE do município (necessário para NFS-e), contato.
2. **Perfuratrizes** — identificação, diâmetro máx., profundidade máx., status
   (ativa/manutenção/inativa).
3. **Obras** — cliente, endereço/cidade, perfuratriz(es) alocada(s), operador(es), status
   (planejada → em execução → concluída / cancelada) e **tabela de preço contratada da obra**
   (snapshot por diâmetro R$/m + mobilização + mínimo). A tabela global serve só de sugestão; cada
   obra congela a sua, pois há diâmetros/profundidades "a negociar".
4. **Medições (diário de perfuração)** — por obra, data e perfuratriz: linhas com identificador da
   estaca (ex. E-12), diâmetro (cm) e profundidade (m). Entrada pelo celular de duas formas:
   - digitação direta;
   - **foto das anotações do operador** → IA (Gemini, `gemini-3.5-flash-lite`, configurável) extrai as
     linhas → operador revisa e confirma. A IA **só extrai**; nunca calcula valor.
   Fluxo: `draft` → `submitted` (operador) → `approved` (escritório) / `rejected`.
5. **Faturamento** — **boletim de medição**: agrupa medições aprovadas e ainda não faturadas de uma
   obra num período; valor = Σ(metros × preço contratado do diâmetro) + mobilização (quando
   aplicável). Do boletim aprovado: emitir **NFS-e (Prefeitura de Uberlândia)** → registrar
   **boleto no Sicoob** (com PIX, se o convênio permitir) → criar **título a receber**. Cada etapa
   tem estado próprio e pode ser reprocessada.
6. **Contas a receber** — títulos (origem boletim ou manual), vencimento, baixa automática
   (webhook/consulta Sicoob) ou manual, juros/desconto, inadimplência.
7. **Contas a pagar** — fornecedores, categoria, obra (centro de custo, opcional), vencimento,
   pagamento, anexo do comprovante.
8. **Relatórios** — metros perfurados por obra/perfuratriz/período, faturado vs recebido, resultado por
   obra (receitas − despesas lançadas na obra).

## 5. Requisitos não funcionais

- **PWA responsivo** (um único front-end), instalável na tela inicial; alvos: viewport ~360×780
  (Galaxy S23) e 393×852 (iPhone 14 Pro), e desktop ≥1280. Áreas de toque ≥44px, `safe-area-inset`.
- Front-end e back-end **separados**: front na **Vercel**, API + Postgres no **Railway**.
- pt-BR na interface; código/identificadores em inglês. Fuso `America/Sao_Paulo`; datas de negócio
  (`date`) sem hora.
- Dinheiro sempre `Decimal` / `NUMERIC(14,2)`, arredondamento `ROUND_HALF_UP`; metros
  `NUMERIC(10,2)`; nunca `float`. Entrada aceita vírgula decimal (`12,5`).
- Banco: **somente Alembic** (nunca `create_all` em produção).
- Segredos só em variáveis de ambiente.
- Fotos e PDFs em storage S3-compatível (Railway Bucket ou Cloudflare R2) atrás de uma porta.

## 6. Arquitetura

- Monorepo: `backend/` (Python 3.12, FastAPI, SQLAlchemy 2 async, Alembic, psycopg, uv) e `frontend/`
  (Next.js App Router + TypeScript, Tailwind, TanStack Query, React Hook Form + zod).
- Backend em clean architecture, igual ao agente: `domain/` (regras puras), `application/` (casos de
  uso e portas `Protocol`), `infrastructure/` (SQLAlchemy, Gemini, Sicoob, NFS-e, S3),
  `interfaces/http/` (FastAPI).
- **Mesma origem para o navegador**: o Next.js reescreve `/api/*` para a API no Railway. A sessão é
  um cookie `httpOnly` de primeira parte (evita bloqueio de cookie de terceiros no Safari/iOS e
  dispensa CORS).
- Integrações externas atrás de portas: `NotesExtractor` (Gemini), `NfseIssuer` (Uberlândia),
  `BoletoIssuer` (Sicoob Cobrança API, OAuth + certificado mTLS), `FileStorage` (S3).

## 7. Fases (um plano por fase)

| Fase | Entrega | Plano |
|---|---|---|
| **P1 Fundação** | monorepo, API, auth/papéis, usuários, clientes, perfuratrizes, PWA shell, deploy | `docs/superpowers/plans/2026-11-09-p1-fundacao.md` |
| P2 Obras + medições | obras com tabela contratada, alocação, medições (digitação + foto/IA), aprovação | a escrever |
| P3 Financeiro | contas a pagar, contas a receber manual, fornecedores, categorias | a escrever |
| P4 Faturamento | boletim → NFS-e → boleto Sicoob → título a receber, baixa automática | a escrever |
| P5 Integração | orçamento aprovado no agente → obra; relatórios | a escrever |

## 8. Questões em aberto (bloqueiam P4, não P1)

- Regime tributário (Simples Nacional? Presumido?), alíquota de ISS, item da LC 116 e código de
  serviço municipal, retenção de ISS/INSS para construtoras — **confirmar com o contador**.
- NFS-e de Uberlândia: confirmar se a emissão é pelo padrão nacional (gov.br/nfse) ou pelo sistema
  municipal, e o meio de acesso (API/certificado A1).
- Sicoob: convênio de cobrança ativo, credenciais da API (client_id + certificado), boleto híbrido com
  PIX disponível?
- Conectividade no canteiro: P2 assume que o envio pode falhar e precisa de reenvio; modo offline
  completo fica fora até ser confirmado como necessário.
