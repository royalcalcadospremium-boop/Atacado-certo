# Radar do Arremate — landing + checkout

Site estático (HTML/CSS/JS puro, sem build, sem dependências) pronto para
subir na Hostinger.

---

## 1. Arquivos

```
index.html          Página de vendas com VSL
checkout.html       Checkout com order bumps
obrigado.html       Pós-pagamento
termos.html         PENDENTE — precisa de advogado
privacidade.html    PENDENTE — precisa de advogado
.htaccess           HTTPS, cache, compressão
assets/
  config.js         ← ÚNICO arquivo que você edita no dia a dia
  style.css         Estilos (cores no topo, bloco :root)
  app.js            Player, contador, revelação do CTA
  checkout.js       Total, bumps, máscaras, validação
```

---

## 2. Antes de publicar — checklist

Buscar e substituir em **todos** os arquivos:

| Placeholder | Trocar por |
|---|---|
| `SUA EMPRESA LTDA` | Sua razão social |
| `00.000.000/0001-00` | Seu CNPJ |
| `suporte@seudominio.com.br` | Seu email de suporte |
| `SUA PLATAFORMA` | Hubla, Kiwify, Cakto... |

Comando rápido (Linux/Mac, dentro da pasta):

```bash
grep -rn "SUA EMPRESA LTDA\|00.000.000/0001-00\|seudominio.com.br\|SUA PLATAFORMA" .
```

Depois, em `assets/config.js`:

- `videoEmbed` → URL do seu vídeo
- `segundosAtePitch` → quando o botão aparece (0 = na hora)
- `urgencia.texto` / `urgencia.prazo` → barra do topo ('' esconde)
- `checkout.urlDestino` → URL do seu checkout na plataforma

Imagens a colocar em `assets/`:

| Arquivo | Tamanho | Onde aparece |
|---|---|---|
| `banner.jpg` | 1200 × 300 | topo do checkout |
| `capa.jpg` | 1280 × 720 | poster do vídeo |
| `og.jpg` | 1200 × 630 | preview no WhatsApp/Instagram |
| `favicon.png` | 64 × 64 | aba do navegador |

Para o banner aparecer, troque em `checkout.html`:

```html
<!-- de -->
<p class="placeholder-banner">Radar do Arremate</p>
<!-- para -->
<img src="assets/banner.jpg" alt="Radar do Arremate">
```

---

## 3. Subir na Hostinger

### Opção A — hPanel (mais simples)

1. hPanel → **Arquivos** → **Gerenciador de Arquivos**
2. Entre em `public_html/`
3. Apague o `default.php` que vem de fábrica
4. Compacte esta pasta em `.zip` e suba com **Enviar arquivos**
5. Clique com o botão direito no zip → **Extrair**
6. Confirme que `index.html` está direto em `public_html/`, não dentro de
   uma subpasta

### Opção B — FTP

hPanel → **Arquivos** → **Contas de FTP** para pegar os dados.

```bash
# FileZilla, ou via linha de comando:
lftp -u SEU_USUARIO,SUA_SENHA ftp://ftp.seudominio.com.br
> mirror -R --delete ./ /public_html/
```

### Opção C — Git (se o seu plano tiver)

hPanel → **Avançado** → **Git** → conecte este repositório e aponte o
diretório de deploy para `public_html`.

### Depois de subir

1. hPanel → **Segurança** → **SSL** → instale o certificado grátis
   (o `.htaccess` já força HTTPS, mas só funciona com o certificado ativo)
2. Abra o site no celular e confira: vídeo carrega, botão aparece,
   checkout soma os bumps
3. hPanel → **Desempenho** → ative o cache

---

## 4. O checkout NÃO cobra ninguém

O formulário de cartão em `checkout.html` é **camada visual**. Ele valida os
campos e monta o pedido — não processa pagamento e não envia dados de cartão
para lugar nenhum.

Isso é proposital. Guardar ou transmitir número de cartão exige certificação
**PCI-DSS**, que hospedagem compartilhada não tem. Tentar fazer isso "na mão"
é ilegal e te expõe a responsabilidade civil.

**O caminho certo:** contrate uma plataforma (Hubla, Kiwify, Cakto,
Mercado Pago, Pagar.me) e coloque a URL de checkout dela em
`config.js → checkout.urlDestino`. O script leva o cliente para lá com nome,
email e telefone já preenchidos. Os dados de cartão são digitados na página
da plataforma, sob a certificação dela.

Se quiser manter o cartão dentro do seu site sem sair da página, use o
**SDK de tokenização** da plataforma (Pagar.me.js, Mercado Pago SDK). O cartão
vira um token no navegador do cliente e o seu servidor nunca vê o número.
Isso exige backend — não roda em hospedagem estática.

---

## 5. Order bumps

Cada bump é um bloco `.bump` em `checkout.html`. Para adicionar um, copie o
bloco inteiro e ajuste:

```html
<input type="checkbox" name="bump" value="meu-bump" data-preco="47.00">
```

- `value` — identificador que vai para a plataforma
- `data-preco` — preço que entra no total (ponto como decimal)
- `data-substitui="a,b"` — opcional: marca este bump como combo e desativa
  os bumps `a` e `b` quando selecionado, para o cliente não pagar duas vezes
  pelo mesmo item

O total recalcula sozinho. Não precisa mexer no JavaScript.

---

## 6. Ajustes comuns

**Mudar as cores** — `assets/style.css`, bloco `:root` no topo.

**Mudar os preços** — `checkout.html`, atributo `data-preco` de cada
`<option>` do plano e de cada checkbox de bump. Os valores riscados
(`.preco-antigo`) são texto livre, edite à mão.

**Parcelamento com juros** — `config.js → checkout.jurosMes` (ex.: `1.99`).
Com `0`, divide o valor sem juros.

**Desconto no Pix** — `config.js → checkout.descontoPix` (ex.: `10` para 10%).

**Player Vturb/Panda** — apague a `<iframe id="player">` do `index.html` e
cole o script do player no lugar, dentro da `.moldura-video`.

---

## 7. Conformidade

Antes de rodar tráfego pago:

- [ ] Termos e política de privacidade escritos por advogado
- [ ] CNPJ e razão social reais no rodapé das duas páginas
- [ ] Nenhuma promessa de ganho, retorno ou "lucro garantido" no copy
- [ ] Preço total visível antes do botão de pagamento (CDC art. 31)
- [ ] Direito de arrependimento de 7 dias informado (CDC art. 49)
- [ ] Canal de atendimento funcionando de verdade

Infoproduto no nicho de investimentos é alvo frequente de Procon e de
bloqueio nas plataformas de anúncio. O copy desta página foi escrito sem
promessa de resultado de propósito — se você adicionar uma, o risco passa
a ser seu.
