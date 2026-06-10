// js/navigation.js

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
            <a href="report.html" class="nav-item">
                <span class="nav-icon"><i class="fas fa-file-invoice"></i></span>
                <span>Monthly Report</span>
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
    const storedRole = localStorage.getItem('userRole');
    const placeholder = document.getElementById("sidebar-container");

    if (placeholder) {
        if (storedRole === 'elder' || storedRole === 'Elder') {
            placeholder.innerHTML = ELDER_SIDEBAR_HTML;
        } else {
            placeholder.innerHTML = CAREGIVER_SIDEBAR_HTML;
        }
    }

    const isNoSidebarPage = window.location.pathname.includes('login.html') ||
        window.location.pathname.includes('register.html') ||
        window.location.pathname.includes('index.html') ||
        window.location.pathname.includes('report.html');

    if (!document.getElementById('mobile-menu-btn') && !isNoSidebarPage) {
        const btn = document.createElement('button');
        btn.id = 'mobile-menu-btn';
        btn.innerHTML = '<i class="fas fa-bars"></i>';
        btn.onclick = toggleSidebar;
        document.body.appendChild(btn);
    }

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

    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    if (!document.getElementById('logoutModal')) {
        const modal = document.createElement('div');
        modal.id = 'logoutModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-card">
                <div class="modal-icon">
                    <i class="fas fa-sign-out-alt"></i>
                </div>
                <h3 class="modal-title">Ready to Leave?</h3>
                <p class="modal-description">You are about to be securely logged out of your Clinical Command Center. We'll see you soon!</p>
                <div class="modal-actions">
                    <button class="btn-modal-cancel" onclick="closeLogoutModal()">Stay</button>
                    <button class="btn-modal-confirm" onclick="confirmLogout()">Log Out</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    if (typeof firebase !== 'undefined') {
        window.checkUserRole();
    }
});

/* ==============================
   3. UTILS (Logout, Role, Toast)
   ============================= */
window.closeLogoutModal = function () {
    document.getElementById('logoutModal').classList.remove('active');
}

window.confirmLogout = function () {
    firebase.auth().signOut().then(() => {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userRole');
        window.location.href = "index.html";
    });
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebar) {
        sidebar.classList.toggle('active');

        if (!overlay) {
            const newOverlay = document.createElement('div');
            newOverlay.id = 'sidebar-overlay';
            newOverlay.onclick = toggleSidebar;
            document.body.appendChild(newOverlay);
            setTimeout(() => newOverlay.classList.add('visible'), 10);
        } else {
            overlay.classList.toggle('visible');
            if (!sidebar.classList.contains('active')) {
                setTimeout(() => overlay.remove(), 300);
            }
        }
    }
}

window.logout = function () {
    document.getElementById('logoutModal').classList.add('active');
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

            const nameElem = document.getElementById('userName');
            const avatarElem = document.getElementById('userAvatar');
            const stored = JSON.parse(localStorage.getItem('currentUser'));

            if (nameElem) nameElem.textContent = stored ? stored.name : user.email.split('@')[0];
            if (avatarElem) {
                if (stored && stored.photo) {
                    avatarElem.innerHTML = `<img src="${stored.photo}" alt="U" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                } else {
                    avatarElem.textContent = (stored ? stored.name : "U").charAt(0).toUpperCase();
                }
            }

            const role = localStorage.getItem('userRole');
            const path = window.location.pathname.toLowerCase();

            const CAREGIVER_ONLY = ['caregiver-dashboard.html', 'notifications.html', 'elder_profiles.html', 'schedule.html', 'report.html'];
            const ELDER_ONLY = ['elder-dashboard.html'];

            const isCaregiverPage = CAREGIVER_ONLY.some(p => path.includes(p));
            const isElderPage = ELDER_ONLY.some(p => path.includes(p));

            if (role === 'elder' && isCaregiverPage) {
                window.location.href = 'elder-dashboard.html';
                return resolve(null);
            }
            if ((role === 'caregiver' || role === 'primary_caregiver') && isElderPage) {
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
window.togglePassword = function (inputId, iconElement) {
    const input = document.getElementById(inputId);
    const icon = iconElement.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};


