/**
 * CascadeSelect — flyout submenu dropdown component
 *
 * Replaces native <select> with a cascading menu that supports:
 * - Arbitrary nesting depth via { label, value?, children? }
 * - Viewport-aware submenu positioning (right/left flip)
 * - Body-appended dropdown to escape overflow clipping
 * - Hidden <input> preserves original element ID for event compatibility
 */

export class CascadeSelect {
    /**
     * @param {HTMLElement} container - Element to mount into
     * @param {Object} opts
     * @param {string} opts.id - ID for the hidden input (original select ID)
     * @param {Array} opts.items - { label, value?, children? }[]
     * @param {string} [opts.value] - Initial selected value
     * @param {string} [opts.placeholder] - Trigger text when nothing selected
     * @param {Function} [opts.onChange] - Callback(value, label)
     */
    constructor(container, opts) {
        this._container = container;
        this._items = opts.items || [];
        this._onChange = opts.onChange || null;
        this._isOpen = false;
        this._selfDispatching = false;

        // Build the wrapper
        this._wrapper = document.createElement('div');
        this._wrapper.className = 'cascade-select';

        // Hidden input (preserves original element ID for proxyInput compat)
        this._input = document.createElement('input');
        this._input.type = 'hidden';
        this._input.id = opts.id;
        this._input.value = opts.value || '';
        this._wrapper.appendChild(this._input);

        // Trigger button
        this._trigger = document.createElement('button');
        this._trigger.type = 'button';
        this._trigger.className = 'cascade-trigger';
        this._trigger.innerHTML = `<span class="cascade-trigger-label"></span><span class="cascade-trigger-arrow">&#x25BE;</span>`;
        this._triggerLabel = this._trigger.querySelector('.cascade-trigger-label');
        this._wrapper.appendChild(this._trigger);

        // Mount
        container.innerHTML = '';
        container.appendChild(this._wrapper);

        // Set initial display
        this._syncLabel();

        // Dropdown (created lazily, appended to body)
        this._dropdown = null;

        // Event listeners
        this._trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this._isOpen ? this.close() : this.open();
        });

        // External value changes → update display
        this._input.addEventListener('change', () => {
            if (!this._selfDispatching) this._syncLabel();
        });

        // Close on Escape
        this._onKeyDown = (e) => {
            if (e.key === 'Escape') this.close();
        };

        // Close on outside click
        this._onOutsideClick = (e) => {
            if (this._dropdown && !this._dropdown.contains(e.target) &&
                !this._wrapper.contains(e.target)) {
                this.close();
            }
        };
    }

    get value() { return this._input.value; }

    set value(v) {
        this._input.value = v;
        this._syncLabel();
    }

    /** Rebuild menu items dynamically */
    setItems(items) {
        this._items = items;
        if (this._isOpen) {
            this.close();
            this.open();
        }
        this._syncLabel();
    }

    /** Sync trigger label to current hidden input value */
    syncFromInput() {
        this._syncLabel();
    }

    /** Open the dropdown */
    open() {
        if (this._isOpen) return;
        this._isOpen = true;

        // Create dropdown
        this._dropdown = document.createElement('div');
        this._dropdown.className = 'cascade-dropdown';
        this._buildMenu(this._items, this._dropdown);

        // Append to body to escape overflow clipping
        document.body.appendChild(this._dropdown);

        // Position below trigger
        this._positionDropdown();

        // Flip any submenus that overflow
        requestAnimationFrame(() => this._flipSubmenus(this._dropdown));

        // Global listeners
        document.addEventListener('click', this._onOutsideClick, true);
        document.addEventListener('keydown', this._onKeyDown);

        this._trigger.setAttribute('aria-expanded', 'true');
    }

    /** Close the dropdown */
    close() {
        if (!this._isOpen) return;
        this._isOpen = false;

        if (this._dropdown && this._dropdown.parentNode) {
            this._dropdown.parentNode.removeChild(this._dropdown);
        }
        this._dropdown = null;

        document.removeEventListener('click', this._onOutsideClick, true);
        document.removeEventListener('keydown', this._onKeyDown);

        this._trigger.setAttribute('aria-expanded', 'false');
    }

    /** Clean up */
    destroy() {
        this.close();
        this._wrapper.remove();
    }

    // ── Private ──

    /** Build menu DOM recursively */
    _buildMenu(items, parent) {
        for (const item of items) {
            if (item.children && item.children.length > 0) {
                // Parent item with submenu
                const parentDiv = document.createElement('div');
                parentDiv.className = 'cascade-item cascade-parent';
                parentDiv.innerHTML = `<span>${item.label}</span><span class="cascade-arrow">&#x25B8;</span>`;

                const submenu = document.createElement('div');
                submenu.className = 'cascade-submenu';
                this._buildMenu(item.children, submenu);
                parentDiv.appendChild(submenu);

                // Flip detection on hover
                parentDiv.addEventListener('mouseenter', () => {
                    this._flipSubmenu(submenu);
                });

                parent.appendChild(parentDiv);
            } else {
                // Leaf item (selectable)
                const leafDiv = document.createElement('div');
                leafDiv.className = 'cascade-item';
                if (item.value !== undefined) {
                    leafDiv.dataset.value = item.value;
                    leafDiv.textContent = item.label;
                    if (item.value === this._input.value) {
                        leafDiv.classList.add('selected');
                    }
                    leafDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this._select(item.value, item.label);
                    });
                }
                parent.appendChild(leafDiv);
            }
        }
    }

    /** Position the dropdown below (or above) the trigger */
    _positionDropdown() {
        const triggerRect = this._trigger.getBoundingClientRect();
        const dd = this._dropdown;

        // Default: below trigger
        dd.style.left = triggerRect.left + 'px';
        dd.style.top = triggerRect.bottom + 2 + 'px';
        dd.style.minWidth = triggerRect.width + 'px';

        // Check if dropdown overflows bottom
        requestAnimationFrame(() => {
            const ddRect = dd.getBoundingClientRect();
            if (ddRect.bottom > window.innerHeight - 10) {
                // Position above trigger
                dd.style.top = (triggerRect.top - ddRect.height - 2) + 'px';
            }
            // Check right overflow
            if (ddRect.right > window.innerWidth - 10) {
                dd.style.left = (window.innerWidth - ddRect.width - 10) + 'px';
            }
        });
    }

    /** Check if a submenu overflows right and flip to left */
    _flipSubmenu(submenu) {
        submenu.classList.remove('flip-left');
        // Force layout to get rect
        requestAnimationFrame(() => {
            const rect = submenu.getBoundingClientRect();
            if (rect.right > window.innerWidth - 10) {
                submenu.classList.add('flip-left');
            }
        });
    }

    /** Flip all visible submenus that overflow */
    _flipSubmenus(el) {
        el.querySelectorAll('.cascade-submenu').forEach(sub => {
            this._flipSubmenu(sub);
        });
    }

    /** Select a value and dispatch events */
    _select(value, label) {
        this._input.value = value;
        this._triggerLabel.textContent = label;
        this.close();

        // Dispatch events for existing handlers (proxyInput, etc.)
        this._selfDispatching = true;
        this._input.dispatchEvent(new Event('input', { bubbles: true }));
        this._input.dispatchEvent(new Event('change', { bubbles: true }));
        this._selfDispatching = false;

        if (this._onChange) this._onChange(value, label);
    }

    /** Find label for current value in the item tree */
    _findLabel(items, value) {
        for (const item of items) {
            if (item.value === value) return item.label;
            if (item.children) {
                const found = this._findLabel(item.children, value);
                if (found) return found;
            }
        }
        return null;
    }

    /** Update trigger label to match hidden input value */
    _syncLabel() {
        const label = this._findLabel(this._items, this._input.value);
        this._triggerLabel.textContent = label || this._input.value || '—';
    }
}
