# Medição por grupos de estacas — design

## Por quê
Na maioria das obras os furos se repetem (mesmo diâmetro e mesma profundidade). Lançar estaca por
estaca é digitação repetida e abre espaço para erro. Na prática só importam **quantidade, diâmetro
e metros**; o código/número da estaca não é usado (nem no faturamento, nem pelo cliente).

## Objetivo
O operador (ou o admin no nome dele) lança a medição em grupos:
"30 estacas Ø30 × 8 m", "10 estacas Ø35 × 10 m".

- **Não-objetivos:** identificar estacas individualmente; numeração por obra.
- **Anti-objetivo:** inventar dados (códigos gerados) ou perder as medições já gravadas.

## Abordagens consideradas
- **A — linha vira grupo (escolhida).** A linha passa a ser `quantity × diameter_cm × depth_m`.
  O registro bate com o que se anota e é coerente de ponta a ponta.
- B — só a tela muda e expande o grupo em N linhas com códigos gerados. Descartada: os códigos
  inventados colidem entre medições da mesma obra e o banco guardaria linhas idênticas.
- C — modo grupo + campo opcional de estaca. Descartada: mais tela e mais validação para um caso
  que não acontece na prática.

## Design

### Domínio / banco
- `measurement_lines` ganha `quantity INTEGER NOT NULL` (backfill 1, `CHECK quantity >= 1`).
  `pile_code` vira **nullable**. A migration tem `downgrade()`: expande cada grupo em `quantity`
  linhas (via `generate_series`), gera os códigos que faltam, volta `pile_code` a NOT NULL e
  remove `quantity` *(minha decisão)*.
- `MeasurementLine(quantity: int, diameter_cm: int, depth_m: Decimal, pile_code: str | None = None)`.
- Totais: estacas = Σ quantity; metros = Σ quantity × depth_m (por diâmetro e no geral).
- **Removidas:** a checagem de estaca repetida na medição (`duplicate_piles`) e na obra
  (`pile_keys_in_job`).
- Validações mantidas por linha: diâmetro dentro dos limites da perfuratriz, profundidade > 0 e
  ≤ máximo da perfuratriz, no máximo 2 casas decimais.
- Validação nova: `quantity` inteiro de 1 a 999 *(minha decisão)*.

### API
- Entrada da linha: `{quantity, diameter_cm, depth_m}`. `pile_code` é opcional e ignorado na
  criação; continua aceito para preservar linhas antigas numa edição.
- Saída da linha: `{quantity, diameter_cm, depth_m, pile_code|null}`. `totals_by_diameter` já usa
  as somas novas.

### Tela (LinesEditor)
Cada cartão vira **Qtd · Diâmetro · Profundidade (m)**, e "Adicionar estaca" passa a
"Adicionar grupo". O total da linha aparece no cartão.

```
Grupo 1                                   Remover
QTD        DIÂMETRO        PROFUNDIDADE (M)
[ 30 ]     [ 30 cm  ▾]     [ 8        ]
                                  30 × 8 m = 240,00 m
```
- Ao adicionar um grupo, o diâmetro é copiado do grupo anterior e a quantidade começa vazia
  *(minha decisão)*.
- Grupos repetidos (mesmo diâmetro e profundidade) são permitidos; os totais somam igual
  *(minha decisão)*.
- Rascunhos antigos salvos no aparelho (sem `quantity`) são lidos com quantidade 1.
- Detalhe da medição e listas: mostram "Qtd" em vez de "Estaca". O código só aparece nas medições
  antigas que o têm.
- Viewports 360/393/1280 sem scroll horizontal; toque ≥ 44px.

### Foto das anotações (IA)
- O prompt pede `quantity` quando a folha anota em grupo ("30 estacas Ø30 8m"); quando a folha
  lista estaca por estaca, cada linha vem com quantidade 1.
- O servidor agrupa as linhas válidas com o mesmo diâmetro e profundidade, somando as
  quantidades. Linhas com erro não são agrupadas, para o operador revisar uma a uma.

## Fica para quem constrói
Nomes, a ordem das tarefas e os testes (unitários do domínio e dos totais, migration, API, E2E do
lançamento por grupo e da foto).
