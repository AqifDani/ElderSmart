// js/navigation.js - REFACTORED & CLEAN

/* ==============================
   1. SIDEBAR TEMPLATES
   ============================== */

const CAREGIVER_SIDEBAR_HTML = `
<aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
        <a href="caregiver-dashboard.html" class="sidebar-logo">
            <div class="logo-icon"><i class="fas fa-heartbeat"></i></div>
            <span class="logo-text">ElderSmart</span>
        </a>
        <button class="mobile-close-btn" onclick="toggleSidebar()">
            <i class="fas fa-times"></i>
        </button>
    </div>

    <nav class="sidebar-nav">
        <div class="nav-section">
            <div class="nav-section-title" style="padding: 0 16px; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; color: #666;">Main</div>
            <a href="caregiver-dashboard.html" class="nav-item">
                <span class="nav-icon"><i class="fas fa-th-large"></i></span>
                <span>Dashboard</span>
            </a>
            <a href="notifications.html" class="nav-item">
                <span class="nav-icon"><i class="fas fa-bell"></i></span>
                <span>Notifications</span>
            </a>
            <a href="elder_profiles.html" class="nav-item">
                <span class="nav-icon"><i class="fas fa-users"></i></span>
                <span>Family Circle</span>
            </a>
            <a href="schedule.html" class="nav-item">
                <span class="nav-icon"><i class="fas fa-calendar-week"></i></span>
                <span>Shift Schedule</span>
            </a>
        </div>

        <div class="nav-section" style="margin-top: 20px;">
            <div class="nav-section-title" style="padding: 0 16px; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; color: #666;">Health & Care</div>
            <a href="appointments.html" class="nav-item">
                <span class="nav-icon"><i class="fas fa-calendar-check"></i></span>
                <span>Appointments</span>
            </a>
            <a href="health_records.html" class="nav-item">
                <span class="nav-icon"><i class="fas fa-file-medical"></i></span>
                <span>Check-up Logs</span>
            </a>
            <a href="medications.html" class="nav-item">
                <span class="nav-icon"><i class="fas fa-pills"></i></span>
                <span>Medications</span>
            </a>
        </div>
    </nav>
    
    ${getSidebarFooter('Caregiver')}
</aside>
`;

const ELDER_SIDEBAR_HTML = `
<aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
        <a href="elder-dashboard.html" class="sidebar-logo">
            <div class="logo-icon"><i class="fas fa-heartbeat"></i></div>
            <span class="logo-text">ElderSmart</span>
        </a>
        <button class="mobile-close-btn" onclick="toggleSidebar()">
            <i class="fas fa-times"></i>
        </button>
    </div>

    <nav class="sidebar-nav">
        <div class="nav-section">
            <div class="nav-section-title" style="padding: 0 16px; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; color: #666;">My Care</div>
            <a href="elder-dashboard.html" class="nav-item">
                <span class="nav-icon"><i class="fas fa-home"></i></span>
                <span>Home</span>
            </a>
            <a href="medications.html" class="nav-item">
                <span class="nav-icon"><i class="fas fa-pills"></i></span>
                <span>My Medications</span>
            </a>
            <a href="appointments.html" class="nav-item">
                <span class="nav-icon"><i class="fas fa-calendar-alt"></i></span>
                <span>Appointments</span>
            </a>
        </div>
    </nav>

    ${getSidebarFooter('Elder')}
</aside>
`;

// Helper: Uses CSS classes for footer layout
function getSidebarFooter(defaultRoleLabel) {
    return `
    <div class="sidebar-footer">
        <div class="user-profile">
            <div class="user-avatar" id="userAvatar">U</div>
            <div class="user-info">
                <div class="user-name" id="userName" style="font-weight:bold; color:white;">Loading...</div>
                <div class="user-role" id="userRole" style="font-size:12px; color:var(--text-muted);">${defaultRoleLabel}</div>
            </div>
        </div>
        
        <div class="sidebar-actions">
            <a href="settings.html" title="Settings" class="btn-icon-footer">
                <i class="fas fa-cog"></i>
            </a>
            <button onclick="logout()" title="Logout" class="btn-icon-footer btn-logout">
                <i class="fas fa-sign-out-alt"></i>
            </button>
        </div>
    </div>`;
}

/* ==============================
   2. INITIALIZE
   ============================== */
document.addEventListener('DOMContentLoaded', () => {
    // 1. INJECT SIDEBAR
    const storedRole = localStorage.getItem('userRole');
    const placeholder = document.getElementById("sidebar-container");

    if (placeholder) {
        if (storedRole === 'elder' || storedRole === 'Elder') {
            placeholder.innerHTML = ELDER_SIDEBAR_HTML;
        } else {
            placeholder.innerHTML = CAREGIVER_SIDEBAR_HTML;
        }
    }

    // 2. INJECT MOBILE HAMBURGER BUTTON (New)
    // We add this dynamically so it appears on all pages without editing HTML
    const isAuthPage = window.location.pathname.includes('login.html') ||
        window.location.pathname.includes('register.html') ||
        window.location.pathname.includes('index.html');

    if (!document.getElementById('mobile-menu-btn') && !isAuthPage) {
        const btn = document.createElement('button');
        btn.id = 'mobile-menu-btn';
        btn.innerHTML = '<i class="fas fa-bars"></i>';
        btn.onclick = toggleSidebar;
        document.body.appendChild(btn);
    }

    // 3. HIGHLIGHT ACTIVE LINK
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href && (href === currentPage || currentPage.includes(href))) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // 4. INJECT TOAST CONTAINER
    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // 5. AUTH CHECK
    if (typeof firebase !== 'undefined') {
        window.checkUserRole();
    }
});

/* ==============================
   3. UTILS (Logout, Role, Toast)
   ============================= */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebar) {
        sidebar.classList.toggle('active');

        // Handle Overlay (Create if not exists)
        if (!overlay) {
            const newOverlay = document.createElement('div');
            newOverlay.id = 'sidebar-overlay';
            newOverlay.onclick = toggleSidebar;
            document.body.appendChild(newOverlay);
            // Small delay to allow CSS transition
            setTimeout(() => newOverlay.classList.add('visible'), 10);
        } else {
            overlay.classList.toggle('visible');
            if (!sidebar.classList.contains('active')) {
                setTimeout(() => overlay.remove(), 300); // Remove after fade out
            }
        }
    }
}

window.logout = function () {
    if (confirm("Are you sure you want to log out?")) {
        firebase.auth().signOut().then(() => {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('userRole');
            window.location.href = "index.html";
        });
    }
};

window.checkUserRole = async function () {
    return new Promise((resolve) => {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (!user) {
                const path = window.location.pathname;
                if (!path.includes('index.html') && !path.includes('login.html') && !path.includes('register.html')) {
                    window.location.href = "index.html";
                }
                resolve(null);
                return;
            }

            // Update Sidebar Name
            const nameElem = document.getElementById('userName');
            const avatarElem = document.getElementById('userAvatar');
            const stored = JSON.parse(localStorage.getItem('currentUser'));

            if (nameElem) nameElem.textContent = stored ? stored.name : user.email.split('@')[0];
            if (avatarElem) avatarElem.textContent = (stored ? stored.name : "U").charAt(0).toUpperCase();

            const role = localStorage.getItem('userRole');
            const path = window.location.pathname.toLowerCase();
            
            // STRICT RBAC ROUTING
            const CAREGIVER_ONLY = ['caregiver-dashboard.html', 'notifications.html', 'elder_profiles.html', 'schedule.html'];
            const ELDER_ONLY = ['elder-dashboard.html'];
            
            const isCaregiverPage = CAREGIVER_ONLY.some(p => path.includes(p));
            const isElderPage = ELDER_ONLY.some(p => path.includes(p));
            
            if (role === 'elder' && isCaregiverPage) {
                window.location.href = 'elder-dashboard.html';
                return resolve(null);
            }
            if (role === 'caregiver' && isElderPage) {
                window.location.href = 'caregiver-dashboard.html';
                return resolve(null);
            }

            resolve(role);
        });
    });
};

window.showToast = function (title, message, type = 'default') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-title" style="font-weight:bold;">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};