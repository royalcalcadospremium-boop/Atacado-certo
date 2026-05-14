import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default async () => {
  render(<App />, document.body);
};

function App() {
  const { i18n, discounts } = shopify;
  const discountClassesSignalValue = discounts?.discountClasses?.value ?? [];

  // Garante que PRODUCT esteja ativo na primeira render
  if (
    discounts?.updateDiscountClasses &&
    !discountClassesSignalValue.includes("product")
  ) {
    discounts.updateDiscountClasses([
      ...discountClassesSignalValue,
      "product",
    ]);
  }

  return (
    <s-function-settings>
      <s-section>
        <s-stack gap="base">
          <s-heading>{i18n.translate("title")}</s-heading>
          <s-text>{i18n.translate("description")}</s-text>
          <s-banner tone="info">
            <s-text>{i18n.translate("info")}</s-text>
          </s-banner>
        </s-stack>
      </s-section>
    </s-function-settings>
  );
}
