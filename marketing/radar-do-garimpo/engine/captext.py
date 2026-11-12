#!/usr/bin/env python3
"""Replace ASR words with the real script words (keeping ASR timings) so captions are spelled right.
Reads vo/asr_raw.json (whisper output) and writes vo/asr.json. Edit VO_TEXT when the script changes."""
import json, re, difflib, unicodedata, shutil, os

VO_TEXT = {
    'V1': 'Seus grupos de WhatsApp vendendo o dia inteiro... e você, sem postar nada.',
    'V2': 'Chega de passar horas caçando oferta, gerando link e colando grupo por grupo.',
    'V3': 'Chegou o Radar do Garimpo!',
    'V4': 'Ele acha a oferta na Shopee, no Mercado Livre e na Amazon, coloca o seu link de afiliado e aplica o seu cupom.',
    'V5': 'Cada oferta ganha uma nota de venda, de 0 a 100. Produto ruim nem chega no seu grupo.',
    'V6': 'A mensagem é escrita por IA e sai numa fila anti-ban: um envio por minuto, só no horário que você escolher.',
    'V7': 'E no painel, você vê os cliques e o que está rendendo.',
    'V8': 'Planos a partir de R$ 39,90 por mês, sem fidelidade. Acesse radardogarimpo.com e deixe o Radar trabalhar por você.',
}

def norm(w):
    w = unicodedata.normalize('NFD', w.lower()); w = ''.join(c for c in w if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', w)

if not os.path.exists('vo/asr_raw.json'):
    shutil.copy('vo/asr.json', 'vo/asr_raw.json')
raw = json.load(open('vo/asr_raw.json'))
out = dict(raw)
for k, text in VO_TEXT.items():
    key = f'vo/{k}.mp3'
    if key not in raw: continue
    aw = raw[key]['words']; sw = text.replace('...', '…').split()
    sw = [w.replace('…', '...') for w in sw]
    a_n = [norm(w['w']) for w in aw]; s_n = [norm(w) for w in sw]
    times = [None] * len(sw)
    sm = difflib.SequenceMatcher(a=s_n, b=a_n, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            for d in range(i2 - i1): times[i1 + d] = (aw[j1 + d]['s'], aw[j1 + d]['e'])
        elif tag == 'replace' and j2 > j1:
            s0, e0 = aw[j1]['s'], aw[j2 - 1]['e']; L = sum(len(x) for x in sw[i1:i2]) or 1; acc = 0
            for i in range(i1, i2):
                a = s0 + (e0 - s0) * acc / L; acc += len(sw[i]); times[i] = (a, s0 + (e0 - s0) * acc / L)
    # interpolate gaps
    for i in range(len(sw)):
        if times[i] is None:
            prev = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), aw[0]['s'])
            nxt = next((times[j][0] for j in range(i + 1, len(sw)) if times[j]), aw[-1]['e'])
            times[i] = (prev, max(prev + 0.05, nxt))
    out[key] = dict(raw[key], text=text, words=[dict(w=w, s=round(t[0], 3), e=round(t[1], 3)) for w, t in zip(sw, times)])
json.dump(out, open('vo/asr.json', 'w'), ensure_ascii=False, indent=0)
print('captions fixed for', [k for k in VO_TEXT if f'vo/{k}.mp3' in raw])
