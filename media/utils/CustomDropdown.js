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

        // Suppress native browser autocomplete (doesn't work in webviews)
        input.setAttribute('autocomplete', 'off');

        const position = () => {
            const rect = input.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;
            // Use fixed positioning – getBoundingClientRect already gives
            // viewport-relative coords, so no scroll-offset math is needed.
            // This is the most reliable approach inside VSCode webview iframes.
            dropdown.style.position = 'fixed';
            const dropW = Math.max(rect.width, 120);
            dropdown.style.left  = `${rect.left}px`;
            dropdown.style.width = `${dropW}px`;

            // Flip above the input if there isn't enough room below
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            if (spaceBelow < 120 && spaceAbove > spaceBelow) {
                dropdown.style.top  = '';
                dropdown.style.bottom = `${window.innerHeight - rect.top}px`;
                dropdown.style.maxHeight = `${Math.min(180, spaceAbove - 4)}px`;
            } else {
                dropdown.style.bottom = '';
                dropdown.style.top    = `${rect.bottom}px`;
                dropdown.style.maxHeight = `${Math.min(180, spaceBelow - 4)}px`;
            }
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
                // Use mousedown for selection — it fires before blur, so
                // preventDefault() keeps focus on the input and we can
                // set the value synchronously.  This is the most reliable
                // pattern inside VSCode webview iframes where pointerdown
                // + click timing can be unreliable.
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    input.value = opt;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    hide();
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
            if (dropdown.style.display === 'none') show();
        };
        const onInput = () => show();
        const onBlur  = () => {
            // Small delay so mousedown on dropdown item fires first
            setTimeout(hide, 150);
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
