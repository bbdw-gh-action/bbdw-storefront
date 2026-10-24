import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  money,
  request,
  urls,
  type Customer,
  type Order,
  type Product,
} from "./api";
import CheckoutPanel from "./CheckoutPanel";
import { Icon, ProductImage } from "./visuals";

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [customerId, setCustomerId] = useState("customer-pickup");
  const [cart, setCart] = useState<Record<string, number>>({
    "product-standard": 2,
  });
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">(
    "pickup",
  );
  const [payment, setPayment] = useState<"pix" | "card">("pix");
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const purchaseKey = useRef<string | null>(null);
  const cartButton = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(10000),
    ]);
    Promise.all([
      request<{ items: Product[] }>(`${urls.catalog}/products`, { signal }),
      Promise.all(
        ["customer-pickup", "customer-delivery"].map((id) =>
          request<Customer>(`${urls.users}/users/${id}`, { signal }),
        ),
      ),
    ])
      .then(([catalog, profiles]) => {
        setProducts(catalog.items);
        setCustomers(profiles);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLoadError(
            "Não foi possível carregar a loja. Tente recarregar a página.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const items = products.filter((product) => (cart[product.id] ?? 0) > 0);
  const count = items.reduce((sum, product) => sum + cart[product.id], 0);
  const total = items.reduce(
    (sum, product) => sum + product.priceCents * cart[product.id],
    0,
  );

  function changeQuantity(id: string, quantity: number) {
    if (
      inFlight.current ||
      order ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > 99
    )
      return;
    if ((cart[id] ?? 0) !== quantity) purchaseKey.current = null;
    setCart((previous) => ({ ...previous, [id]: quantity }));
    setError(null);
  }

  function continueShopping() {
    purchaseKey.current = null;
    setCart({});
    setOrder(null);
    setError(null);
    setFeedback("");
    setPayment("pix");
    setOpen(false);
  }

  async function checkout() {
    if (inFlight.current || order || items.length === 0) return;
    inFlight.current = true;
    purchaseKey.current ??= crypto.randomUUID();
    setPending(true);
    setError(null);
    try {
      const result = await request<Order>(`${urls.checkout}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": purchaseKey.current,
          ...(import.meta.env.VITE_SENTRY_RELEASE
            ? { "X-Client-Release": import.meta.env.VITE_SENTRY_RELEASE }
            : {}),
        },
        body: JSON.stringify({
          customerId,
          fulfillment,
          items: items.map((product) => ({
            productId: product.id,
            quantity: cart[product.id],
          })),
        }),
      });
      setOrder(result);
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure
          : new ApiError(
              "Não foi possível conectar ao checkout. Tente novamente.",
            ),
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="Loja Demo · BBDW, início">
            <span className="brand-mark" aria-hidden="true">
              <Icon name="bag" />
            </span>
            <span>
              Loja Demo <span className="brand-event">· BBDW</span>
            </span>
          </a>
          <div className="header-actions">
            <span className="demo-badge">
              <span /> Ambiente de demonstração
            </span>
            <button
              ref={cartButton}
              className="cart-button"
              onClick={() => setOpen(true)}
              disabled={loading || !!loadError}
              aria-haspopup="dialog"
              aria-controls="checkout-panel"
            >
              <Icon name="bag" /> Carrinho{" "}
              <span className="cart-count">{count}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="storefront">
        <section className="intro" aria-labelledby="store-title">
          <p className="eyebrow">
            <span /> PEQUENAS ESCOLHAS, BONS MOMENTOS
          </p>
          <h1 id="store-title">
            Seu dia merece
            <br />
            um toque de <span>amarelo.</span>
          </h1>
          <p className="intro-copy">
            Uma pausa para o café. Uma ideia no papel.
            <br />
            Encontre seu próximo favorito por aqui.
          </p>
          <div className="intro-note">
            <Icon name="spark" /> Uma loja fictícia. Uma experiência completa.
          </div>
          <span className="intro-decoration" aria-hidden="true">
            demo<span>✳</span>
          </span>
        </section>

        <section
          className="catalog"
          aria-labelledby="products-title"
          aria-busy={loading}
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">FEITO PARA O SEU DIA A DIA</p>
              <h2 id="products-title">Nossa seleção</h2>
            </div>
            {!loading && !loadError && (
              <span className="product-count">{products.length} produtos</span>
            )}
          </div>
          {loading && (
            <div className="loading-state" role="status">
              <span className="spinner" /> Preparando a loja…
            </div>
          )}
          {loadError && (
            <div className="alert" role="alert">
              <p>{loadError}</p>
              <button
                className="text-button"
                onClick={() => window.location.reload()}
              >
                Recarregar página <span aria-hidden="true">↗</span>
              </button>
            </div>
          )}
          {!loading && !loadError && (
            <>
              <div className="products">
                {products.map((product, index) => (
                  <article
                    className="product"
                    key={product.id}
                    aria-labelledby={`product-${product.id}`}
                  >
                    <div className={`product-art product-art-${index % 2}`}>
                      <ProductImage product={product} />
                      <span className="art-number" aria-hidden="true">
                        0{index + 1}
                      </span>
                    </div>
                    <div className="product-details">
                      <span className="product-label">COLEÇÃO DEMO</span>
                      <h3 id={`product-${product.id}`}>{product.name}</h3>
                      <p className="product-availability">
                        <span
                          className={
                            product.available
                              ? "availability-dot"
                              : "availability-dot unavailable"
                          }
                        />
                        {product.available
                          ? "Disponível na nossa seleção"
                          : "Indisponível no momento"}
                      </p>
                      <div className="product-purchase">
                        <p className="product-price">
                          {money(product.priceCents)}
                          <small>por unidade</small>
                        </p>
                        <button
                          className="add-button"
                          disabled={
                            pending ||
                            !!order ||
                            !product.available ||
                            (cart[product.id] ?? 0) >= 99
                          }
                          aria-label={`Adicionar ${product.name} ao carrinho`}
                          onClick={() => {
                            changeQuantity(
                              product.id,
                              (cart[product.id] ?? 0) + 1,
                            );
                            setFeedback(
                              `${product.name} adicionado. ${count + 1} itens no carrinho.`,
                            );
                          }}
                        >
                          <Icon name="plus" />
                          {product.available ? "Adicionar" : "Indisponível"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div
                className="catalog-feedback"
                role="status"
                aria-live="polite"
              >
                {order ? (
                  <span>
                    Pedido confirmado!{" "}
                    <button
                      className="text-button"
                      onClick={() => setOpen(true)}
                    >
                      Ver pedido e continuar comprando{" "}
                      <span aria-hidden="true">→</span>
                    </button>
                  </span>
                ) : (
                  feedback
                )}
              </div>
            </>
          )}
        </section>

        <div className="store-note">
          <Icon name="store" />
          <div>
            <strong>Do seu jeito, até o final.</strong>
            <p>
              Escolha seus favoritos e decida no carrinho: receber em casa ou
              retirar na loja.
            </p>
          </div>
          <span aria-hidden="true">↗</span>
        </div>
      </main>
      <footer className="site-footer">
        <span>
          Loja Demo <strong>· BBDW</strong>
        </span>
        <span>Produtos fictícios. Nenhuma cobrança real.</span>
        <span>
          Feito para experimentar <span aria-hidden="true">↗</span>
        </span>
      </footer>

      <CheckoutPanel
        open={open}
        onDismiss={() => setOpen(false)}
        returnFocusRef={cartButton}
        items={items}
        cart={cart}
        count={count}
        total={total}
        customers={customers}
        customerId={customerId}
        fulfillment={fulfillment}
        payment={payment}
        pending={pending}
        error={error}
        order={order}
        onQuantity={changeQuantity}
        onCustomer={(value) => {
          setCustomerId(value);
          if (value !== customerId) purchaseKey.current = null;
          setError(null);
        }}
        onFulfillment={(value) => {
          setFulfillment(value);
          if (value !== fulfillment) purchaseKey.current = null;
          setError(null);
        }}
        onPayment={(value) => {
          setPayment(value);
          setError(null);
        }}
        onCheckout={checkout}
        onContinue={continueShopping}
      />
    </>
  );
}
