# Radar do Garimpo — vídeos de lançamento

| Arquivo | O que é |
|---|---|
| `roteiro-v1.md` | Roteiro v1 (vertical 9:16 e horizontal 16:9), com narração e textos de tela |
| `engine/build.py` | Monta a linha do tempo (cenas, textos, legendas) e a mixagem de áudio de cada formato |
| `engine/engine.html` | Página de animação determinística (fonte Urbanist, paleta #0C120F / #E7B24A do site) |
| `engine/render.js` | Renderiza a página quadro a quadro com Chromium headless (Playwright) |
| `engine/captext.py` | Corrige as legendas com o texto real do roteiro, usando os tempos da transcrição |

## Como os vídeos v1 foram feitos

1. **Referências visuais:** capturas em pt-BR de https://radardogarimpo.com (desktop 1440px@2x e mobile 432px@2.5x), uma por seção ou card (celular do grupo, nota de venda, cupom, troca de link, fila anti-ban, painel, 4 modos, planos), mais o logo oficial `assets/marca/logo-512.png`.
2. **Cenas cinematográficas (Higgsfield / Seedance 2.5):** gancho (celular na praia recebendo notificações), dor (madrugada colando link) e resultado (pessoa feliz na rede), nos formatos 9:16 e 16:9.
3. **Narração:** ElevenLabs v4 via Higgsfield, voz pré-definida "Andre", um arquivo por cena (`vo/V1..V8`, `vo/H1..H13`).
4. **Trilha:** ElevenLabs Music v2.5 instrumental, com ducking automático sob a voz e efeitos sonoros CC0 (whoosh, riser, hit) da biblioteca do Katana.
5. **Montagem:** `captext.py` → `build.py v|h` → `render.js` (6 processos em paralelo) → ffmpeg (H.264 CRF 17 + AAC 192k, loudness −14 LUFS).

## Para um novo roteiro (mesmos 2 formatos)

1. Gere a nova narração, um arquivo por cena, em `vo/` (mesmos nomes ou novos).
2. Edite `SCENES_V` / `SCENES_H` em `engine/build.py` (textos de tela, imagem de cada cena, cena de vídeo IA) e `VO_TEXT` em `captext.py`.
3. Se precisar de cenas novas, gere no Seedance e extraia os quadros a 30 fps em `frames/<nome>/0001.jpg…`.
4. Rode a transcrição (`asr.py`), depois `captext.py`, `build.py v`, `build.py h`, os renders e o encode.
