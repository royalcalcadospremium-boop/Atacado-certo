# Design System: Atacado Certo
**Tema:** Dropmeta v4.3 · **Segmento:** Atacado de Calçados & Moda

---

## 1. Identidade Visual & Atmosfera

Estética **moderna, densa e comercial** — voltada para conversão em atacado. O visual combina uma base neutra de off-white e preto com acentos vibrantes de verde, azul e roxo. A sensação é de uma loja premium de alto volume: produtos em destaque, CTAs agressivos e uma hierarquia visual bem definida que guia o olhar direto para a ação de compra.

**Vibe:** Energético · Direto · Confiável · Comercial

---

## 2. Paleta de Cores & Funções

### Cores Primárias
| Nome Descritivo | Hex | Função |
|---|---|---|
| Preto Grafite Profundo | `#040404` | Texto de título, corpo, header e footer |
| Branco Puro | `#ffffff` | Fundo de cards, formulários, cart |
| Cinza Gelo | `#f7f7f7` | Fundo principal da página |
| Cinza Névoa | `#e7e7e7` | Bordas de separação e inputs |

### Cores de Ação & Acento
| Nome Descritivo | Hex | Função |
|---|---|---|
| Verde Elétrico | `#00d864` | Botão primário, preço, estoque disponível, sucesso |
| Azul Céu Vibrante | `#3498db` | Acento de header, badges de promoção |
| Azul Royal Intenso | `#0076ff` | Título de produto nos cards |
| Roxo Neon | `#702dfa` | Botão secundário |
| Rosa Choque (Cart) | `#e50f78` | Acento exclusivo do carrinho (upsell, botão CTA) |

### Cores de Status & Feedback
| Nome Descritivo | Hex | Função |
|---|---|---|
| Vermelho Alerta | `#f71b1b` | Erros, estoque baixo |
| Verde Lima Suave | `#b8f35a` | Barra de frete grátis |
| Âmbar Dourado | `#ffb647` | Estrelas de avaliação |
| Laranja Queimado | `#ff6128` | Label customizada 1 |
| Lilás Médio | `#a95ebe` | Label customizada 2 |
| Cinza Inativo | `#d1d1d4` | Produto esgotado |

### Linha de Gradiente (Barra Decorativa)
```
linear-gradient(to right, #ffff4a, #fcd000, #ff8a00, #ff5f5f, #ff5193, #c739ff, #0086ff, #00d604)
height: 5px
```
Usada como separador visual no topo do header e rodapé — comunica energia e variedade de marca.

---

## 3. Tipografia

**Família Principal:** Poppins (Google Fonts)
**Fallback:** `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`

### Hierarquia de Pesos
| Peso | Uso |
|---|---|
| `400` Regular | Texto de corpo, descrições |
| `500` Medium | Labels secundários |
| `600` Semibold | Subtítulos |
| `700` Bold | Nomes de produto, labels de formulário |
| `800–900` Black | CTAs, preços, botões de ação |

### Tamanhos Notáveis
- **Base do corpo:** `15px` (range configurável: 14–17px)
- **Nome de produto no cart:** `13.5px` · peso `700`
- **Preço no cart:** `14px` · peso `800`
- **Título do cart:** `18px` · peso `750`
- **Erros e legendas:** `12px`
- **Letter spacing dos botões:** `0.01em`

---

## 4. Estilo dos Componentes

### Botões
- **Forma:** Completamente arredondados — `border-radius: 999px` (pílula perfeita)
- **Altura mínima:** `48px`
- **Peso da fonte:** `900` (máximo impacto)

| Variante | Fundo | Texto | Sombra |
|---|---|---|---|
| Primário | `#00d864` Verde | `#ffffff` | `0 18px 40px rgba(229,15,120,0.20)` |
| Secundário | `#702dfa` Roxo | `#ffffff` | — |
| Ghost (Cart) | `rgba(20,16,24,0.06)` | `#111827` | — |
| Upsell (Cart) | `#e50f78` Rosa | `#ffffff` | `0 10px 25px rgba(229,15,120,0.22)` |

**Comportamento:**
- Hover: `transform: scale(1.04)`
- Press/Active: `transform: scale(0.98)` + sombra reduzida
- Loading: `opacity: 0.7, pointer-events: none`
- Transição: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`

### Cards de Produto
- **Fundo:** `#ffffff` Branco puro
- **Borda:** `1px solid #e7e7e7` Cinza névoa
- **Arredondamento:** Cantos generosamente curvados — `18px`
- **Padding interno:** `12px`
- **Gap interno:** `12px`
- **Elevação:** Flat (sem sombra padrão — o contraste de borda faz o trabalho)

### Cards de Upsell (Cart)
- **Fundo:** `linear-gradient(180deg, rgba(229,15,120,0.10), rgba(229,15,120,0.04))` Rosa suave
- **Borda:** `1px solid rgba(229,15,120,0.14)` Rosa tênue
- **Arredondamento:** `22px` — levemente mais arredondado que o produto padrão

### Inputs & Formulários
- **Fundo:** `#ffffff`
- **Borda:** `1px solid #e7e7e7`
- **Arredondamento:** Suavemente curvados — `12px`
- **Altura:** `40px`
- **Padding:** `0 12px`
- **Peso:** `700`
- **Foco:** `outline: 2px solid #D42B2B, outline-offset: -2px`
- **Erro:** Borda e texto em `#E74C3C`

### Seletor de Quantidade
- **Forma:** Circular — `border-radius: 999px`
- **Tamanho:** `34×34px` por botão
- **Borda:** `1px solid #e7e7e7`

### Galeria de Produto
- **Aspect Ratio:** `1:1` (quadrado)
- **Fundo:** `#FAFAFA` Quase branco
- **Borda Superior:** `1px solid #EEEEEE`
- **Raio da thumbnail:** `14–16px`

### Accordion / FAQ
- **Inativo:** Fundo branco
- **Ativo:** Fundo `#EFEFEF` cinza suave
- **Animação:** `slideDown 0.3s ease-out` com fade de opacidade

---

## 5. Profundidade & Elevação

O tema adota uma abordagem **quase plana com sombras estratégicas** apenas em elementos de alta prioridade:

- **Cards e contêineres normais:** Flat — bordas fazem a separação
- **Cart Drawer:** `0 24px 70px rgba(0,0,0,0.18)` — elevação alta para camada modal
- **Botão CTA do Cart:** `0 18px 40px rgba(229,15,120,0.20)` — sombra colorida para máxima atenção
- **Overlay do Cart:** `rgba(20,16,24,0.55)` — escurece o fundo ao abrir

---

## 6. Layout & Espaçamento

### Container & Grid
- **Largura máxima:** `1200px`
- **Grid de produtos (desktop):** `1fr 1fr` — 2 colunas
- **Grid de produtos (mobile):** `1fr` — coluna única
- **Breakpoint mobile:** `768px`

### Escala de Espaçamento
| Categoria | Valores |
|---|---|
| Micro | `4px`, `6px`, `8px` |
| Pequeno | `10px`, `12px`, `14px` |
| Médio | `18px`, `20px` |
| Grande | `24px`, `28px` |
| Extra grande | `60px`, `100px` |

### Cart Drawer
- **Largura:** `min(420px, 92vw)` — responsivo
- **Altura:** `100vh`
- **Entrada:** `translateX(110%)` → `translateX(0)` com `transition 0.3s`
- **Z-index:** `99999`

---

## 7. Animações & Transições

| Tipo | Duração | Uso |
|---|---|---|
| Rápida | `0.12s ease` | Hover em ícones |
| Padrão | `0.22–0.24s ease` | Estados de formulário |
| Suave (botões) | `0.3s cubic-bezier(0.4,0,0.2,1)` | Botões e cart |
| Accordion | `0.3s ease-out` | Abrir/fechar acordeão |

**Scroll:** `html { scroll-behavior: smooth }`

---

## 8. Acessibilidade

- **Focus Keyboard:** `outline: 2px solid #0086ff, outline-offset: 2px`
- **Visually Hidden:** `position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0)`
- **ARIA:** Botões com `aria-expanded`, `aria-haspopup`, `aria-controls`
- **Formulários:** Labels associadas a todos os campos

---

## 9. Dark Mode

| Elemento | Cor Dark |
|---|---|
| Fundo | `#1a1a1a` |
| Texto | `#f5f5f5` |
| Texto secundário | `#b0b0b0` |
| Botão/Input fundo | `#2a2a2a` |
| Botão/Input borda | `#404040` |
| Accordion ativo | `#303030` |

---

## 10. Sistema de Ícones

- **Font Awesome 5.0.1** — ícones gerais de interface
- **Bootstrap Icons (prefixo `bi-`)** — ícones de benefícios (entrega, pagamento, devoluções, presente)
- **SVGs customizados** — navegação, redes sociais, ações de produto

---

## 11. Coleções & Marcas Referenciadas

Nike · Adidas · Mizuno · Lacoste · New Balance · Hugo Boss · Puma · Vans

---

## Notas de Configuração

- Todas as cores são configuráveis via Shopify Admin → Personalizar Tema
- Fonte atual: **Poppins** (selecionada via Shopify Font Picker)
- Tamanho base da fonte: configurável entre 14–17px
- Aspect ratio dos produtos: **quadrado** (1:1) — padrão ativo
- Zoom de imagem animado: **desabilitado** nas configurações atuais
