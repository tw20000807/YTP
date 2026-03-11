// @ts-nocheck
/**
 * Custom dropdown replacement for native <datalist>.
 * Native datalist positions its popup relative to the browser viewport,
 * which breaks inside VSCode webview iframes. This uses absolute positioning
 * relative to the document body so it works in any context.
 *
 * Usage:
 *   CustomDropdown.attach(inputElement, () => ['option1', 'option2']);
 *   CustomDropdown.attach(inputElement, () => ['option1', 'option2'], { matchMode: 'prefix', sort: true, resetScrollOnShow: true });
 *   CustomDropdown.updateOptions(inputElement, ['option1', 'option2']);
 *   CustomDropdown.detach(inputElement);
 *   CustomDropdown.detachAll(container); // detach all inputs inside a container
 */
const CustomDropdown = (() => {
    const DROPDOWN_CLASS = 'ytp-custom-dropdown';
    const ITEM_CLASS     = 'ytp-custom-dropdown-item';
    // WeakMap: input -> { dropdown, getOptions, cleanup }
    const registry = new WeakMap();
    // Keep a strong set so we can iterate for detachAll
    const allInputs = new Set();

    function attach(input, getOptions, config = {}) {
        if (registry.has(input)) return; // already attached

        const dropdown = document.createElement('div');
        dropdown.className = DROPDOWN_CLASS;
        dropdown.style.display = 'none';
        document.body.appendChild(dropdown);

        let activeIndex = -1;
        let selecting = false; // flag to prevent blur from hiding during selection

        const position = () => {
            const rect = input.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return; // input not laid out
            // Use absolute positioning relative to body (accounts for scroll)
            const scrollX = window.scrollX || window.pageXOffset || 0;
            const scrollY = window.scrollY || window.pageYOffset || 0;
            dropdown.style.position = 'absolute';
            dropdown.style.left  = `${rect.left + scrollX}px`;
            dropdown.style.top   = `${rect.bottom + scrollY}px`;
            dropdown.style.width = `${Math.max(rect.width, 120)}px`;
        };

        const show = () => {
            const rawOptions = typeof getOptions === 'function' ? getOptions() : (getOptions || []);
            const options = Array.isArray(rawOptions)
                ? rawOptions.map(o => String(o))
                : [];
            const sortedOptions = config.sort
                ? [...options].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                : options;
            const filter = input.value.trim().toLowerCase();
            const filtered = filter
                ? sortedOptions.filter(o => {
                    const lo = o.toLowerCase();
                    return config.matchMode === 'prefix'
                        ? lo.startsWith(filter)
                        : lo.includes(filter);
                })
                : sortedOptions;
            if (filtered.length === 0) { hide(); return; }

            dropdown.innerHTML = '';
            activeIndex = -1;
            filtered.forEach((opt, i) => {
                const item = document.createElement('div');
                item.className = ITEM_CLASS;
                item.textContent = opt;
                item.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selecting = true;
                });
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    input.value = opt;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    selecting = false;
                    hide();
                    input.focus();
                });
                dropdown.appendChild(item);
            });

            position();
            dropdown.style.display = 'block';
            if (config.resetScrollOnShow) dropdown.scrollTop = 0;
        };

        const hide = () => {
            dropdown.style.display = 'none';
            activeIndex = -1;
        };

        const onFocus = () => show();
        const onClick = () => {
            // Backup: ensure dropdown shows even if focus didn't fire
            if (dropdown.style.display === 'none') show();
        };
        const onInput = () => show();
        const onBlur  = () => {
            // Delay hide so click on dropdown item fires first
            setTimeout(() => {
                if (!selecting) hide();
                selecting = false;
            }, 200);
        };
        const onKeydown = (e) => {
            if (dropdown.style.display === 'none') return;
            const items = dropdown.querySelectorAll('.' + ITEM_CLASS);
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, items.length - 1);
                items.forEach((it, i) => it.classList.toggle('ytp-dropdown-active', i === activeIndex));
                if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, 0);
                items.forEach((it, i) => it.classList.toggle('ytp-dropdown-active', i === activeIndex));
                if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' && activeIndex >= 0 && items[activeIndex]) {
                e.preventDefault();
                input.value = items[activeIndex].textContent;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                hide();
            } else if (e.key === 'Escape') {
                hide();
            }
        };

        input.addEventListener('focus', onFocus);
        input.addEventListener('click', onClick);
        input.addEventListener('input', onInput);
        input.addEventListener('blur', onBlur);
        input.addEventListener('keydown', onKeydown);

        // Remove native datalist binding if present
        input.removeAttribute('list');

        const entry = {
            dropdown,
            getOptions,
            config,
            cleanup: () => {
                input.removeEventListener('focus', onFocus);
                input.removeEventListener('click', onClick);
                input.removeEventListener('input', onInput);
                input.removeEventListener('blur', onBlur);
                input.removeEventListener('keydown', onKeydown);
                if (dropdown.parentNode) dropdown.parentNode.removeChild(dropdown);
            }
        };
        registry.set(input, entry);
        allInputs.add(input);
    }

    function updateOptions(input, options) {
        const entry = registry.get(input);
        if (entry) {
            entry.getOptions = Array.isArray(options) ? () => options : options;
        }
    }

    function detach(input) {
        const entry = registry.get(input);
        if (entry) {
            entry.cleanup();
            registry.delete(input);
            allInputs.delete(input);
        }
    }

    /**
     * Detach all inputs inside a container.
     * Call before clearing container innerHTML to avoid orphaned dropdown divs.
     */
    function detachAll(container) {
        if (!container) return;
        const inputs = container.querySelectorAll('input');
        inputs.forEach(inp => detach(inp));
    }

    return { attach, updateOptions, detach, detachAll };
})();
