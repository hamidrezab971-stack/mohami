/*
 * MO.HAMI — Storefront interactions
 *
 * Set whatsappNumber to the support number with country code (digits only).
 * Keep paymentEnabled false until a secure backend and payment provider exist.
 */
const CONFIG = {
  whatsappNumber: "09965329636",
  instagramUrl: "1hamidb",
  paymentEnabled: false
};

// Edit this list to update the products shown in the shop and Style Lab.
// Image paths below match files currently present in assets/.
const PRODUCTS = [
  {
    id: "top-1",
    name: "Essential Tee 01",
    category: "top",
    label: "بالاتنه",
    price: 890000,
    image: "assets/IMG_4192.png.jpeg",
    sizes: ["S", "M", "L", "XL"]
  },
  {
    id: "top-2",
    name: "Essential Tee 02",
    category: "top",
    label: "بالاتنه",
    price: 1250000,
    image: "assets/IMG_4211.jpeg",
    sizes: ["S", "M", "L", "XL"]
  },
  {
    id: "bottom-1",
    name: "Everyday Bottom 01",
    category: "bottom",
    label: "پایین‌تنه",
    price: 1450000,
    image: "assets/IMG_4212.jpeg",
    sizes: ["S", "M", "L", "XL"]
  },
  {
    id: "bottom-2",
    name: "Everyday Bottom 02",
    category: "bottom",
    label: "پایین‌تنه",
    price: 1690000,
    image: "assets/IMG_4213.jpeg",
    sizes: ["S", "M", "L", "XL"]
  },
  {
    id: "shoes-1",
    name: "Everyday Shoes 01",
    category: "shoes",
    label: "کفش",
    price: 2250000,
    image: "assets/IMG_4214.jpeg",
    sizes: ["39", "40", "41", "42", "43", "44"]
  },
  {
    id: "shoes-2",
    name: "Everyday Shoes 02",
    category: "shoes",
    label: "کفش",
    price: 1980000,
    image: "assets/IMG_4215.jpeg",
    sizes: ["39", "40", "41", "42", "43", "44"]
  },
  {
    id: "accessory-1",
    name: "Signature Accessory",
    category: "accessory",
    label: "اکسسوری",
    price: 650000,
    image: "assets/IMG_4216.jpeg",
    sizes: ["Free size"]
  }
];

const CATEGORIES = [
  { key: "top", label: "بالاتنه", number: "01" },
  { key: "bottom", label: "پایین‌تنه", number: "02" },
  { key: "shoes", label: "کفش", number: "03" },
  { key: "accessory", label: "اکسسوری", number: "04" }
];

const CART_STORAGE_KEY = "mohami-cart";
const LOOK_STORAGE_KEY = "mohami-look";
const THEME_STORAGE_KEY = "mohami-theme";
let activeShopFilter = "all";
let activeStyleFilter = "all";
let searchTerm = "";
let toastTimer;
let cart = {};
let lookSelection = {};
let selectedSizes = {};
let checkoutReturnFocus = null;
let revealObserver = null;

function getById(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });
}

function normalizeText(value) {
  return String(value)
    .toLocaleLowerCase("fa")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک");
}

function formatPrice(price) {
  return `${new Intl.NumberFormat("fa-IR").format(price)} تومان`;
}

function showToast(message) {
  const toast = getById("toast");
  if (!toast) {
    console.warn(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3200);
}

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.warn(`Could not read "${key}" from localStorage.`, error);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Could not save "${key}" to localStorage.`, error);
    showToast("ذخیره‌سازی در مرورگر در دسترس نیست.");
    return false;
  }
}

function getProduct(productId) {
  return PRODUCTS.find(product => product.id === productId);
}

function getLineKey(productId, size) {
  return `${productId}::${size}`;
}

function parseLineKey(key) {
  const separator = key.indexOf("::");
  if (separator < 1) return null;

  return {
    productId: key.slice(0, separator),
    size: key.slice(separator + 2)
  };
}

function normalizeCart(savedCart) {
  const result = {};
  if (!savedCart || typeof savedCart !== "object" || Array.isArray(savedCart)) {
    return result;
  }

  Object.entries(savedCart).forEach(([key, rawQuantity]) => {
    const quantity = Number(rawQuantity);
    if (!Number.isInteger(quantity) || quantity < 1) return;

    const existingLine = parseLineKey(key);
    const productId = existingLine ? existingLine.productId : key;
    const product = getProduct(productId);
    if (!product) return;

    // Keep old carts usable; older versions stored only product ID and count.
    const size = existingLine && existingLine.size
      ? existingLine.size
      : "سایز ثبت‌نشده";
    const lineKey = getLineKey(productId, size);

    result[lineKey] = Math.min(99, (result[lineKey] || 0) + quantity);
  });

  return result;
}

function normalizeLook(savedLook) {
  const result = {};
  if (!savedLook || typeof savedLook !== "object" || Array.isArray(savedLook)) {
    return result;
  }

  CATEGORIES.forEach(category => {
    const product = getProduct(savedLook[category.key]);
    if (product && product.category === category.key) {
      result[category.key] = product.id;
    }
  });

  return result;
}

function cartEntries() {
  return Object.entries(cart).reduce((entries, [key, rawQuantity]) => {
    const line = parseLineKey(key);
    const product = line && getProduct(line.productId);
    const quantity = Number(rawQuantity);

    if (product && line.size && Number.isInteger(quantity) && quantity > 0) {
      entries.push({ key, product, size: line.size, quantity });
    }
    return entries;
  }, []);
}

function cartQuantity() {
  return cartEntries().reduce((total, item) => total + item.quantity, 0);
}

function cartTotal() {
  return cartEntries().reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );
}

function renderProductCard(product, mode) {
  const selected = lookSelection[product.category] === product.id;
  const image = escapeHtml(product.image);
  const productId = escapeHtml(product.id);
  const productName = escapeHtml(product.name);
  const productLabel = escapeHtml(product.label);

  let actionMarkup;
  if (mode === "shop") {
    const savedSize = product.sizes.includes(selectedSizes[product.id])
      ? selectedSizes[product.id]
      : "";
    const options = product.sizes.map(size => `
      <option value="${escapeHtml(size)}"${size === savedSize ? " selected" : ""}>
        ${escapeHtml(size)}
      </option>
    `).join("");

    actionMarkup = `
      <label class="product-category">
        انتخاب سایز
        <select class="product-select" data-product-size="${productId}"
                aria-label="انتخاب سایز ${productName}"
                aria-required="true" required>
          <option value="">انتخاب سایز</option>
          ${options}
        </select>
      </label>
      <div class="product-actions">
        <button class="product-select" type="button" data-add-cart="${productId}">
          افزودن به سبد
        </button>
        <button class="quick-add" type="button" data-add-cart="${productId}"
                aria-label="افزودن ${productName} به سبد خرید">+</button>
      </div>
    `;
  } else {
    actionMarkup = `
      <button class="product-select${selected ? " is-selected" : ""}"
              type="button" data-select-look="${productId}"
              aria-pressed="${selected}">
        ${selected ? "✓ انتخاب شده" : "+ انتخاب در استایل"}
      </button>
    `;
  }

  return `
    <article class="product-card" data-reveal>
      <div class="product-image image-frame">
        <img src="${image}" alt="${productName}" loading="lazy">
        <span class="product-tag">${productLabel}</span>
      </div>
      <div class="product-info">
        <h3 class="product-name">${productName}</h3>
        <div class="product-category">${escapeHtml(product.category.toUpperCase())}</div>
        <div class="product-price">${formatPrice(product.price)}</div>
        ${actionMarkup}
      </div>
    </article>
  `;
}

function renderCollection() {
  const grid = getById("collectionGrid");
  if (!grid) return;

  const visibleProducts = PRODUCTS.filter(product => {
    const categoryMatches =
      activeShopFilter === "all" || product.category === activeShopFilter;
    const searchableText = normalizeText(
      `${product.name} ${product.label} ${product.category}`
    );
    return categoryMatches && searchableText.includes(normalizeText(searchTerm));
  });

  clearRevealElements(grid);
  grid.innerHTML = visibleProducts
    .map(product => renderProductCard(product, "shop"))
    .join("");
  observeRevealElements(grid);

  const emptyState = getById("emptyProducts");
  if (emptyState) emptyState.hidden = visibleProducts.length > 0;

  const resultLabel = getById("productResultsLabel");
  if (resultLabel) {
    resultLabel.textContent =
      `${new Intl.NumberFormat("fa-IR").format(visibleProducts.length)} محصول / THE ESSENTIALS`;
  }
}

function renderStyleProducts() {
  const grid = getById("labProductGrid");
  if (!grid) return;

  const visibleProducts = PRODUCTS.filter(product =>
    activeStyleFilter === "all" || product.category === activeStyleFilter
  );
  clearRevealElements(grid);
  grid.innerHTML = visibleProducts
    .map(product => renderProductCard(product, "style"))
    .join("");
  observeRevealElements(grid);
}

function renderLook() {
  const selectedItems = getById("selectedItems");
  const chosenProducts = CATEGORIES.map(category => ({
    category,
    product: getProduct(lookSelection[category.key])
  }));
  const count = chosenProducts.filter(item => item.product).length;
  const total = chosenProducts.reduce(
    (sum, item) => sum + (item.product ? item.product.price : 0),
    0
  );

  if (selectedItems) {
    selectedItems.innerHTML = chosenProducts.map(({ category, product }) => {
      if (!product) {
        return `
          <div class="selected-row">
            <div class="slot-placeholder">${category.number}</div>
            <div class="selected-info">
              <span>${escapeHtml(category.label)}</span>
              <strong>هنوز انتخاب نشده</strong>
            </div>
            <span aria-hidden="true">+</span>
          </div>
        `;
      }

      return `
        <div class="selected-row">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}"
               loading="lazy">
          <div class="selected-info">
            <span>${escapeHtml(category.label)}</span>
            <strong>${escapeHtml(product.name)}</strong>
            <small>${formatPrice(product.price)}</small>
          </div>
          <button class="remove-item" type="button"
                  data-remove-look="${escapeHtml(category.key)}"
                  aria-label="حذف ${escapeHtml(category.label)}">×</button>
        </div>
      `;
    }).join("");
  }

  const countLabel = getById("lookCount");
  if (countLabel) {
    countLabel.textContent = `${new Intl.NumberFormat("fa-IR").format(count)} / ۴`;
  }

  const progressBar = getById("progressBar");
  if (progressBar) {
    progressBar.style.width = `${count / CATEGORIES.length * 100}%`;
    const progressTrack = progressBar.parentElement;
    if (progressTrack) {
      progressTrack.setAttribute("role", "progressbar");
      progressTrack.setAttribute("aria-label", "تعداد آیتم‌های انتخاب‌شده");
      progressTrack.setAttribute("aria-valuemin", "0");
      progressTrack.setAttribute("aria-valuemax", String(CATEGORIES.length));
      progressTrack.setAttribute("aria-valuenow", String(count));
      progressTrack.removeAttribute("aria-hidden");
    }
  }

  const totalLabel = getById("lookTotalPrice");
  if (totalLabel) totalLabel.textContent = formatPrice(total);
}

function renderCart() {
  const entries = cartEntries();
  const countLabel = getById("cartCount");
  const itemsContainer = getById("cartItems");
  const emptyState = getById("cartEmpty");
  const drawerBottom = getById("drawerBottom");
  const totalLabel = getById("cartTotal");
  const checkoutTotalLabel = getById("checkoutTotal");

  if (countLabel) {
    countLabel.textContent = new Intl.NumberFormat("fa-IR").format(cartQuantity());
  }
  if (totalLabel) totalLabel.textContent = formatPrice(cartTotal());
  if (checkoutTotalLabel) checkoutTotalLabel.textContent = formatPrice(cartTotal());
  if (emptyState) emptyState.classList.toggle("is-visible", entries.length === 0);
  if (drawerBottom) drawerBottom.hidden = entries.length === 0;

  const checkoutButton = getById("checkoutOpen");
  if (checkoutButton) checkoutButton.disabled = entries.length === 0;

  if (!itemsContainer) return;
  itemsContainer.innerHTML = entries.map(({ key, product, size, quantity }) => `
    <article class="cart-row">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}"
           loading="lazy">
      <div>
        <h3>${escapeHtml(product.name)}</h3>
        <div class="cart-category">${escapeHtml(product.label)} · سایز ${escapeHtml(size)}</div>
        <div class="cart-price">${formatPrice(product.price * quantity)}</div>
        <div class="quantity-control">
          <button type="button" data-qty-change="${escapeHtml(key)}" data-delta="-1"
                  aria-label="کم کردن تعداد ${escapeHtml(product.name)}، سایز ${escapeHtml(size)}">−</button>
          <span>${new Intl.NumberFormat("fa-IR").format(quantity)}</span>
          <button type="button" data-qty-change="${escapeHtml(key)}" data-delta="1"
                  aria-label="زیاد کردن تعداد ${escapeHtml(product.name)}، سایز ${escapeHtml(size)}">+</button>
        </div>
      </div>
      <button class="cart-remove" type="button" data-remove-cart="${escapeHtml(key)}"
              aria-label="حذف ${escapeHtml(product.name)}، سایز ${escapeHtml(size)}">×</button>
    </article>
  `).join("");
}

function renderAll() {
  renderCollection();
  renderStyleProducts();
  renderLook();
  renderCart();
}

function saveCart() {
  return writeStorage(CART_STORAGE_KEY, cart);
}

function saveLook() {
  return writeStorage(LOOK_STORAGE_KEY, lookSelection);
}

function addToCart(productId, triggerElement) {
  const product = getProduct(productId);
  if (!product) return;

  const size = selectedSizes[productId];
  if (!product.sizes.includes(size)) {
    showToast("برای افزودن محصول، ابتدا سایز آن را انتخاب کن.");
    const card = triggerElement && triggerElement.closest(".product-card");
    const sizeSelect = card
      ? card.querySelector("[data-product-size]")
      : null;
    if (sizeSelect) sizeSelect.focus();
    return;
  }

  const key = getLineKey(productId, size);
  const currentQuantity = Number(cart[key]) || 0;
  if (currentQuantity >= 99) {
    showToast("حداکثر تعداد هر محصول و سایز ۹۹ عدد است.");
    return;
  }

  cart[key] = currentQuantity + 1;
  const saved = saveCart();
  renderCart();
  showToast(saved
    ? `${product.name}، سایز ${size} به سبد اضافه شد.`
    : "محصول در سبد این نشست اضافه شد، اما در مرورگر ذخیره نشد.");
}

function openMenu() {
  const menu = getById("menuOverlay");
  const toggle = getById("menuToggle");
  if (!menu || !toggle) return;

  menu.classList.add("is-open");
  menu.inert = false;
  menu.setAttribute("aria-hidden", "false");
  toggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("menu-open");

  const closeButton = getById("menuClose");
  if (closeButton) closeButton.focus();
}

function closeMenu(restoreFocus = true) {
  const menu = getById("menuOverlay");
  const toggle = getById("menuToggle");
  if (!menu || !toggle) return;

  menu.classList.remove("is-open");
  menu.inert = true;
  menu.setAttribute("aria-hidden", "true");
  toggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
  if (restoreFocus) toggle.focus();
}

function openCart() {
  const drawer = getById("cartDrawer");
  const backdrop = getById("cartBackdrop");
  if (!drawer || !backdrop) return;

  backdrop.hidden = false;
  window.requestAnimationFrame(() => backdrop.classList.add("is-visible"));
  drawer.classList.add("is-open");
  drawer.inert = false;
  drawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("drawer-open");

  const closeButton = getById("cartClose");
  if (closeButton) closeButton.focus();
}

function closeCart(restoreFocus = true) {
  const drawer = getById("cartDrawer");
  const backdrop = getById("cartBackdrop");
  if (!drawer || !backdrop) return;

  backdrop.classList.remove("is-visible");
  drawer.classList.remove("is-open");
  drawer.inert = true;
  drawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("drawer-open");
  window.setTimeout(() => {
    if (!drawer.classList.contains("is-open")) backdrop.hidden = true;
  }, 260);

  if (restoreFocus) {
    const cartButton = getById("cartToggle");
    if (cartButton) cartButton.focus();
  }
}

function openCheckout() {
  if (cartEntries().length === 0) {
    showToast("سبد خریدت خالیه.");
    return;
  }

  const modal = getById("checkoutModal");
  if (!modal) return;

  checkoutReturnFocus = getById("cartToggle");
  closeCart(false);
  modal.classList.add("is-open");
  modal.inert = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  const status = getById("paymentStatus");
  if (status) {
    status.textContent = CONFIG.paymentEnabled
      ? "وضعیت اتصال پرداخت باید از طریق یک بک‌اند امن بررسی شود."
      : "درگاه پرداخت متصل نیست. هیچ پرداختی انجام نمی‌شود و اطلاعات این فرم از مرورگر خارج نخواهد شد.";
  }

  const nameInput = modal.querySelector('[name="fullName"]');
  if (nameInput) nameInput.focus();
}

function closeCheckout(restoreFocus = true) {
  const modal = getById("checkoutModal");
  if (!modal) return;

  modal.classList.remove("is-open");
  modal.inert = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  if (restoreFocus) {
    const returnFocus = checkoutReturnFocus && checkoutReturnFocus.isConnected
      ? checkoutReturnFocus
      : getById("cartToggle");
    if (returnFocus) returnFocus.focus();
  }
  checkoutReturnFocus = null;
}

function trapFocus(event, container) {
  const focusable = Array.from(container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(element => {
    if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
    return typeof element.getClientRects !== "function" || element.getClientRects().length > 0;
  });

  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
}

function updateFilterButtons(attribute, selectedValue) {
  document.querySelectorAll(`[${attribute}]`).forEach(button => {
    const isSelected = button.getAttribute(attribute) === selectedValue;
    button.classList.toggle("is-active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function clearRevealElements(container) {
  if (!revealObserver) return;
  container.querySelectorAll("[data-reveal]").forEach(element => {
    revealObserver.unobserve(element);
  });
}

function observeRevealElements(scope = document) {
  const revealTargets = [];
  if (scope instanceof Element && scope.matches("[data-reveal]")) {
    revealTargets.push(scope);
  }
  if (typeof scope.querySelectorAll === "function") {
    revealTargets.push(...scope.querySelectorAll("[data-reveal]"));
  }

  revealTargets.forEach(element => {
    if (element.classList.contains("is-revealed")) return;
    if (revealObserver) {
      revealObserver.observe(element);
    } else {
      element.classList.add("is-revealed");
    }
  });
}

function initializeScrollReveal() {
  const reduceMotion = typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const revealSelector = [
    ".hero-media",
    ".hero-copy > .eyebrow",
    ".hero-copy h1",
    ".hero-description",
    ".hero-actions",
    ".hero-meta",
    ".section-heading",
    ".editorial-card",
    ".journal-card",
    ".product-card",
    ".lab-intro",
    ".lab-picker",
    ".look-panel",
    ".contact-copy",
    ".support-form",
    ".closing-inner"
  ].join(", ");
  document.querySelectorAll(revealSelector).forEach(element => {
    element.setAttribute("data-reveal", "");
  });

  if (typeof window.IntersectionObserver === "function") {
    revealObserver = new window.IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        revealObserver.unobserve(entry.target);
      });
    }, {
      rootMargin: "0px 0px -6% 0px",
      threshold: 0.12
    });
    document.documentElement.classList.add("has-scroll-reveal");
  }

  observeRevealElements();
}

function addToLook(productId) {
  const product = getProduct(productId);
  if (!product) return;

  lookSelection[product.category] = product.id;
  const saved = saveLook();
  renderStyleProducts();
  renderLook();
  showToast(saved
    ? `${product.name} به استایلت اضافه شد.`
    : "انتخاب در همین نشست اعمال شد، اما در مرورگر ذخیره نشد.");
}

function removeFromLook(categoryKey) {
  if (!CATEGORIES.some(category => category.key === categoryKey)) return;
  delete lookSelection[categoryKey];
  const saved = saveLook();
  renderStyleProducts();
  renderLook();
  showToast(saved
    ? "انتخاب از استایلت حذف شد."
    : "انتخاب در همین نشست حذف شد، اما تغییر ذخیره نشد.");
}

function removeCartLine(key) {
  if (!parseLineKey(key) || !Object.prototype.hasOwnProperty.call(cart, key)) return;
  delete cart[key];
  const saved = saveCart();
  renderCart();
  showToast(saved
    ? "محصول از سبد خرید حذف شد."
    : "محصول در همین نشست حذف شد، اما تغییر ذخیره نشد.");
}

function changeCartQuantity(key, delta) {
  if (!parseLineKey(key) || !Object.prototype.hasOwnProperty.call(cart, key)) return;
  const currentQuantity = Number(cart[key]) || 0;
  const nextQuantity = currentQuantity + delta;

  if (nextQuantity <= 0) {
    delete cart[key];
  } else {
    cart[key] = Math.min(99, nextQuantity);
    if (nextQuantity > 99) showToast("حداکثر تعداد هر محصول و سایز ۹۹ عدد است.");
  }

  saveCart();
  renderCart();
}

function buildOrderSummary() {
  const entries = cartEntries();
  if (entries.length === 0) return "سبد خرید خالی است.";

  const lines = entries.map(item =>
    `- ${item.product.name} | سایز ${item.size} | تعداد ${item.quantity} | ${formatPrice(item.product.price * item.quantity)}`
  );
  lines.push(`جمع قیمت نمونه: ${formatPrice(cartTotal())}`);
  return lines.join("\n");
}

function buildWhatsAppUrl(message) {
  const number = String(CONFIG.whatsappNumber || "").replace(/\D/g, "");
  if (number.length < 8) return "";
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function openSupport(message) {
  const url = buildWhatsAppUrl(message);
  if (!url) {
    showToast("شمارهٔ واتساپ پشتیبانی در تنظیمات script.js وارد نشده است.");
    return false;
  }

  try {
    const supportLink = document.createElement("a");
    supportLink.href = url;
    supportLink.target = "_blank";
    supportLink.rel = "noopener noreferrer";
    supportLink.hidden = true;
    document.body.appendChild(supportLink);
    supportLink.click();
    supportLink.remove();
    showToast("درخواست بازکردن واتساپ انجام شد؛ ارسال نهایی فقط با تأیید خودت است.");
    return true;
  } catch (error) {
    console.warn("Could not open WhatsApp support.", error);
    showToast("بازکردن واتساپ ممکن نشد؛ دوباره تلاش کن.");
    return false;
  }
}

function configureContactLinks() {
  const whatsappLink = getById("supportWhatsApp");
  const instagramLink = getById("supportInstagram");
  const hint = getById("supportConfigHint");

  if (whatsappLink) {
    whatsappLink.href = buildWhatsAppUrl(
      `سلام، برای محصولات mo.hami راهنمایی می‌خواهم.\n${buildOrderSummary()}`
    ) || "#contact";
  }
  if (instagramLink) {
    instagramLink.href = CONFIG.instagramUrl || "#contact";
    if (CONFIG.instagramUrl) {
      instagramLink.target = "_blank";
      instagramLink.rel = "noopener noreferrer";
    }
  }
  if (hint) {
    hint.hidden = Boolean(CONFIG.whatsappNumber && CONFIG.instagramUrl);
  }
}

function validateForm(form) {
  if (!form) return false;

  const requiredFields = form.querySelectorAll("[required]");
  requiredFields.forEach(field => {
    field.setCustomValidity(
      field.value.trim() ? "" : "لطفاً این فیلد را کامل کنید."
    );
  });

  const valid = form.reportValidity();
  requiredFields.forEach(field => field.setCustomValidity(""));
  return valid;
}

function handleSupportSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!validateForm(form)) {
    showToast("لطفاً فیلدهای فرم پشتیبانی را کامل و بررسی کن.");
    return;
  }

  const nameField = form.elements.namedItem("name");
  const phoneField = form.elements.namedItem("phone");
  const messageField = form.elements.namedItem("message");
  if (!nameField || !phoneField || !messageField) {
    showToast("فرم پشتیبانی کامل بارگذاری نشده است.");
    console.error("The support form is missing a required field.");
    return;
  }

  const name = nameField.value.trim();
  const phone = phoneField.value.trim();
  const message = messageField.value.trim();
  const supportMessage = [
    "سلام، پیام جدید از سایت mo.hami",
    `نام: ${name}`,
    `شماره تماس: ${phone}`,
    `پیام: ${message}`,
    "",
    "اقلام انتخاب‌شده:",
    buildOrderSummary()
  ].join("\n");

  openSupport(supportMessage);
}

function handleCheckoutSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;

  if (cartEntries().length === 0) {
    showToast("سبد خرید خالی است؛ امکان ادامهٔ درخواست وجود ندارد.");
    closeCheckout();
    return;
  }
  if (!validateForm(form)) {
    showToast("لطفاً اطلاعات لازم را در فرم بررسی کن.");
    return;
  }

  const status = getById("paymentStatus");
  const message = CONFIG.paymentEnabled
    ? "پرداخت از این صفحه انجام نمی‌شود؛ برای تکمیل فرایند به اتصال بک‌اند امن نیاز است."
    : "اطلاعات فرم معتبر است، اما ارسال یا ثبت سفارش انجام نشد. درگاه پرداخت متصل نیست و هیچ اطلاعات شخصی ارسال نشده است.";
  if (status) status.textContent = message;
  showToast("فرم بررسی شد؛ سفارش ثبت نشده و پرداختی انجام نشده است.");
}

function initialize() {
  const root = document.documentElement;
  if (!root || !document.body) {
    console.error("The storefront script requires document and body elements.");
    return;
  }
  if (root.dataset.mohamiInitialized === "true") return;
  root.dataset.mohamiInitialized = "true";

  cart = normalizeCart(readStorage(CART_STORAGE_KEY, {}));
  lookSelection = normalizeLook(readStorage(LOOK_STORAGE_KEY, {}));

  const savedTheme = readStorage(THEME_STORAGE_KEY, "dark");
  applyTheme(savedTheme === "light" ? "light" : "dark", false);

  configureContactLinks();
  initializeScrollReveal();
  renderAll();
  updateFilterButtons("data-shop-filter", activeShopFilter);
  updateFilterButtons("data-style-filter", activeStyleFilter);

  const themeToggle = getById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
      if (typeof document.startViewTransition === "function"
          && !(typeof window.matchMedia === "function"
            && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
        document.startViewTransition(() => applyTheme(nextTheme, true));
      } else {
        applyTheme(nextTheme, true);
      }
    });
  }

  const menuToggle = getById("menuToggle");
  const menuClose = getById("menuClose");
  if (menuToggle) menuToggle.addEventListener("click", openMenu);
  if (menuClose) menuClose.addEventListener("click", () => closeMenu());

  const menu = getById("menuOverlay");
  if (menu) {
    menu.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => closeMenu(false));
    });
  }

  const cartToggle = getById("cartToggle");
  const cartClose = getById("cartClose");
  const cartBackdrop = getById("cartBackdrop");
  if (cartToggle) cartToggle.addEventListener("click", openCart);
  if (cartClose) cartClose.addEventListener("click", () => closeCart());
  if (cartBackdrop) cartBackdrop.addEventListener("click", () => closeCart());

  const checkoutOpen = getById("checkoutOpen");
  const checkoutClose = getById("checkoutClose");
  const checkoutModal = getById("checkoutModal");
  if (checkoutOpen) checkoutOpen.addEventListener("click", openCheckout);
  if (checkoutClose) checkoutClose.addEventListener("click", () => closeCheckout());
  if (checkoutModal) {
    checkoutModal.addEventListener("click", event => {
      if (event.target === checkoutModal) closeCheckout();
    });
  }

  const continueShopping = getById("continueShopping");
  if (continueShopping) {
    continueShopping.addEventListener("click", () => closeCart(false));
  }

  const search = getById("productSearch");
  if (search) {
    search.addEventListener("input", event => {
      searchTerm = event.currentTarget.value.trim();
      renderCollection();
    });
  }

  document.querySelectorAll("[data-shop-filter]").forEach(button => {
    button.addEventListener("click", () => {
      activeShopFilter = button.getAttribute("data-shop-filter") || "all";
      updateFilterButtons("data-shop-filter", activeShopFilter);
      renderCollection();
    });
  });

  document.querySelectorAll("[data-style-filter]").forEach(button => {
    button.addEventListener("click", () => {
      activeStyleFilter = button.getAttribute("data-style-filter") || "all";
      updateFilterButtons("data-style-filter", activeStyleFilter);
      renderStyleProducts();
    });
  });

  const supportForm = getById("supportForm");
  const checkoutForm = getById("checkoutForm");
  if (supportForm) supportForm.addEventListener("submit", handleSupportSubmit);
  if (checkoutForm) checkoutForm.addEventListener("submit", handleCheckoutSubmit);

  const cartSupport = getById("cartSupport");
  const checkoutSupport = getById("checkoutSupport");
  if (cartSupport) {
    cartSupport.addEventListener("click", () => {
      openSupport(`سلام، دربارهٔ سبد خرید mo.hami سوال دارم.\n${buildOrderSummary()}`);
    });
  }
  if (checkoutSupport) {
    checkoutSupport.addEventListener("click", () => {
      openSupport(`سلام، دربارهٔ درخواست سفارش mo.hami راهنمایی می‌خواهم.\n${buildOrderSummary()}`);
    });
  }

  const saveLookButton = getById("saveLookBtn");
  const clearLookButton = getById("clearLookBtn");
  if (saveLookButton) {
    saveLookButton.addEventListener("click", () => {
      if (Object.keys(lookSelection).length === 0) {
        showToast("اول لباس‌های استایلت را انتخاب کن.");
        return;
      }
      if (writeStorage(LOOK_STORAGE_KEY, lookSelection)) {
        showToast("استایلت در همین مرورگر ذخیره شد.");
      }
    });
  }
  if (clearLookButton) {
    clearLookButton.addEventListener("click", () => {
      lookSelection = {};
      const saved = saveLook();
      renderStyleProducts();
      renderLook();
      showToast(saved
        ? "استایلت پاک شد."
        : "استایل در همین نشست پاک شد، اما تغییر ذخیره نشد.");
    });
  }

  // One delegated handler serves all controls inside dynamically rendered cards.
  document.addEventListener("click", event => {
    if (!(event.target instanceof Element)) return;

    const addButton = event.target.closest("[data-add-cart]");
    if (addButton) {
      addToCart(addButton.getAttribute("data-add-cart"), addButton);
      return;
    }

    const styleButton = event.target.closest("[data-select-look]");
    if (styleButton) {
      addToLook(styleButton.getAttribute("data-select-look"));
      return;
    }

    const removeLookButton = event.target.closest("[data-remove-look]");
    if (removeLookButton) {
      removeFromLook(removeLookButton.getAttribute("data-remove-look"));
      return;
    }

    const quantityButton = event.target.closest("[data-qty-change]");
    if (quantityButton) {
      const key = quantityButton.getAttribute("data-qty-change");
      const delta = Number(quantityButton.getAttribute("data-delta"));
      if (Number.isInteger(delta) && delta !== 0) changeCartQuantity(key, delta);
      return;
    }

    const removeCartButton = event.target.closest("[data-remove-cart]");
    if (removeCartButton) {
      removeCartLine(removeCartButton.getAttribute("data-remove-cart"));
    }
  });

  document.addEventListener("change", event => {
    if (!(event.target instanceof HTMLSelectElement)) return;

    const productId = event.target.getAttribute("data-product-size");
    if (!productId) return;
    const product = getProduct(productId);
    if (!product) return;

    if (product.sizes.includes(event.target.value)) {
      selectedSizes[productId] = event.target.value;
    } else {
      delete selectedSizes[productId];
    }
  });

  const supportWhatsApp = getById("supportWhatsApp");
  if (supportWhatsApp) {
    supportWhatsApp.addEventListener("click", event => {
      event.preventDefault();
      openSupport(
        `سلام، برای محصولات mo.hami راهنمایی می‌خواهم.\n${buildOrderSummary()}`
      );
    });
  }

  const supportInstagram = getById("supportInstagram");
  if (supportInstagram && !CONFIG.instagramUrl) {
    supportInstagram.addEventListener("click", event => {
      event.preventDefault();
      showToast("آدرس اینستاگرام در تنظیمات script.js وارد نشده است.");
    });
  }

  document.addEventListener("error", event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;

    const fallbacks = (image.dataset.fallbacks || "")
      .split("|")
      .filter(Boolean);
    const fallbackIndex = Number(image.dataset.fallbackIndex || 0);

    if (fallbacks[fallbackIndex]) {
      image.dataset.fallbackIndex = String(fallbackIndex + 1);
      image.src = fallbacks[fallbackIndex];
      return;
    }

    const parent = image.parentElement;
    if (parent) {
      ["image-frame", "product-image", "selected-row", "cart-row"].forEach(className => {
        if (parent.classList.contains(className)) parent.classList.add("image-missing");
      });
    }
  }, true);

  document.addEventListener("keydown", event => {
    const modal = getById("checkoutModal");
    const drawer = getById("cartDrawer");
    const menu = getById("menuOverlay");
    const checkoutDialog = modal && modal.querySelector('[role="dialog"]');
    const activeOverlay = checkoutDialog && modal.classList.contains("is-open")
      ? checkoutDialog
      : drawer && drawer.classList.contains("is-open")
        ? drawer
        : menu && menu.classList.contains("is-open")
          ? menu
          : null;

    if (event.key === "Escape") {
      if (modal && modal.classList.contains("is-open")) {
        closeCheckout();
      } else if (drawer && drawer.classList.contains("is-open")) {
        closeCart();
      } else if (menu && menu.classList.contains("is-open")) {
        closeMenu();
      }
      return;
    }

    if (event.key === "Tab" && activeOverlay) trapFocus(event, activeOverlay);
  });
}

function applyTheme(theme, savePreference) {
  const selectedTheme = theme === "light" ? "light" : "dark";
  if (document.body) document.body.dataset.theme = selectedTheme;
  document.documentElement.style.colorScheme = selectedTheme;

  const themeIcon = getById("themeIcon");
  const themeLabel = getById("themeLabel");
  const themeToggle = getById("themeToggle");
  if (selectedTheme === "dark") {
    if (themeIcon) themeIcon.textContent = "☼";
    if (themeLabel) themeLabel.textContent = "LIGHT";
    if (themeToggle) {
      themeToggle.setAttribute("aria-label", "فعال کردن حالت روشن");
      themeToggle.title = "Switch to Light Mode";
    }
  } else {
    if (themeIcon) themeIcon.textContent = "☾";
    if (themeLabel) themeLabel.textContent = "DARK";
    if (themeToggle) {
      themeToggle.setAttribute("aria-label", "فعال کردن حالت تاریک");
      themeToggle.title = "Switch to Dark Mode";
    }
  }

  if (savePreference) writeStorage(THEME_STORAGE_KEY, selectedTheme);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
  initialize();
}
