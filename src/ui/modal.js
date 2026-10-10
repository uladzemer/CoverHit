/** Pure navigation policy shared by the DOM component and Node tests. */
export function pageIndex(index, count) {
  return Math.max(0, Math.min(Math.max(0, count - 1), Number.isFinite(index) ? Math.trunc(index) : 0));
}
export function modalKey(key, index, count, editing = false) {
  if (key === 'Escape') return { action: index > 0 ? 'back' : 'close', index: pageIndex(index - 1, count) };
  if (editing) return null;
  if (key === 'ArrowLeft') return { action: 'page', index: pageIndex(index - 1, count) };
  if (key === 'ArrowRight') return { action: 'page', index: pageIndex(index + 1, count) };
  if (key === 'Enter') return { action: 'primary', index };
  return null;
}
export function paginate(items, capacity = 4) {
  const size = Math.max(1, Math.trunc(capacity) || 1);
  return Array.from({ length: Math.max(1, Math.ceil(items.length / size)) }, (_, i) => items.slice(i * size, (i + 1) * size));
}
let sequence = 0;
export class Modal {
  constructor(host, { onChange = () => {} } = {}) {
    this.host = host; this.onChange = onChange; this.index = 0;
    const id = `ch-modal-title-${++sequence}`;
    host.className = 'ch-screen ch-modal'; host.hidden = true;
    host.innerHTML = `<section class="ch-modal-card" role="dialog" aria-modal="true" aria-labelledby="${id}" tabindex="-1"><header class="ch-modal-header"><span>ДВОРОВАЯ АРКАДА · COVERHIT</span><button class="ch-secondary" data-modal-close aria-label="Закрыть / назад">×</button></header><h1 id="${id}" data-title></h1><p data-description></p><div class="ch-modal-body"></div><footer class="ch-modal-footer"><nav class="ch-modal-dots" aria-label="Страницы"></nav><div class="ch-modal-actions"><button class="ch-secondary" data-modal-back>Назад</button><button class="ch-secondary" data-modal-next>Дальше</button><button class="ch-primary" data-action>Начать</button></div></footer></section>`;
    this.card = host.firstElementChild; this.body = host.querySelector('.ch-modal-body');
    this.title = host.querySelector('[data-title]'); this.description = host.querySelector('[data-description]');
    this.primary = host.querySelector('[data-action]'); this.back = host.querySelector('[data-modal-back]'); this.next = host.querySelector('[data-modal-next]'); this.dots = host.querySelector('nav');
    this.back.onclick = () => this.go(this.index - 1); this.next.onclick = () => this.go(this.index + 1);
    host.querySelector('[data-modal-close]').onclick = () => this.escape();
    this.primary.onclick = () => this.activate();
    this.keydown = event => {
      if (host.hidden) return;
      if (event.key === 'Tab') {
        const controls = [...this.card.querySelectorAll('button,a[href],input,select,[tabindex="0"]')].filter(n => !n.disabled && n.getClientRects().length && !n.closest('[hidden]'));
        const current = controls.indexOf(document.activeElement);
        if (event.shiftKey && current <= 0 || !event.shiftKey && (current < 0 || current === controls.length - 1)) {
          event.preventDefault(); (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
        }
        event.stopPropagation(); return;
      }
      const editing = !!event.target.closest?.('input,select,textarea,[contenteditable="true"]');
      const command = modalKey(event.key, this.index, this.pages.length, editing);
      event.stopPropagation();
      if (!command || event.repeat) return;
      event.preventDefault();
      if (command.action === 'primary') this.activate();
      else if (command.action === 'close') this.close();
      else this.go(command.index);
    };
    window.addEventListener('keydown', this.keydown, true);
  }
  open({ pages, primary = 'Начать', onPrimary, onClose }) {
    const wasHidden = this.host.hidden;
    if (wasHidden) this.restore = document.activeElement;
    this.pages = pages; this.onPrimary = onPrimary; this.onClose = onClose;
    this.primary.textContent = primary; this.host.hidden = false;
    if (wasHidden) this.inertSiblings = [...this.host.parentElement.children].filter(n => n !== this.host).map(n => [n, n.inert]);
    for (const [n] of this.inertSiblings) n.inert = true;
    this.go(0, false); this.card.focus(); this.onChange(true);
  }
  go(index, focus = true) {
    this.index = pageIndex(index, this.pages.length); const page = this.pages[this.index];
    this.title.textContent = page.title; this.description.textContent = page.description || ''; this.description.hidden = !page.description;
    this.body.replaceChildren(page.content); this.back.hidden = this.pages.length < 2; this.back.disabled = this.index === 0;
    this.next.hidden = this.pages.length < 2; this.next.disabled = this.index === this.pages.length - 1;
    this.dots.replaceChildren(...this.pages.map((p, i) => {
      const dot = document.createElement('button'); dot.type = 'button'; dot.className = 'ch-secondary';
      dot.textContent = String(i + 1); dot.setAttribute('aria-label', p.title); dot.setAttribute('aria-current', i === this.index ? 'step' : 'false');
      dot.onclick = () => this.go(i); return dot;
    }));
    if (focus) this.card.focus();
  }
  escape() { if (this.index > 0) this.go(this.index - 1); else this.close(); }
  async activate() {
    if (this.primary.disabled || this.activating) return;
    this.activating = true;
    try {
      const pending = this.onPrimary?.();
      this.primary.disabled = true;
      await pending;
    } finally { this.primary.disabled = false; this.activating = false; }
  }
  close(notify = true) {
    if (this.host.hidden) return;
    this.host.hidden = true;
    for (const [node, previous] of this.inertSiblings || []) node.inert = previous;
    this.onChange(false); this.restore?.isConnected && this.restore.focus();
    if (notify) this.onClose?.();
  }
  dispose() { this.close(false); window.removeEventListener('keydown', this.keydown, true); }
}
