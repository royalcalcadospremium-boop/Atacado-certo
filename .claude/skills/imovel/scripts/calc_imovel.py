#!/usr/bin/env python3
"""Calculadora imobiliária (Brasil) para a skill /imovel.

Subcomandos:
  financiamento  Simulação SAC x Price
  rentabilidade  Renda líquida, cap rate e comparação com o CDI
  fluxo          Fluxo de caixa de imóvel financiado e alugado

Usa só a biblioteca padrão do Python.
"""
import argparse
import sys


def brl(v):
    s = f"{abs(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("-R$ " if v < 0 else "R$ ") + s


def pct(v, casas=2):
    return f"{v * 100:.{casas}f}%".replace(".", ",")


def taxa_mensal(taxa_anual_pct):
    """Converte taxa efetiva anual (%) para taxa efetiva mensal (decimal)."""
    return (1 + taxa_anual_pct / 100) ** (1 / 12) - 1


def price(pv, i, n):
    if pv <= 0:
        return {"primeira": 0.0, "ultima": 0.0, "total": 0.0, "juros": 0.0}
    parcela = pv / n if i == 0 else pv * i / (1 - (1 + i) ** -n)
    total = parcela * n
    return {"primeira": parcela, "ultima": parcela, "total": total, "juros": total - pv}


def sac(pv, i, n):
    if pv <= 0:
        return {"primeira": 0.0, "ultima": 0.0, "total": 0.0, "juros": 0.0}
    amort = pv / n
    juros_total = i * amort * n * (n + 1) / 2  # soma de i*saldo, saldo cai linear
    return {
        "primeira": amort + pv * i,
        "ultima": amort + amort * i,
        "total": pv + juros_total,
        "juros": juros_total,
    }


def custos_aquisicao(valor, itbi_pct, cartorio_pct):
    itbi = valor * itbi_pct / 100
    cart = valor * cartorio_pct / 100
    return itbi, cart


def renda_liquida(a):
    """Retorna dicionário com a renda anual do aluguel e suas deduções."""
    meses_ocupado = 12 - a.vacancia_meses
    bruto = a.aluguel * meses_ocupado
    adm = bruto * a.adm / 100
    encargos_mes = a.condominio + a.iptu_mensal
    meses_encargo = 12 if a.proprietario_paga else a.vacancia_meses
    encargos = encargos_mes * meses_encargo
    manut = a.valor * a.manutencao / 100
    base_ir = bruto - adm - (encargos if a.proprietario_paga else 0)
    ir = max(base_ir, 0) * a.ir_aluguel / 100
    noi = bruto - adm - encargos - manut - ir
    return {
        "potencial": a.aluguel * 12,
        "bruto": bruto,
        "adm": adm,
        "encargos": encargos,
        "manut": manut,
        "ir": ir,
        "noi": noi,
    }


def add_imovel_args(p, com_aluguel=True):
    p.add_argument("--valor", type=float, required=True, help="Preço de compra (R$)")
    p.add_argument("--itbi", type=float, default=3.0, help="ITBI em %% do valor (padrão 3)")
    p.add_argument("--cartorio", type=float, default=1.5, help="Escritura + registro em %% (padrão 1,5)")
    if com_aluguel:
        p.add_argument("--aluguel", type=float, required=True, help="Aluguel mensal (R$)")
        p.add_argument("--condominio", type=float, default=0.0, help="Condomínio mensal (R$)")
        p.add_argument("--iptu-mensal", type=float, default=0.0, help="IPTU por mês (R$)")
        p.add_argument("--vacancia-meses", type=float, default=1.0, help="Meses vagos por ano (padrão 1)")
        p.add_argument("--adm", type=float, default=10.0, help="Taxa de administração em %% do aluguel (padrão 10)")
        p.add_argument("--manutencao", type=float, default=0.5, help="Manutenção anual em %% do valor (padrão 0,5)")
        p.add_argument("--ir-aluguel", type=float, default=0.0, help="Alíquota efetiva de IR sobre o aluguel em %% (padrão 0)")
        p.add_argument("--proprietario-paga", action="store_true",
                       help="Proprietário paga condomínio e IPTU o ano todo (padrão: só nos meses vagos)")
        p.add_argument("--cdi", type=float, default=None, help="CDI anual em %% para comparação (opcional)")


def add_fin_args(p, entrada_obrigatoria=True):
    p.add_argument("--entrada", type=float, required=entrada_obrigatoria, default=None, help="Entrada (R$)")
    p.add_argument("--taxa-anual", type=float, required=True, help="Juros efetivos ao ano em %% (ex.: 11.5)")
    p.add_argument("--meses", type=int, default=360, help="Prazo em meses (padrão 360)")
    p.add_argument("--seguros-mes", type=float, default=0.0, help="Seguros MIP/DFI + tarifa por mês (R$)")


def cmd_financiamento(a):
    pv = a.valor - a.entrada
    i = taxa_mensal(a.taxa_anual)
    itbi, cart = custos_aquisicao(a.valor, a.itbi, a.cartorio)
    print("# Simulação de financiamento\n")
    print(f"Valor do imóvel: {brl(a.valor)}")
    print(f"Entrada: {brl(a.entrada)} ({pct(a.entrada / a.valor, 1)})")
    print(f"Valor financiado: {brl(pv)}")
    print(f"Taxa: {pct(a.taxa_anual / 100)} a.a. = {pct(i, 4)} a.m. | Prazo: {a.meses} meses")
    print(f"ITBI: {brl(itbi)} | Cartório: {brl(cart)} | Dinheiro na mão: {brl(a.entrada + itbi + cart)}\n")
    print("| Sistema | 1ª parcela | Última parcela | Total pago | Total de juros | Renda mínima (30%) |")
    print("|---|---|---|---|---|---|")
    for nome, r in (("SAC", sac(pv, i, a.meses)), ("Price", price(pv, i, a.meses))):
        p1 = r["primeira"] + a.seguros_mes
        print(f"| {nome} | {brl(p1)} | {brl(r['ultima'] + a.seguros_mes)} | "
              f"{brl(r['total'] + a.seguros_mes * a.meses)} | {brl(r['juros'])} | {brl(p1 / 0.30)} |")
    if a.entrada / a.valor < 0.2:
        print("\nAtenção: entrada abaixo de 20%. A maioria dos bancos exige 20% a 30%.")


def cmd_rentabilidade(a):
    r = renda_liquida(a)
    itbi, cart = custos_aquisicao(a.valor, a.itbi, a.cartorio)
    investido = a.valor + itbi + cart
    print("# Rentabilidade do aluguel\n")
    print("| Item | Anual | Mensal |")
    print("|---|---|---|")
    for nome, v in (("Aluguel potencial (12 meses)", r["potencial"]),
                    (f"Aluguel recebido ({12 - a.vacancia_meses:g} meses)", r["bruto"]),
                    ("(-) Administração", -r["adm"]),
                    ("(-) Condomínio + IPTU pagos pelo proprietário", -r["encargos"]),
                    ("(-) Manutenção", -r["manut"]),
                    ("(-) IR sobre aluguel", -r["ir"]),
                    ("**Renda líquida (NOI)**", r["noi"])):
        print(f"| {nome} | {brl(v)} | {brl(v / 12)} |")
    print()
    print(f"Rentabilidade bruta: {pct(a.aluguel / a.valor)} a.m. | {pct(a.aluguel * 12 / a.valor)} a.a.")
    print(f"Cap rate (NOI ÷ preço): {pct(r['noi'] / a.valor)} a.a.")
    print(f"Retorno sobre o total investido ({brl(investido)}): {pct(r['noi'] / investido)} a.a.")
    if a.cdi is not None:
        dif = r["noi"] / investido - a.cdi / 100
        print(f"CDI: {pct(a.cdi / 100)} a.a. → diferença: {pct(dif)} a.a. "
              "(o imóvel ainda pode valorizar; o CDI tem IR e não tem vacância)")


def cmd_fluxo(a):
    r = renda_liquida(a)
    itbi, cart = custos_aquisicao(a.valor, a.itbi, a.cartorio)
    pv = a.valor - a.entrada
    i = taxa_mensal(a.taxa_anual)
    caixa_inicial = a.entrada + itbi + cart
    print("# Fluxo de caixa (imóvel financiado e alugado)\n")
    print(f"Dinheiro investido: {brl(caixa_inicial)} (entrada + ITBI + cartório)")
    print(f"Renda líquida (NOI): {brl(r['noi'])} ao ano = {brl(r['noi'] / 12)} por mês\n")
    print("| Sistema | Parcela inicial | Fluxo mensal | Fluxo anual | Retorno s/ dinheiro investido |")
    print("|---|---|---|---|---|")
    for nome, f in (("SAC", sac(pv, i, a.meses)), ("Price", price(pv, i, a.meses))):
        parcela = f["primeira"] + a.seguros_mes
        mensal = r["noi"] / 12 - parcela
        print(f"| {nome} | {brl(parcela)} | {brl(mensal)} | {brl(mensal * 12)} | {pct(mensal * 12 / caixa_inicial)} |")
    parcela_price = price(pv, i, a.meses)["primeira"] + a.seguros_mes
    # aluguel que zera o fluxo no Price (resolve linear em aluguel)
    custos_fixos = r["encargos"] + r["manut"]
    fator = (12 - a.vacancia_meses) * (1 - a.adm / 100) * (1 - a.ir_aluguel / 100)
    if fator > 0:
        aluguel_pe = (parcela_price * 12 + custos_fixos) / fator
        print(f"\nAluguel para empatar no Price: {brl(aluguel_pe)} por mês")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("financiamento", help="Simulação SAC x Price")
    add_imovel_args(p, com_aluguel=False)
    add_fin_args(p)
    p.set_defaults(func=cmd_financiamento)

    p = sub.add_parser("rentabilidade", help="Renda líquida do aluguel e cap rate")
    add_imovel_args(p)
    p.set_defaults(func=cmd_rentabilidade)

    p = sub.add_parser("fluxo", help="Fluxo de caixa com financiamento")
    add_imovel_args(p)
    add_fin_args(p)
    p.set_defaults(func=cmd_fluxo)

    a = ap.parse_args(argv)
    if getattr(a, "entrada", None) is not None and not (0 <= a.entrada <= a.valor):
        ap.error("--entrada deve estar entre 0 e --valor")
    if getattr(a, "meses", 1) <= 0:
        ap.error("--meses deve ser maior que zero")
    if getattr(a, "vacancia_meses", 0) and not (0 <= a.vacancia_meses <= 12):
        ap.error("--vacancia-meses deve estar entre 0 e 12")
    a.func(a)


if __name__ == "__main__":
    sys.exit(main())
