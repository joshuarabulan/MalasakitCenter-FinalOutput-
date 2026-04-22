(function () {
    if (window.__adminResponsiveInitialized) {
        return;
    }
    window.__adminResponsiveInitialized = true;

    var desktopStorageKey = 'adminSidebarCollapsed';
    var mobileBreakpoint = 1024;

    function isMobileViewport() {
        return window.innerWidth <= mobileBreakpoint;
    }

    function createBackdrop() {
        var existing = document.querySelector('.admin-sidebar-backdrop');
        if (existing) {
            return existing;
        }

        var backdrop = document.createElement('button');
        backdrop.type = 'button';
        backdrop.className = 'admin-sidebar-backdrop';
        backdrop.setAttribute('aria-label', 'Close navigation');
        backdrop.addEventListener('click', closeMobileSidebar);
        document.body.appendChild(backdrop);
        return backdrop;
    }

    function createMobileToggle() {
        var existing = document.querySelector('.admin-mobile-toggle');
        if (existing) {
            return existing;
        }

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'admin-mobile-toggle';
        button.setAttribute('aria-label', 'Open navigation');
        button.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i>';
        button.addEventListener('click', toggleSidebar);
        document.body.appendChild(button);
        return button;
    }

    function updateMobileToggleIcon() {
        var button = document.querySelector('.admin-mobile-toggle');
        if (!button) {
            return;
        }

        var isOpen = document.body.classList.contains('sidebar-mobile-open');
        button.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
        button.innerHTML = isOpen
            ? '<i class="fas fa-times" aria-hidden="true"></i>'
            : '<i class="fas fa-bars" aria-hidden="true"></i>';
    }

    function applyDesktopState() {
        var isCollapsed = localStorage.getItem(desktopStorageKey) === '1';
        document.body.classList.toggle('sidebar-collapsed', isCollapsed);
    }

    function closeMobileSidebar() {
        document.body.classList.remove('sidebar-mobile-open');
        updateMobileToggleIcon();
    }

    function openMobileSidebar() {
        document.body.classList.add('sidebar-mobile-open');
        updateMobileToggleIcon();
    }

    function toggleSidebar(event) {
        if (event) {
            event.preventDefault();
        }

        if (isMobileViewport()) {
            document.body.classList.toggle('sidebar-mobile-open');
            updateMobileToggleIcon();
            return;
        }

        document.body.classList.toggle('sidebar-collapsed');
        localStorage.setItem(
            desktopStorageKey,
            document.body.classList.contains('sidebar-collapsed') ? '1' : '0'
        );
    }

    function closeOnEscape(event) {
        if (event.key === 'Escape' && document.body.classList.contains('sidebar-mobile-open')) {
            closeMobileSidebar();
        }
    }

    function syncLayoutForViewport() {
        if (isMobileViewport()) {
            document.body.classList.remove('sidebar-collapsed');
        } else {
            closeMobileSidebar();
            applyDesktopState();
        }
        updateMobileToggleIcon();
    }

    function bindSidebarToggles() {
        document.querySelectorAll('.sidebar-toggle').forEach(function (button) {
            button.addEventListener('click', toggleSidebar);
        });
    }

    function bindSidebarLinks() {
        document.querySelectorAll('.sidebar nav a').forEach(function (link) {
            link.addEventListener('click', function () {
                if (isMobileViewport()) {
                    closeMobileSidebar();
                }
            });
        });
    }

    function init() {
        if (!document.querySelector('.sidebar')) {
            return;
        }

        createBackdrop();
        createMobileToggle();
        bindSidebarToggles();
        bindSidebarLinks();
        syncLayoutForViewport();

        window.addEventListener('resize', syncLayoutForViewport);
        document.addEventListener('keydown', closeOnEscape);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
