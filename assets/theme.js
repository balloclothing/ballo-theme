/**
 * Ballō theme scripts. Native Web Components only, no dependencies.
 */

/**
 * Side panel built on <dialog>. Any element with aria-controls pointing to the
 * dialog's id opens it; elements with [data-drawer-close] close it.
 */
class SideDrawer extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector('dialog');
    if (!this.dialog) return;

    this.toggles = document.querySelectorAll(`[aria-controls="${this.dialog.id}"]`);
    this.toggles.forEach((toggle) =>
      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        this.open(toggle);
      })
    );

    this.querySelectorAll('[data-drawer-close], [data-menu-close]').forEach((button) =>
      button.addEventListener('click', () => this.close())
    );

    // A click on the dialog element itself (not its content) is a click on the backdrop.
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) this.close();
    });

    this.dialog.addEventListener('close', () => {
      this.toggles.forEach((toggle) => toggle.setAttribute('aria-expanded', 'false'));
      this.lastFocus?.focus();
    });
  }

  open(trigger = document.activeElement) {
    this.lastFocus = trigger;
    if (!this.dialog.open) this.dialog.showModal();
    if (trigger?.hasAttribute?.('aria-expanded')) trigger.setAttribute('aria-expanded', 'true');
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }
}

if (!customElements.get('side-drawer')) customElements.define('side-drawer', SideDrawer);

/**
 * Mobile menu panel: a side drawer that closes itself when the screen grows to desktop size.
 */
class MenuDrawer extends SideDrawer {
  connectedCallback() {
    super.connectedCallback();
    this.desktopQuery = window.matchMedia('(min-width: 990px)');
    this.onBreakpointChange = (event) => {
      if (event.matches) this.close();
    };
    this.desktopQuery.addEventListener('change', this.onBreakpointChange);
  }

  disconnectedCallback() {
    this.desktopQuery?.removeEventListener('change', this.onBreakpointChange);
  }
}

if (!customElements.get('menu-drawer')) customElements.define('menu-drawer', MenuDrawer);

/**
 * Closes open header dropdowns (<details>) on outside click or Escape.
 */
document.addEventListener('click', (event) => {
  document.querySelectorAll('.site-nav__dropdown[open]').forEach((details) => {
    if (!details.contains(event.target)) details.removeAttribute('open');
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  document.querySelectorAll('.site-nav__dropdown[open]').forEach((details) => {
    details.removeAttribute('open');
    details.querySelector('summary')?.focus();
  });
});

/**
 * Filters a product grid by product line (chips with aria-pressed).
 * Each chip's data-filter holds a product id; an empty value shows everything.
 */
class FilterChips extends HTMLElement {
  connectedCallback() {
    this.chips = this.querySelectorAll('[data-filter]');
    this.items = this.querySelectorAll('.product-grid > [data-product-id]');
    this.status = this.querySelector('[data-filter-status]');
    this.chips.forEach((chip) => chip.addEventListener('click', () => this.select(chip)));
  }

  select(selected) {
    const filter = selected.dataset.filter;
    let visible = 0;

    this.chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip === selected)));
    this.items.forEach((item) => {
      const show = !filter || item.dataset.productId === filter;
      item.hidden = !show;
      if (show) visible += 1;
    });

    if (this.status) {
      const template = visible === 1 ? this.dataset.statusOne : this.dataset.statusOther;
      this.status.textContent = (template || '').replace('[count]', visible);
    }
  }
}

if (!customElements.get('filter-chips')) customElements.define('filter-chips', FilterChips);

/**
 * Cart helpers shared by the product form, the cart drawer and the cart page.
 */
const Cart = {
  /** Ids of every section that renders cart contents on this page. */
  sectionIds() {
    return [...document.querySelectorAll('cart-items[data-section]')].map((el) => el.dataset.section);
  },

  /** Replaces each <cart-items> block with the freshly rendered section HTML. */
  render(sections) {
    if (!sections) return;
    document.querySelectorAll('cart-items[data-section]').forEach((element) => {
      const html = sections[element.dataset.section];
      if (!html) return;
      const fresh = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-cart-content]');
      const current = element.querySelector('[data-cart-content]');
      if (fresh && current) current.innerHTML = fresh.innerHTML;
    });
    const count = document.querySelector('[data-cart-content] [data-item-count]')?.dataset.itemCount;
    if (count !== undefined) Cart.updateCount(Number(count));
  },

  /** Updates the header bubble and the cart link's accessible label. */
  updateCount(count) {
    document.querySelectorAll('[data-cart-count]').forEach((bubble) => {
      bubble.textContent = count;
      bubble.hidden = count === 0;
    });
    const link = document.getElementById('HeaderCartLink');
    if (link) {
      const template = count === 1 ? link.dataset.labelOne : link.dataset.labelOther;
      if (template) link.setAttribute('aria-label', template.replace('[count]', count));
    }
  },

  async request(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.description || data.message || response.statusText);
    return data;
  },
};

/**
 * Enhances cart contents (drawer and page): quantity buttons, typed quantities and remove links.
 */
class CartItems extends HTMLElement {
  connectedCallback() {
    this.status = this.querySelector('[data-cart-status]');

    this.addEventListener('click', (event) => {
      const stepper = event.target.closest('[data-quantity-change]');
      const remove = event.target.closest('[data-remove]');

      if (stepper) {
        const input = stepper.closest('.cart-item').querySelector('[data-quantity-input]');
        const quantity = Math.max(0, Number(input.value) + Number(stepper.dataset.quantityChange));
        this.change(stepper.closest('.cart-item'), quantity);
      } else if (remove) {
        event.preventDefault();
        this.change(remove.closest('.cart-item'), 0);
      }
    });

    this.addEventListener('change', (event) => {
      if (!event.target.matches('[data-quantity-input]')) return;
      const quantity = Math.max(0, Number.parseInt(event.target.value, 10) || 0);
      this.change(event.target.closest('.cart-item'), quantity);
    });

    // Keeps the Enter key in a quantity field from submitting the checkout form.
    this.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target.matches('[data-quantity-input]')) {
        event.preventDefault();
        event.target.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  async change(item, quantity) {
    const content = this.querySelector('[data-cart-content]');
    const line = item.dataset.line;
    const title = item.querySelector('.cart-item__title')?.textContent.trim();
    content.setAttribute('aria-busy', 'true');

    try {
      const cart = await Cart.request(`${window.Shopify?.routes?.root || '/'}cart/change.js`, {
        line: Number(line),
        quantity,
        sections: Cart.sectionIds(),
        sections_url: window.location.pathname,
      });
      Cart.render(cart.sections);
      Cart.updateCount(cart.item_count);
      this.announce(quantity === 0 ? this.dataset.removed : this.dataset.updated, title);

      // Return focus to the same line's control after re-render, or to the close button when the line is gone.
      const sameLine = this.querySelector(`.cart-item[data-line="${line}"] [data-quantity-input]`);
      (sameLine || this.closest('dialog')?.querySelector('[data-drawer-close]'))?.focus();
    } catch (error) {
      this.announce(error.message);
    } finally {
      this.querySelector('[data-cart-content]')?.removeAttribute('aria-busy');
    }
  }

  announce(template, title = '') {
    if (this.status && template) this.status.textContent = template.replace('[product]', title);
  }
}

if (!customElements.get('cart-items')) customElements.define('cart-items', CartItems);

/**
 * Cart drawer. The header cart link opens it instead of navigating (except on the cart page).
 */
class CartDrawer extends SideDrawer {
  connectedCallback() {
    super.connectedCallback();
    this.headerLink = document.getElementById('HeaderCartLink');
    if (this.headerLink && !document.body.classList.contains('template-cart')) {
      this.headerLink.addEventListener('click', (event) => {
        event.preventDefault();
        this.open(this.headerLink);
      });
    }
  }
}

if (!customElements.get('cart-drawer')) customElements.define('cart-drawer', CartDrawer);

/**
 * Product page: variant selection, weight (sibling product) link, gallery filtering and add to cart.
 */
class ProductInfo extends HTMLElement {
  connectedCallback() {
    const json = this.querySelector('[data-product-json]');
    if (!json) return;
    this.data = JSON.parse(json.textContent);

    const siblingJson = this.querySelector('[data-sibling-json]');
    this.sibling = siblingJson ? JSON.parse(siblingJson.textContent) : null;

    this.form = this.querySelector('form.product-form');
    this.variantInput = this.querySelector('[data-variant-id]');
    this.selected = this.currentVariant()?.options.slice() || [];

    this.querySelectorAll('[data-option-group]').forEach((group) => {
      const index = Number(group.dataset.optionGroup);
      group.querySelectorAll('button[data-value]').forEach((button) =>
        button.addEventListener('click', () => this.selectOption(index, button.dataset.value))
      );
    });

    this.form?.addEventListener('submit', (event) => this.addToCart(event));
    this.updateSiblingLink();
  }

  currentVariant() {
    const id = Number(this.variantInput?.value);
    return this.data.variants.find((variant) => variant.id === id);
  }

  findVariant(options) {
    return this.data.variants.find((variant) => variant.options.every((value, i) => value === options[i]));
  }

  selectOption(index, value) {
    this.selected[index] = value;
    let variant = this.findVariant(this.selected);

    // The exact combination does not exist: keep the chosen value and pick the closest variant.
    if (!variant) {
      const matches = this.data.variants.filter((v) => v.options[index] === value);
      variant = matches.find((v) => v.available) || matches[0];
      if (variant) this.selected = variant.options.slice();
    }

    this.update(variant);
  }

  update(variant) {
    const { colorIndex, sizeIndex, strings } = this.data;

    this.querySelectorAll('[data-option-group]').forEach((group) => {
      const index = Number(group.dataset.optionGroup);
      group.querySelectorAll('button[data-value]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.value === this.selected[index]));
      });
      const label = group.querySelector('[data-selected-value]');
      if (label) label.textContent = this.selected[index];
    });

    // Sizes that are sold out for the selected color.
    if (sizeIndex >= 0) {
      this.querySelectorAll(`[data-option-group="${sizeIndex}"] button[data-value]`).forEach((button) => {
        const options = this.selected.slice();
        options[sizeIndex] = button.dataset.value;
        const available = Boolean(this.findVariant(options)?.available);
        button.toggleAttribute('data-unavailable', !available);
        const hint = button.querySelector('[data-unavailable-label]');
        if (hint) hint.hidden = available;
      });
    }

    const button = this.querySelector('[data-add-button]');
    const buttonLabel = this.querySelector('[data-add-label]');

    if (!variant) {
      button.disabled = true;
      buttonLabel.textContent = strings.unavailable;
      return;
    }

    this.variantInput.value = variant.id;
    window.history.replaceState({}, '', variant.url);

    this.querySelector('[data-price]').textContent = variant.price;
    const compare = this.querySelector('[data-compare-price]');
    if (compare) {
      compare.textContent = variant.compare || '';
      compare.hidden = !variant.compare;
    }

    const title = this.querySelector('[data-product-title]');
    const baseTitle = title.textContent.split(' — ')[0];
    title.textContent = colorIndex >= 0 ? `${baseTitle} — ${variant.options[colorIndex]}` : baseTitle;

    button.disabled = !variant.available;
    if (!variant.available) {
      buttonLabel.textContent = strings.soldOut;
    } else if (sizeIndex >= 0) {
      buttonLabel.textContent = strings.addToCartSize.replace('[size]', variant.options[sizeIndex]);
    } else {
      buttonLabel.textContent = strings.addToCart;
    }

    if (colorIndex >= 0) this.filterGallery(variant.options[colorIndex]);
    this.updateSiblingLink();
  }

  /** Shows the photos of the selected color; photos without a color are always shown. */
  filterGallery(color) {
    const gallery = this.querySelector('[data-gallery]');
    if (!gallery) return;
    const items = [...gallery.children];
    const hasColor = items.some((item) => item.dataset.color === color);

    items.forEach((item) => {
      item.hidden = hasColor && item.dataset.color !== '' && item.dataset.color !== color;
    });

    const first = items.find((item) => !item.hidden)?.querySelector('img');
    if (first) first.loading = 'eager';
    gallery.scrollTo({ left: 0 });
  }

  /** Points the other weight's button to the same color and size when that variant exists. */
  updateSiblingLink() {
    const link = this.querySelector('[data-sibling-link]');
    if (!link || !this.sibling) return;

    const wanted = {};
    this.data.options.forEach((name, i) => (wanted[name.toLowerCase()] = this.selected[i]));
    const names = this.sibling.options.map((name) => name.toLowerCase());

    const matches = (variant, keys) =>
      keys.every((key) => {
        const i = names.indexOf(key);
        return i === -1 || wanted[key] === undefined || variant.options[i] === wanted[key];
      });

    const allKeys = Object.keys(wanted);
    const colorKey = allKeys[this.data.colorIndex];
    const exact = this.sibling.variants.find((variant) => matches(variant, allKeys));
    const sameColor = colorKey && this.sibling.variants.find((variant) => matches(variant, [colorKey]));

    link.href = (exact || sameColor)?.url || this.sibling.url;
  }

  async addToCart(event) {
    if (!document.querySelector('cart-drawer')) return; // Without a drawer, let the form post normally.
    event.preventDefault();

    const button = this.querySelector('[data-add-button]');
    const error = this.querySelector('[data-form-error]');
    error.hidden = true;
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;

    try {
      const cart = await Cart.request(`${window.Shopify?.routes?.root || '/'}cart/add.js`, {
        items: [{ id: Number(this.variantInput.value), quantity: 1 }],
        sections: Cart.sectionIds(),
        sections_url: window.location.pathname,
      });
      Cart.render(cart.sections);
      document.querySelector('cart-drawer')?.open(button);
    } catch (err) {
      error.textContent = err.message || this.data.strings.error;
      error.hidden = false;
    } finally {
      button.removeAttribute('aria-busy');
      button.disabled = !this.currentVariant()?.available;
    }
  }
}

if (!customElements.get('product-info')) customElements.define('product-info', ProductInfo);
