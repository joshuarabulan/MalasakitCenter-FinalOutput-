(function () {
    if (window.__adminResponsiveInitialized) {
        return;
    }
    window.__adminResponsiveInitialized = true;

    var desktopStorageKey = 'adminSidebarCollapsed';
    var mobileBreakpoint = 1024;
    var logoutTargetHref = null;

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

    function closeLogoutModal() {
        var modal = document.querySelector('.admin-logout-modal');
        if (!modal) {
            return;
        }

        modal.classList.remove('is-open');
        document.body.classList.remove('admin-logout-open');
        logoutTargetHref = null;
    }

    function confirmLogout() {
        if (!logoutTargetHref) {
            closeLogoutModal();
            return;
        }

        window.location.href = logoutTargetHref;
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
            return;
        }

        if (event.key === 'Escape' && document.body.classList.contains('admin-logout-open')) {
            closeLogoutModal();
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

    function createLogoutModal() {
        var existing = document.querySelector('.admin-logout-modal');
        if (existing) {
            return existing;
        }

        var modal = document.createElement('div');
        modal.className = 'admin-logout-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'adminLogoutTitle');
        modal.innerHTML =
            '<div class="admin-logout-dialog">' +
                '<button type="button" class="admin-logout-close" aria-label="Close logout dialog">' +
                    '<i class="fas fa-times" aria-hidden="true"></i>' +
                '</button>' +
                '<div class="admin-logout-dialog__body">' +
                    '<div class="admin-logout-dialog__icon"><i class="fas fa-sign-out-alt" aria-hidden="true"></i></div>' +
                    '<h2 class="admin-logout-dialog__title" id="adminLogoutTitle">Confirm Logout</h2>' +
                    '<p class="admin-logout-dialog__text">Are you sure you want to logout? You will need to login again to access your account.</p>' +
                '</div>' +
                '<div class="admin-logout-dialog__actions">' +
                    '<button type="button" class="admin-logout-btn admin-logout-btn--cancel">Cancel</button>' +
                    '<button type="button" class="admin-logout-btn admin-logout-btn--confirm">Logout</button>' +
                '</div>' +
            '</div>';

        modal.addEventListener('click', function (event) {
            if (event.target === modal) {
                closeLogoutModal();
            }
        });

        modal.querySelector('.admin-logout-dialog').addEventListener('click', function (event) {
            event.stopPropagation();
        });
        modal.querySelector('.admin-logout-close').addEventListener('click', closeLogoutModal);
        modal.querySelector('.admin-logout-btn--cancel').addEventListener('click', closeLogoutModal);
        modal.querySelector('.admin-logout-btn--confirm').addEventListener('click', confirmLogout);

        document.body.appendChild(modal);
        return modal;
    }

    function openLogoutModal(href) {
        var modal = createLogoutModal();
        logoutTargetHref = href;
        modal.classList.add('is-open');
        document.body.classList.add('admin-logout-open');
    }

    function bindLogoutLinks() {
        document.querySelectorAll('.nav-item-logout').forEach(function (link) {
            link.addEventListener('click', function (event) {
                event.preventDefault();
                if (isMobileViewport()) {
                    closeMobileSidebar();
                }
                openLogoutModal(link.getAttribute('href') || '/logout');
            });
        });
    }

    function init() {
        if (!document.querySelector('.sidebar')) {
            return;
        }

        createBackdrop();
        createMobileToggle();
        createLogoutModal();
        bindSidebarToggles();
        bindSidebarLinks();
        bindLogoutLinks();
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
