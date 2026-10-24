import { test, expect } from "@playwright/test";

test("a mesma compra conserva a chave; cliente, recebimento, quantidade e conclusão renovam", async ({
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
  const keys: string[] = [];
  const requestIds: string[] = [];
  let success = false;
  await page.route("http://localhost:3003/orders", (route) => {
    const headers = route.request().headers();
    keys.push(headers["idempotency-key"]);
    requestIds.push(headers["x-request-id"]);
    expect(route.request().postDataJSON()).not.toHaveProperty("payment");
    return route.fulfill(
      success
        ? {
            status: 201,
            json: {
              id: "same-order",
              fulfillment: "pickup",
              deliveryAddress: null,
              totalCents: 12000,
            },
          }
        : { status: 503, json: { error: { message: "Tente novamente." } } },
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: /^Carrinho/ }).click();
  const submit = async () => {
    await page.getByRole("button", { name: "Finalizar compra" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  };
  await submit();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Carrinho/ }).click();
  await page.getByRole("radio", { name: /Cartão de teste/ }).check();
  await submit();
  expect(keys[1]).toBe(keys[0]);
  await page.getByRole("combobox").selectOption("customer-delivery");
  await submit();
  expect(keys[2]).not.toBe(keys[1]);
  await page.getByRole("radio", { name: /Receber em casa/ }).check();
  await submit();
  expect(keys[3]).not.toBe(keys[2]);
  await page.getByRole("spinbutton").fill("3");
  await submit();
  expect(keys[4]).not.toBe(keys[3]);
  success = true;
  await page.getByRole("button", { name: "Finalizar compra" }).click();
  await expect(
    page.getByText("Pedido confirmado!", { exact: true }),
  ).toBeVisible();
  expect(keys[5]).toBe(keys[4]);
  await page
    .getByRole("button", { name: "Continuar comprando", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Adicionar Caneca Demo ao carrinho" })
    .click();
  await page.getByRole("button", { name: /^Carrinho/ }).click();
  success = false;
  await submit();
  expect(keys[6]).not.toBe(keys[5]);
  keys.forEach((key) => expect(key).toMatch(/^[a-f0-9-]{36}$/));
  expect(new Set(requestIds).size).toBe(requestIds.length);
});
