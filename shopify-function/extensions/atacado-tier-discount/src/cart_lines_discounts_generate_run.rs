// Royal Atacado — Cart Lines Discounts Generate (Shopify Function, Rust)
//
// Aplica desconto progressivo no carrinho conforme a quantidade TOTAL de pares:
//   1-9 pares   → preço cheio (varejo, sem desconto)
//   10-49       → preço de atacado (lido do metafield custom.preco_atacado por produto)
//   50-99       → atacado − R$ 1 por par
//   100-199     → atacado − R$ 2 por par
//   200+        → atacado − R$ 3 por par

use shopify_function::prelude::*;
use shopify_function::Result;

struct Tier {
    qty: i64,
    extra: f64,
    label: &'static str,
}

const TIERS: &[Tier] = &[
    Tier { qty: 200, extra: 3.0, label: "Atacado 200+ pares (-R$ 3/par)" },
    Tier { qty: 100, extra: 2.0, label: "Atacado 100+ pares (-R$ 2/par)" },
    Tier { qty: 50,  extra: 1.0, label: "Atacado 50+ pares (-R$ 1/par)"  },
    Tier { qty: 10,  extra: 0.0, label: "Atacado 10+ pares"              },
];

#[shopify_function_target(
    query_path = "src/cart_lines_discounts_generate_run.graphql",
    schema_path = "schema.graphql"
)]
fn cart_lines_discounts_generate_run(
    input: input::ResponseData,
) -> Result<output::CartLinesDiscountsGenerateRunResult> {
    let lines = &input.cart.lines;
    if lines.is_empty() {
        return Ok(output::CartLinesDiscountsGenerateRunResult { operations: vec![] });
    }

    let has_product_discount_class = input
        .discount
        .discount_classes
        .contains(&input::DiscountClass::PRODUCT);
    if !has_product_discount_class {
        return Ok(output::CartLinesDiscountsGenerateRunResult { operations: vec![] });
    }

    let total_qty: i64 = lines.iter().map(|l| l.quantity).sum();
    if total_qty < 10 {
        return Ok(output::CartLinesDiscountsGenerateRunResult { operations: vec![] });
    }

    let tier = match TIERS.iter().find(|t| total_qty >= t.qty) {
        Some(t) => t,
        None => return Ok(output::CartLinesDiscountsGenerateRunResult { operations: vec![] }),
    };

    let mut candidates: Vec<output::ProductDiscountCandidate> = Vec::new();

    for line in lines.iter() {
        let merch = match &line.merchandise {
            input::InputCartLinesMerchandise::ProductVariant(pv) => pv,
            _ => continue,
        };

        // varejo (variant.price): amountPerQuantity
        let retail_per_unit_str = line.cost.amount_per_quantity.amount.to_string();
        let retail_per_unit: f64 = match retail_per_unit_str.parse() {
            Ok(v) if v > 0.0 => v,
            _ => continue,
        };

        // atacado (metafield)
        let wholesale_meta = match &merch.product.preco_atacado {
            Some(m) => &m.value,
            None => continue,
        };
        let wholesale: f64 = match wholesale_meta.parse() {
            Ok(v) if v > 0.0 => v,
            _ => continue,
        };
        if wholesale >= retail_per_unit {
            continue;
        }

        let final_atacado = (wholesale - tier.extra).max(0.0);
        let discount_per_unit = retail_per_unit - final_atacado;
        if discount_per_unit <= 0.0 {
            continue;
        }
        let total_line_discount = discount_per_unit * (line.quantity as f64);
        // Arredonda pra 2 casas
        let rounded = (total_line_discount * 100.0).round() / 100.0;

        candidates.push(output::ProductDiscountCandidate {
            targets: vec![output::ProductDiscountCandidateTarget::CartLine(
                output::CartLineTarget {
                    id: line.id.clone(),
                    quantity: None,
                },
            )],
            message: Some(tier.label.to_string()),
            value: output::ProductDiscountCandidateValue::FixedAmount(
                output::ProductDiscountCandidateFixedAmount {
                    amount: Decimal(rounded),
                    applies_to_each_item: Some(false),
                },
            ),
            associated_discount_code: None,
        });
    }

    if candidates.is_empty() {
        return Ok(output::CartLinesDiscountsGenerateRunResult { operations: vec![] });
    }

    Ok(output::CartLinesDiscountsGenerateRunResult {
        operations: vec![output::CartOperation::ProductDiscountsAdd(
            output::ProductDiscountsAddOperation {
                selection_strategy: output::ProductDiscountSelectionStrategy::ALL,
                candidates,
            },
        )],
    })
}
