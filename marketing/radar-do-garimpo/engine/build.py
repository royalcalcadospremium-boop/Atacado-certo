#!/usr/bin/env python3
"""Builds timeline_<fmt>.json + mix_<fmt>.wav for the Radar do Garimpo launch videos.

Run from the engine dir (which contains brand/, el/, elm/, frames/, vo/, sfx).
  python3 build.py v   -> vertical 1080x1920 (Reels/TikTok)
  python3 build.py h   -> horizontal 1920x1080 (YouTube)
To make a new version from a new script: regenerate vo/*.mp3, edit SCENES_V / SCENES_H below.
"""
import json, subprocess, sys, os, re
from PIL import Image

FPS = 30
SFX = os.path.join(os.environ.get('HF_WORKFLOWS', ''), 'katana/scripts/sfx_lib')

def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode())

def isize(f):
    with Image.open(f) as im:
        return im.size

ASR = json.load(open('vo/asr.json')) if os.path.exists('vo/asr.json') else {}
G = lambda s: f'<span class="gold">{s}</span>'

# ---------------------------------------------------------------- scene specs
# each: dict(vo='V1' | None, type=clip|card|logo|cta|pair|cycle, extra=seconds, ...)
SCENES_V = [
    dict(vo='V1', type='clip', clip='v_hook', title='Seus grupos vendendo<br>o dia inteiro.', title2=G('Você sem postar nada.'), t2=0.48),
    dict(vo='V2', type='clip', clip='v_prob', title='Horas caçando<br>oferta?', title2='Gerar link. Montar mensagem.<br>Colar grupo por grupo.', t2=0.35, sub2=True, tint='cold'),
    dict(vo='V3', type='logo', extra=0.5),
    dict(vo='V4', type='card', img='elm/palco.png', dark=True, eyebrow='Automação de ofertas', title=f'Acha a oferta, põe {G("seu link")} e {G("seu cupom")}', chips=['Shopee', 'Mercado Livre', 'Amazon']),
    dict(vo='V5', type='card', img='elm/recurso_0.png', eyebrow='Só no Radar', title=f'Nota de venda<br>de {G("0 a 100")}'),
    dict(vo='V6', type='card', img='elm/fila.png', eyebrow='Segurança do número', title=f'Fila {G("anti-ban")}<br>de verdade', chips=['1 envio por minuto', 'Só no seu horário']),
    dict(vo='V7', type='card', img='elm/janela.png', eyebrow='Relatórios', title=f'Veja o que<br>{G("está rendendo")}'),
    dict(vo='V8', type='clip', clip='v_pay', title='Roda enquanto', title2=G('você vive.'), t2=0.35, fixed=3.4),
    dict(vo=None, type='cta', cont=True, extra=1.6),
]

SCENES_H = [
    dict(vo='H1', type='clip', clip='h_hook', title='Seus grupos vendendo<br>o dia inteiro.', title2=G('Enquanto você vive.'), t2=0.5),
    dict(vo='H2', type='clip', clip='h_prob', title='1 a 2 horas por dia<br>caçando oferta.', fixed=6.6, tint='cold'),
    dict(vo=None, type='card', cont=True, img='el/compara_mao.png', eyebrow='A rotina de quem divulga', title=f'Na mão, {G("tudo depende de você")}'),
    dict(vo='H3', type='logo', extra=0.5),
    dict(vo='H4', type='split', img='el/palco.png', dark=True, eyebrow='Automação para WhatsApp', title=f'Seus grupos vendendo.<br>{G("Você sem postar nada.")}',
         bullets=['Acha a oferta', 'Troca pelo seu link de afiliado', 'Aplica o seu cupom', 'Escreve a mensagem com IA', 'Envia no horário certo']),
    dict(vo='H5', type='card', img='el/caminho.png', dark=True, eyebrow='O caminho de cada oferta', title=f'Funciona com as {G("maiores lojas")}',
         chips=['Shopee', 'Mercado Livre', 'Amazon', 'Magalu', 'Netshoes', 'Rakuten', 'Shopify']),
    dict(vo='H6', type='card', img='el/recurso_0.png', dark=True, eyebrow='Só no Radar', title=f'Cada oferta ganha {G("nota de venda")}', kb=[1.0, 1.06]),
    dict(vo='H7', type='pair', imgs=['el/recurso_1.png', 'el/recurso_2.png'], eyebrow='Incluso no plano', title=f'Vídeo do produto + {G("cupom no preço")}'),
    dict(vo='H8', type='split', img='el/recurso_3.png', eyebrow='Incluso no plano', title=f'Troca de link<br>{G("garantida")}', sub='Tira a marcação de quem postou antes e coloca a sua.'),
    dict(vo='H9', type='cycle', imgs=['el/modo_0.png', 'el/modo_1.png', 'el/modo_2.png', 'el/modo_3.png'], eyebrow='Você escolhe de onde vêm as ofertas', title=f'{G("4 jeitos")} de alimentar seus grupos'),
    dict(vo='H10', type='split', img='el/fila.png', eyebrow='Segurança do número', title=f'Fila {G("anti-ban")}<br>de verdade',
         bullets=['Um envio por minuto, por número', 'Só na sua janela de horário', 'Limite diário por número', 'Mensagem sempre diferente']),
    dict(vo='H11', type='card', img='el/janela.png', eyebrow='Relatórios', title=f'Cliques, envios e grupos {G("num painel só")}'),
    dict(vo='H12', type='clip', clip='h_pay', title='Roda de madrugada,<br>no trabalho,', title2=G('na praia.'), t2=0.55),
    dict(vo='H13', type='card', img='el/planos.png', eyebrow='Planos', title=f'Um preço fechado. {G("Sem surpresa.")}', fixed=6.8),
    dict(vo=None, type='cta', cont=True, extra=1.8),
]


def build(fmt):
    V = fmt == 'v'
    W, H = (1080, 1920) if V else (1920, 1080)
    speed = 1.08 if V else 1.04          # narration tempo
    gap = 0.18                           # silence between lines
    specs = SCENES_V if V else SCENES_H
    clipN = {c: len(os.listdir(f'frames/{c}')) for c in os.listdir('frames')}

    # ---- timing: scenes follow narration; 'fixed' scenes cut a line, 'cont' scenes take the remainder
    t = 0.0; scenes = []; vo_events = []; pending = 0.0
    for i, sp in enumerate(specs):
        if sp.get('vo'):
            d = dur(f"vo/{sp['vo']}.mp3") / speed
            vo_events.append((sp['vo'], t + 0.12))
            need = d + 0.12 + gap
            if sp.get('fixed'):
                sd = sp['fixed']; pending = max(0.0, need - sd)
            else:
                sd = need + sp.get('extra', 0); pending = 0.0
        else:
            sd = pending + sp.get('extra', 0.4) + (0 if pending else 0); pending = 0.0
            if sp['type'] == 'cta' and sd < 3.5: sd = 3.5
        scenes.append(dict(spec=sp, start=round(t, 3), dur=round(sd, 3)))
        t += sd
    total = round(t + 0.4, 3)

    # ---- scene item layout
    out = []
    flashes = []
    for k, s in enumerate(scenes):
        sp, st, sd = s['spec'], s['start'], s['dur']
        items = []
        typ = sp['type']
        pad = 70 if V else 120
        if typ == 'clip':
            n = clipN[sp['clip']]
            clip_len = n / 30.0
            sp_speed = min(1.0, clip_len / (sd + 0.3))  # slow-mo to fill the scene
            shade = ('linear-gradient(180deg,rgba(12,18,15,.82) 0%,rgba(12,18,15,.2) 32%,rgba(12,18,15,0) 50%,rgba(12,18,15,.55) 78%,rgba(12,18,15,.9) 100%)' if V else
                     'linear-gradient(90deg,rgba(12,18,15,.85) 0%,rgba(12,18,15,.45) 40%,rgba(12,18,15,0) 70%),linear-gradient(0deg,rgba(12,18,15,.6),transparent 40%)')
            if sp.get('tint') == 'cold':
                shade += ',linear-gradient(0deg,rgba(20,40,70,.25),rgba(20,40,70,.25))'
            items.append(dict(kind='clip', dir=f"frames/{sp['clip']}", n=n, speed=sp_speed, shade=shade, kb=[1.02, 1.1]))
            if V:
                tstyle = dict(left=f'{pad}px', right=f'{pad}px', top='230px', fontSize='96px')
                t2style = dict(left=f'{pad}px', right=f'{pad}px', top=f"{230 + (sp['title'].count('<br>') + 1) * 100 + 30}px", fontSize='96px' if not sp.get('sub2') else '54px')
            else:
                tstyle = dict(left=f'{pad}px', width='1300px', bottom='300px' if sp.get('title2') else '170px', fontSize='100px')
                t2style = dict(left=f'{pad}px', width='1300px', bottom='170px', fontSize='96px')
            items.append(dict(kind='text', cls='title tshadow', html=sp['title'], style=tstyle, tin=0.15, anim='up'))
            if sp.get('title2'):
                cls = 'sub tshadow' if sp.get('sub2') else 'title tshadow'
                items.append(dict(kind='text', cls=cls, html=sp['title2'], style=t2style, tin=round(sd * sp.get('t2', 0.5), 2), anim='up'))
        elif typ == 'logo':
            size = 360 if V else 300
            cx, cy = W / 2, (H * 0.42 if V else H * 0.42)
            items.append(dict(kind='logo', size=size, style=dict(left=f'{cx}px', top=f'{cy}px', width='0', height='0'), anim='none'))
            items.append(dict(kind='text', cls='word', html='Radar do <span class="gold">Garimpo</span>',
                              style=dict(left='0', right='0', top=f'{cy + size * 0.95}px', fontSize='104px' if V else '96px'), tin=0.55, anim='up'))
            items.append(dict(kind='text', cls='sub', html='Ofertas nos seus grupos de WhatsApp, no automático.',
                              style=dict(left='80px', right='80px', top=f'{cy + size * 0.95 + (130 if V else 120)}px', fontSize='44px' if V else '40px', textAlign='center'), tin=0.9, anim='up'))
            flashes.append(round(st + 0.55, 3))
        elif typ == 'cta':
            size = 260 if V else 200
            top = 300 if V else 120
            items.append(dict(kind='text', cls='', html=f'<img src="brand/logo-512.png" style="width:{size}px;height:{size}px;border-radius:22%;filter:drop-shadow(0 0 50px rgba(231,178,74,.5))">',
                              style=dict(left='0', right='0', top=f'{top}px', textAlign='center'), tin=0.0, anim='pop'))
            y = top + size + 40
            items.append(dict(kind='text', cls='word', html='Radar do <span class="gold">Garimpo</span>', style=dict(left='0', right='0', top=f'{y}px', fontSize='84px' if V else '72px'), tin=0.15, anim='up'))
            y += 150 if V else 120
            items.append(dict(kind='text', cls='sub', html='Planos a partir de', style=dict(left='0', right='0', top=f'{y}px', fontSize='48px' if V else '40px', textAlign='center'), tin=0.3, anim='up'))
            y += 70 if V else 55
            items.append(dict(kind='text', cls='price', html='R$ 39,90<span style="font-size:.38em;color:#F4F1E8;font-weight:700">/mês</span>',
                              style=dict(left='0', right='0', top=f'{y}px', fontSize='190px' if V else '150px', textAlign='center'), tin=0.4, anim='pop'))
            y += 240 if V else 180
            chips = ''.join(f'<span class="chip">{c}</span>' for c in ['Sem fidelidade', 'PIX ou cartão', 'Cancela pelo painel'])
            items.append(dict(kind='text', cls='chips', html=chips, style=dict(left='40px', right='40px', top=f'{y}px', fontSize='38px' if V else '34px', justifyContent='center'), tin=0.65, anim='up'))
            y += 170 if V else 110
            items.append(dict(kind='text', cls='', html='<span class="btn">radardogarimpo.com &rarr;</span>', style=dict(left='0', right='0', top=f'{y}px', fontSize='60px' if V else '50px', textAlign='center'),
                              tin=0.9, anim='pop', pulse=True))
            flashes.append(round(st + 0.05, 3))
        else:
            # header (eyebrow + title [+ chips])
            if V:
                hx = dict(left=f'{pad}px', right=f'{pad}px')
                eb_top, tt_top, fs = 250, 305, 82
            else:
                hx = dict(left=f'{pad}px', right=f'{pad}px') if typ != 'split' else dict(left=f'{pad}px', width='740px')
                eb_top, tt_top, fs = (80, 128, 70) if typ != 'split' else (200, 250, 70)
            items.append(dict(kind='text', cls='eyebrow', html=sp['eyebrow'], style=dict(**hx, top=f'{eb_top}px', fontSize='30px' if V else '26px'), tin=0.1, anim='up'))
            items.append(dict(kind='text', cls='title', html=sp['title'], style=dict(**hx, top=f'{tt_top}px', fontSize=f'{fs}px'), tin=0.2, anim='up'))
            boxw = (W - 2 * pad) if (V or typ != 'split') else 740
            nlines = 0
            for seg in sp['title'].split('<br>'):
                plain = re.sub(r'<[^>]+>', '', seg)
                nlines += max(1, -(-int(len(plain) * fs * 0.53) // boxw))
            hdr_bottom = tt_top + nlines * fs * 1.08
            if sp.get('chips'):
                chips = ''.join(f'<span class="chip">{c}</span>' for c in sp['chips'])
                cy = hdr_bottom + 24
                items.append(dict(kind='text', cls='chips', html=chips, style=dict(**hx, top=f'{cy}px', fontSize='34px' if V else '28px'), tin=0.55, anim='up'))
                hdr_bottom = cy + (80 if V else 60)
            if typ == 'split':
                for j, bt in enumerate(sp.get('bullets', [])):
                    items.append(dict(kind='text', cls='bullet', html=f'<i>✓</i>{bt}', style=dict(left=f'{pad}px', width='760px', top=f'{hdr_bottom + 50 + j * 72}px', fontSize='38px'),
                                      tin=round(0.6 + j * (sd - 1.6) / max(1, len(sp['bullets'])), 2), anim='left'))
                if sp.get('sub'):
                    items.append(dict(kind='text', cls='sub', html=sp['sub'], style=dict(left=f'{pad}px', width='700px', top=f'{hdr_bottom + 40}px', fontSize='40px'), tin=0.6, anim='up'))
            # media box
            if V:
                box = dict(x=60, y=max(hdr_bottom + 50, 640), w=960, hmax=1440 - max(hdr_bottom + 50, 640))
            elif typ == 'split':
                box = dict(x=900, y=110, w=900, hmax=860)
            else:
                y0 = hdr_bottom + 40
                box = dict(x=None, y=y0, w=1700 if sp.get('big') else 1680, hmax=1030 - y0)
            imgs = sp.get('imgs') or [sp['img']]
            if typ == 'pair':
                gapx = 50; wv = (1560 - gapx) // 2
                for j, f in enumerate(imgs):
                    iw, ih = isize(f); h = ih * wv / iw; vh = min(h, box['hmax'])
                    items.append(dict(kind='card', src=f, imgH=h, vpH=vh, dark=sp.get('dark', False),
                                      style=dict(left=f'{(W - 1560) // 2 + j * (wv + gapx)}px', top=f"{box['y']}px", width=f'{wv}px'),
                                      tin=0.35 + j * 0.25, anim='card', pan=[1.0, sd - 0.4] if h > vh else None))
            else:
                iw, ih = isize(imgs[0]); w = box['w']; h = ih * w / iw
                if not V and typ != 'split' and h > box['hmax'] * 1.0 and not sp.get('pan_ok', typ == 'card' and ih / iw > 0.5):
                    # too tall: shrink width to fit
                    w = int(box['hmax'] * iw / ih); h = box['hmax']
                vh = min(h, box['hmax'])
                x = box['x'] if box['x'] is not None else (W - w) // 2
                y = box['y'] if V else ((H - vh) / 2 if typ == 'split' else box['y'] + (box['hmax'] - vh) / 2)
                it = dict(kind='card', src=imgs[0], imgH=h, vpH=vh, dark=sp.get('dark', False), style=dict(left=f'{x}px', top=f'{y}px', width=f'{w}px'),
                          tin=0.3, anim='card', kb=sp.get('kb'))
                if h > vh + 2:
                    it['pan'] = [0.9, max(1.2, sd - 0.5)]
                if typ == 'cycle':
                    it['srcs'] = imgs; it['cycleEnd'] = sd
                items.append(it)
        out.append(dict(id=k, type=typ, start=st, dur=sd, first=(k == 0), items=items))

    # ---- captions (vertical): word groups from ASR, mapped to global time
    captions = None; capStyle = None
    if V:
        captions = []
        for name, t0 in vo_events:
            a = ASR.get(f'vo/{name}.mp3')
            if not a: continue
            words = [dict(w=w['w'], s=round(t0 + w['s'] / speed, 3), e=round(t0 + w['e'] / speed, 3)) for w in a['words']]
            grp = []
            for w in words:
                grp.append(w)
                txt = ' '.join(x['w'] for x in grp)
                if len(grp) >= 4 or len(txt) > 20 or re.search(r'[.,:!?]$', w['w']):
                    captions.append(dict(s=grp[0]['s'], e=grp[-1]['e'], words=grp)); grp = []
            if grp: captions.append(dict(s=grp[0]['s'], e=grp[-1]['e'], words=grp))
        for i in range(len(captions) - 1):  # hold until next group (no flicker)
            if captions[i + 1]['s'] - captions[i]['e'] < 0.35:
                captions[i]['e'] = captions[i + 1]['s'] - 0.05
        capStyle = dict(top='1530px', fontSize='70px', padding='0 60px')

    tl = dict(W=W, H=H, fps=FPS, duration=total, scenes=out, captions=captions, capStyle=capStyle, flashes=flashes)
    json.dump(tl, open(f'timeline_{fmt}.json', 'w'), ensure_ascii=False)

    # ---- audio mix
    inputs = []; filt = []; vo_labels = []
    for i, (name, t0) in enumerate(vo_events):
        inputs += ['-i', f'vo/{name}.mp3']
        filt.append(f'[{i}:a]aresample=48000,atempo={speed},adelay={int(t0 * 1000)}|{int(t0 * 1000)},apad=whole_dur={total}[vo{i}]')
        vo_labels.append(f'[vo{i}]')
    nv = len(vo_events)
    filt.append(''.join(vo_labels) + f'amix=inputs={nv}:normalize=0,atrim=0:{total},asplit=2[vo][sc]')
    # music: loop with crossfade if needed
    mfile = 'vo/music_v.mp3' if V else 'vo/music_h.mp3'
    md = dur(mfile)
    mi = nv
    inputs += ['-i', mfile, '-i', mfile]
    if md < total + 1:
        cut = md - 3.0
        filt.append(f'[{mi}:a]aresample=48000,atrim=0:{cut}[m1];[{mi + 1}:a]aresample=48000,atrim=2:{md}[m2];[m1][m2]acrossfade=d=3[mraw]')
    else:
        filt.append(f'[{mi}:a]aresample=48000[mraw];[{mi + 1}:a]anullsink')
    filt.append(f'[mraw]atrim=0:{total},afade=t=in:d=0.3,afade=t=out:st={total - 2.0}:d=2.0,volume=0.55[mus]')
    filt.append('[mus][sc]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=350:makeup=1[duck]')
    # sfx
    sfx_events = []
    for s in out:
        if s['first']: continue
        if s['type'] == 'logo':
            sfx_events.append(('riser/rs50__power_up_03.ogg', max(0, s['start'] - 0.9), 0.5))
            sfx_events.append(('hit/kimp__impactBell_heavy_004.ogg', s['start'] + 0.5, 0.55))
        elif s['type'] == 'cta':
            sfx_events.append(('hit/kimp__impactBell_heavy_004.ogg', s['start'] + 0.05, 0.45))
        else:
            sfx_events.append(('whoosh/swish__swosh-01.ogg', max(0, s['start'] - 0.12), 0.35))
    sl = []
    base = mi + 2
    for j, (f, at, vol) in enumerate(sfx_events):
        inputs += ['-i', os.path.join(SFX, f)]
        filt.append(f'[{base + j}:a]aresample=48000,volume={vol},adelay={int(at * 1000)}|{int(at * 1000)},apad=whole_dur={total}[s{j}]')
        sl.append(f'[s{j}]')
    filt.append(f'[vo][duck]{"".join(sl)}amix=inputs={2 + len(sl)}:normalize=0,atrim=0:{total},loudnorm=I=-14:TP=-1.5:LRA=11[out]')
    cmd = ['ffmpeg', '-v', 'error', '-y'] + inputs + ['-filter_complex', ';'.join(filt), '-map', '[out]', '-ar', '48000', '-ac', '2', f'mix_{fmt}.wav']
    subprocess.check_call(cmd)
    print(fmt, 'duration', total, 'scenes', [(s['type'], s['start'], s['dur']) for s in out])


if __name__ == '__main__':
    build(sys.argv[1])
