# LP Sutiã Corretor de Postura — Fornecimento, precificação e operação

> Landing de produto único para dropshipping, inspirada na estrutura da Atelier Kitsu
> (`atelierkitsu.com/products/...`), adaptada ao mercado brasileiro.
> **Branch:** `claude/dropshipping-sales-page-pb17rb`

---

## 1. O que foi entregue

| Arquivo | Função |
|---------|--------|
| `sections/postura-landing.liquid` | Landing completa (CSS + HTML + JS autocontidos, prefixo `pc-`) |
| `templates/page.postura.liquid` | Template de página que monta a section |
| `docs/LP-SUTIA-POSTURA.md` | Este documento |

### Estrutura da página (ordem)

1. Faixa preta com frases rotativas (marquee)
2. Bloco de compra: galeria + nota/prova social + H1 + subtítulo
3. **Seletor de kits** (1 / 2 / 3 peças) com seletor de cor e tamanho **por unidade**
4. Botão de compra + selos de pagamento
5. FAQ curto do topo + garantias (reembolso / envio)
6. Faixa de confiança (4 itens)
7. Bloco rosa: vídeo vertical + 4 benefícios
8. Antes / depois
9. Avaliações
10. Tabela de medidas
11. FAQ completo
12. CTA final
13. Barra fixa de compra no mobile

---

## 2. Onde comprar o produto (custo)

Pesquisa feita em agosto/2026. Os marketplaces bloqueiam acesso automatizado, então os
valores abaixo vêm de resultados de busca pública — **confirme o preço atual antes de
fechar fornecedor.**

| Fonte | Faixa de custo por peça | Prazo | Observação |
|-------|------------------------|-------|------------|
| **AliExpress / Alibaba (atacado)** | **US$ 1,79 – US$ 6,00** (~R$ 10 – R$ 34) | 15–40 dias | Menor custo. Busque por *posture corrector bra*, *front closure posture bra*. MOQ baixo no AliExpress, alto no Alibaba. |
| **AliExpress Choice (unidade, frete grátis BR)** | R$ 15 – R$ 35 | 10–20 dias | Melhor entrada para validar sem estoque. |
| **Amazon BR** | **R$ 15,58 – R$ 38,20** | 1–5 dias | Existem anúncios a partir de R$ 15,58 e R$ 19,90. FBA entrega rápido — mata a objeção de prazo. |
| **Shopee BR** | R$ 20 – R$ 45 | 3–10 dias | Vendedores nacionais; bom para reposição rápida. |
| **Mercado Livre BR** | Kit a partir de **R$ 48,73** (2x R$ 24,36) | 2–7 dias | Full entrega em 1–2 dias em capitais. |

**Recomendação de sourcing:**

- **Fase de validação (primeiras 30–50 vendas):** compre no **Amazon BR / Mercado Livre Full**
  a ~R$ 20–38. Margem menor, mas entrega em dias em vez de semanas — isso derruba
  cancelamento, chargeback e reclamação, que é o que mata operação nova.
- **Fase de escala (depois de validar o criativo):** migre para **AliExpress/Alibaba a
  ~R$ 10–20/peça**, importando lote e despachando do Brasil. A margem por peça mais que dobra.

---

## 3. Por quanto vender

### Referências de mercado (concorrência já praticando)

| Loja / canal | Preço praticado |
|--------------|-----------------|
| Atelier Kitsu (referência original, Europa) | € 29,90 (1) · € 49,90 (2) · € 59,90 (3) |
| FNAC BR | R$ 99,90 |
| Doutor Precinho | 2 por R$ 199,90 |
| GK Shop / Confortana e similares | R$ 79 – R$ 120 |

O mercado brasileiro de dropshipping desse produto está ancorado em **R$ 90 – R$ 120 a unidade**.
Abaixo de R$ 70 você compete com marketplace no preço e perde; acima de R$ 150 a unidade a
conversão cai sem prova social forte.

### Preços recomendados (já configurados como padrão na section)

| Oferta | Preço de venda | Custo (AliExpress ~R$ 15) | Custo (Amazon ~R$ 30) | Margem bruta |
|--------|---------------|---------------------------|------------------------|--------------|
| 1 peça | **R$ 97,00** | R$ 15 | R$ 30 | R$ 67 – R$ 82 |
| 2 peças (24% OFF) | **R$ 147,44** | R$ 30 | R$ 60 | R$ 87 – R$ 117 |
| 3 peças (36% OFF) | **R$ 186,24** | R$ 45 | R$ 90 | R$ 96 – R$ 141 |

> Margem bruta = preço − custo do produto. **Ainda não descontou** frete ao cliente,
> taxa de gateway (~4–5%), imposto e tráfego pago.

### Conta realista com tráfego (kit de 2, custo Amazon)

```
Receita ................................. R$ 147,44
Custo do produto (2 un. × R$ 30) ........ R$  60,00
Frete ao cliente (PAC/Correios) ......... R$  20,00
Taxa gateway (~4,99%) ................... R$   7,36
--------------------------------------------------
Margem de contribuição .................. R$  60,08
```

Com **CPA de até R$ 45** a operação ainda fica no lucro. Ou seja: você precisa de um
**ROAS mínimo em torno de 3,3x** para o kit de 2 nesse cenário. Com sourcing AliExpress
(R$ 15/peça) a margem sobe para ~R$ 90 e o ROAS mínimo cai para ~2,2x — é por isso que
migrar de fornecedor na escala muda o jogo.

**Ticket médio:** deixe o **kit de 2 pré-selecionado** (já está, via `selecionado: true`).
É o principal alavancador de ticket nessa categoria.

---

## 4. Publicar a página

1. **Online Store → Pages → Add page**
2. **Title:** `Sutiã Corretor de Postura`
3. **Handle:** `sutia-corretor-postura` → a URL fica `/pages/sutia-corretor-postura`
4. **Content:** deixe vazio (tudo vem da section)
5. Em **Theme template**, selecione **`page.postura`**
6. **Save**
7. **Online Store → Themes → Customize → Pages → Sutiã Corretor de Postura**

---

## 5. Configurar a section

### 5.1 Produto (obrigatório)

Em **Produto (cor / tamanho)**, selecione o produto real da loja. Dele saem:

- o **preço unitário** que alimenta o cálculo de todos os kits;
- as **imagens** da galeria;
- os **seletores de cor e tamanho** de cada unidade do kit.

Cadastre o produto com as opções na ordem **Cor** e **Tamanho** (P / M / G / GG).
Enquanto nenhum produto estiver selecionado, a página usa o *Preço unitário de fallback*
(R$ 97) só para visualização — **o botão de compra leva ao carrinho sem adicionar nada.**

### 5.2 Ofertas (kits) — atenção ao desconto

Cada oferta é um block com `Quantidade de peças` e `Desconto (%)`. O preço mostrado é
calculado como `preço unitário × quantidade − desconto%`.

> ⚠️ **O desconto é apenas visual.** O carrinho do Shopify cobra o preço cheio das peças
> a menos que exista uma regra real. Escolha **uma** das duas opções:
>
> **Opção A — desconto automático (recomendado)**
> Discounts → Create discount → Amount off products → aplique ao produto, com
> "Minimum quantity of items" = 2 (24%) e outra regra para 3 (36%). Sem cupom, aplica sozinho.
>
> **Opção B — cupom**
> Crie um código (ex.: `KIT2`, `KIT3`) e preencha o campo **Código de cupom** no block.
> A página adiciona ao carrinho e manda o cliente para `/checkout?discount=KIT2`,
> com o cupom já aplicado.

Se você mudar o percentual no Customizer, **mude também a regra de desconto no Shopify** —
senão o cliente vê um preço na página e outro no checkout.

### 5.3 Como o carrinho monta o kit

Cada unidade do kit vira uma **linha separada** no carrinho. É isso que permite a cliente
escolher, por exemplo, um preto P e um bege M no mesmo kit de 2 — igual à página de referência.

Se a combinação escolhida não existir como variante cadastrada, o botão avisa
*"Essa combinação de cor e tamanho está indisponível"* em vez de falhar silenciosamente.

### 5.4 Mídia

- **Vídeo:** Settings → Files → upload do MP4 → cole a URL em *URL do vídeo (MP4)*.
  Vertical (9:16), **< 10 MB**, sem áudio, 5–15s em loop.
- **Antes / depois:** dois `image_picker`. A seção só aparece se **as duas** estiverem preenchidas.
- **Tabela de medidas:** texto simples — linhas separadas por `;`, colunas por `,`.

---

## 6. Conformidade — leia antes de anunciar

Esse produto encosta em alegação de saúde, e é aí que conta cai no Meta/Google.

- A section já traz um **aviso legal** configurável no bloco antes/depois:
  *"Imagens ilustrativas. O sutiã dá suporte postural e não substitui avaliação médica
  ou fisioterapêutica."* **Não remova.**
- Os textos padrão falam em **suporte e conforto postural**, nunca em tratar, curar ou
  corrigir patologia (escoliose, hérnia, cifose). Mantenha esse registro nos criativos também.
- A nota **4,9/5 · +2.500 mulheres** é um campo editável e vem preenchida como *placeholder de
  layout*. **Troque pelos seus números reais assim que tiver avaliações** — número de review
  inventado é risco de reclamação no Procon e de derrubada de anúncio.
- O mesmo vale para os depoimentos do preset: são exemplos de formatação, não avaliações reais.

---

## 7. Checklist de subida

- [ ] Produto cadastrado com opções Cor + Tamanho e todas as variantes
- [ ] Página criada com template `page.postura`
- [ ] Produto selecionado na section
- [ ] Descontos automáticos (ou cupons) criados no Shopify batendo com os % da página
- [ ] Testado: adicionar kit de 2 com cores diferentes → conferir carrinho e checkout
- [ ] Vídeo e imagens antes/depois enviados
- [ ] Nota e depoimentos trocados pelos reais
- [ ] Tabela de medidas conferida com o fornecedor
- [ ] Testado no mobile (barra fixa de compra aparece ao rolar)

---

**Última atualização:** 2026-08-17
