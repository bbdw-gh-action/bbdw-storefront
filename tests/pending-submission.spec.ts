import { test, expect } from "@playwright/test";

test("uma compra pendente bloqueia também um segundo clique tardio", async ({
  page,
}) => {
  await page.route("https://sentry.invalid/**", (route) =>
    route.fulfill({ json: {} }),
  );
  await page.route("http://localhost:3002/**", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "product-standard",
            name: "Caneca Demo",
            priceCents: 4000,
            available: true,
            thumbnailUrl: null,
          },
        ],
      },
    }),
  );
  await page.route("http://localhost:3001/**", (route) =>
    route.fulfill({
      json: {
        id: route.request().url().split("/").at(-1),
        name: "Cliente Demo",
        address: null,
      },
    }),
  );
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route("http://localhost:3003/orders", async (route) => {
    calls++;
    await pending;
    await route.fulfill({
      status: 201,
      json: {
        id: "only-order",
        fulfillment: "pickup",
        deliveryAddress: null,
        totalCents: 8000,
      },
    });
  });
  try {
    await page.goto("/");
    await page.getByRole("button", { name: /^Carrinho/ }).click();
    const submit = page.locator(".panel-footer .primary");
    await submit.click();
    await expect.poll(() => calls).toBe(1);
    // Uma requisição continua pendente além de uma janela usual de debounce.
    await page.waitForTimeout(1600);
    const duplicate = page
      .waitForRequest((request) => request.url().endsWith("/orders"), {
        timeout: 500,
      })
      .catch(() => null);
    await submit.evaluate((button: HTMLButtonElement) => button.click());
    expect(
      await duplicate,
      "não pode haver outra requisição enquanto a primeira está pendente",
    ).toBeNull();
    expect(calls).toBe(1);
    await expect(submit).toBeDisabled();
    release();
    await expect(
      page.getByText("Pedido confirmado!", { exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});
