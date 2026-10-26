/**
 * Ballō theme scripts. Native Web Components only, no dependencies.
 */

/**
 * Side panel menu for small screens.
 * Wraps a <dialog>; any element with aria-controls pointing to the dialog's id opens it.
 */
class MenuDrawer extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector('dialog');
    if (!this.dialog) return;

    this.toggles = document.querySelectorAll(`[aria-controls="${this.dialog.id}"]`);
    this.toggles.forEach((toggle) => toggle.addEventListener('click', () => this.open(toggle)));

    this.querySelectorAll('[data-menu-close]').forEach((button) =>
      button.addEventListener('click', () => this.close())
    );

    // A click on the dialog element itself (not its content) is a click on the backdrop.
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) this.close();
    });

    this.dialog.addEventListener('close', () => {
      this.toggles.forEach((toggle) => toggle.setAttribute('aria-expanded', 'false'));
      this.lastToggle?.focus();
    });

    this.desktopQuery = window.matchMedia('(min-width: 990px)');
    this.onBreakpointChange = (event) => {
      if (event.matches) this.close();
    };
    this.desktopQuery.addEventListener('change', this.onBreakpointChange);
  }

  disconnectedCallback() {
    this.desktopQuery?.removeEventListener('change', this.onBreakpointChange);
  }

  open(toggle) {
    this.lastToggle = toggle;
    this.dialog.showModal();
    toggle.setAttribute('aria-expanded', 'true');
  }

  close() {
    if (this.dialog.open) this.dialog.close();
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
