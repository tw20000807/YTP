// @ts-nocheck
/**
 * Custom dropdown replacement for native <datalist>.
 * Native datalist positions its popup relative to the browser viewport,
 * which breaks inside VSCode webview iframes. This positions using
 * absolute CSS within the document so it works in any context.
 *
 * Usage:
 *   CustomDropdown.attach(inputElement, () => ['option1', 'option2']);
 *   // Later, to update options without waiting for focus:
 *   CustomDropdown.updateOptions(inputElement, ['option1', 'option2']);
 *   // Remove:
 *   CustomDropdown.detach(inputElement);
 */
const CustomDropdown = (() => {
    const DROPDOWN_CLASS = 'ytp-custom-dropdown';
    const ITEM_CLASS     = 'ytp-custom-dropdown-item';
    // WeakMap: input -> { dropdown, getOptions, onSelect, cleanup }
    const registry = new WeakMap();

    function attach(input, getOptions) {
        if (registry.has(input)) return; // already attached

        const dropdown = document.createElement('div');
        dropdown.className = DROPDOWN_CLASS;
        dropdown.style.display = 'none';
        document.body.appendChild(dropdown);

        let activeIndex = -1;

        const show = () => {
            const options = typeof getOptions === 'function' ? getOptions() : (getOptions || []);
            const filter = input.value.trim().toLowerCase();
            const filtered = filter
                ? options.filter(o => o.toLowerCase().includes(filter))
                : options;
            if (filtered.length === 0) { hide(); return; }

            dropdown.innerHTML = '';
            activeIndex = -1;
            filtered.forEach((opt, i) => {
                const item = document.createElement('div');
                item.className = ITEM_CLASS;
                item.textContent = opt;
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // prevent input blur
                    input.value = opt;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    hide();
                });
                dropdown.appendChild(item);
            });

            // Position below the input
            const rect = input.getBoundingClientRect();
            dropdown.style.left   = `${rect.left + window.scrollX}px`;
            dropdown.style.top    = `${rect.bottom + window.scrollY}px`;
            dropdown.style.width  = `${Math.max(rect.width, 120)}px`;
            dropdown.style.display = 'block';
        };

        const hide = () => {
            dropdown.style.display = 'none';
            activeIndex = -1;
        };

        const onFocus = () => show();
        const onInput = () => show();
        const onBlur  = () => {
            // Small delay so mousedown on item fires first
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
        input.addEventListener('input', onInput);
        input.addEventListener('blur', onBlur);
        input.addEventListener('keydown', onKeydown);

        // Remove native datalist binding if present
        input.removeAttribute('list');

        registry.set(input, {
            dropdown,
            getOptions,
            cleanup: () => {
                input.removeEventListener('focus', onFocus);
                input.removeEventListener('input', onInput);
                input.removeEventListener('blur', onBlur);
                input.removeEventListener('keydown', onKeydown);
                if (dropdown.parentNode) dropdown.parentNode.removeChild(dropdown);
            }
        });
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
        }
    }

    return { attach, updateOptions, detach };
})();
