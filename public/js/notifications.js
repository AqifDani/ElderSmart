// js/notifications.js

let allNotifications = [];
let currentFilter = 'all';

// 1. Get App ID safely for strict environment path compliance
const getAppId = () => {
    return (typeof window.__app_id !== 'undefined') ? window.__app_id : 'default-app-id';
};

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // We need the familyId to query the root collection
            const storedUser = JSON.parse(localStorage.getItem('currentUser'));
            if (storedUser && storedUser.familyId) {
                loadNotifications(user.uid, storedUser.familyId);
            } else {
                // Fallback: Fetch profile if localStorage is empty
                firebase.firestore().collection('users').doc(user.uid).get()
                    .then(doc => {
                        if(doc.exists) {
                            const data = doc.data();
                            // Update local storage for future use
                            localStorage.setItem('currentUser', JSON.stringify({ uid: user.uid, ...data }));
                            loadNotifications(user.uid, data.familyId);
                        }
                    });
            }
        } else {
            // window.location.href = 'login.html';
        }
    });
});

/* ============================
   LOAD NOTIFICATIONS
   ============================ */
function loadNotifications(userId, familyId) {
    const list = document.getElementById('notificationList');
    
    // Query ROOT 'notifications' collection by familyId
    firebase.firestore()
        .collection('notifications')
        .where('familyId', '==', familyId)
        .onSnapshot(snapshot => {
            allNotifications = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                // Client-side filter: Only show if it's for THIS user or meant for everyone
                if (data.recipientId === userId || !data.recipientId) {
                    allNotifications.push({
                        id: doc.id,
                        ...data
                    });
                }
            });

            // Sort in Memory (Newest first)
            allNotifications.sort((a, b) => {
                const getMillis = (item) => {
                    const ts = item.createdAt || item.timestamp;
                    return ts && ts.toDate ? ts.toDate().getTime() : 0;
                };
                return getMillis(b) - getMillis(a);
            });

            // Limit in Memory
            if (allNotifications.length > 50) {
                allNotifications = allNotifications.slice(0, 50);
            }

            renderNotifications();
        }, error => {
            console.error("Error loading notifications:", error);
            if (list && list.innerHTML.includes('Loading')) {
                 list.innerHTML = `<div class="p-4 text-center text-muted">
                    <i class="fas fa-exclamation-circle text-warning mb-2"></i><br>
                    Unable to load notifications.
                 </div>`;
            }
        });
}

/* ============================
   RENDER & FILTER
   ============================ */
function renderNotifications() {
    const list = document.getElementById('notificationList');
    if (!list) return;

    const filtered = allNotifications.filter(n => {
        const isRead = n.isRead !== undefined ? n.isRead : n.read;
        if (currentFilter === 'unread') return !isRead;
        return true;
    });

    if (filtered.length === 0) {
        list.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:60px; background:white; border-radius:24px; border:2px dashed #e2e8f0;">
                <i class="far fa-bell-slash text-5xl text-gray-300 mb-4" style="font-size: 3rem; color: #cbd5e1;"></i>
                <h3 class="text-xl font-bold text-gray-400" style="color: #94a3b8; margin-top: 1rem;">All Caught Up!</h3>
                <p class="text-gray-400" style="color: #94a3b8;">No new activity to show.</p>
            </div>`;
        return;
    }

    let fullHtml = "";

    filtered.forEach(notif => {
        const isRead = notif.isRead !== undefined ? notif.isRead : notif.read;
        const ts = notif.createdAt || notif.timestamp;

        let timeString = '';
        if (ts && typeof ts.toDate === 'function') {
             timeString = timeAgo(ts.toDate());
        } else if (ts) {
             timeString = timeAgo(new Date(ts));
        }

        const title = (notif.title || "").toLowerCase();
        const type = (notif.type || "").toLowerCase();
        
        let isUrgent = false;
        if (type === 'urgent' || title.includes('missed') || title.includes('sos') || title.includes('alert')) isUrgent = true;

        let actionHtml = "";
        let actionUrl = "#";
        let actionLabel = "View Details";

        if (type === 'medication' || title.includes('medication') || title.includes('pills') || title.includes('stock')) {
            actionUrl = "medications.html";
            actionLabel = "Go to Pharmacy";
        } else if (type === 'appointment' || title.includes('appointment') || title.includes('check-up')) {
            actionUrl = "appointments.html";
            actionLabel = "Check Schedule";
        } else if (title.includes('health') || title.includes('reading')) {
            actionUrl = "health_records.html";
            actionLabel = "Review Records";
        }

        if (actionUrl !== "#") {
            actionHtml = `<button onclick="handleNotifAction(event, '${notif.id}', '${actionUrl}')" class="btn-xs ${isUrgent ? 'btn-primary' : 'btn-secondary'}" style="margin-top: 8px; border-radius: 8px; padding: 6px 12px; font-weight: 700;">${actionLabel} <i class="fas fa-arrow-right" style="font-size: 10px; margin-left: 4px;"></i></button>`;
        }

        const cardType = isUrgent ? "urgent" : "info";
        const iconClass = getIconForType(type || (isUrgent ? 'urgent' : 'normal'));
        
        const statusHtml = !isRead 
            ? `<span class="status-badge status-new">NEW</span>` 
            : `<span class="status-badge status-seen">SEEN</span>`;

        fullHtml += `
            <div class="notification-card ${cardType} ${isRead ? 'read' : ''}" onclick="handleNotifAction(event, '${notif.id}', '${actionUrl}')">
                <div class="notif-header w-full">
                    <div class="flex items-start gap-4 w-full">
                        <div class="notif-icon-box ${isUrgent ? 'bg-danger-bg text-danger' : ''}">
                            <i class="${iconClass}"></i>
                        </div>
                        <div class="flex-grow">
                            <div class="flex justify-between items-start mb-1">
                                <div class="flex flex-col">
                                    <h4 class="${isRead ? 'font-normal' : 'font-bold'} text-lg">${notif.title || 'Notification'}</h4>
                                    <span class="notif-time text-xs text-muted">${timeString}</span>
                                </div>
                                ${statusHtml}
                            </div>
                            <p class="text-muted text-sm mt-1">${notif.message || ''}</p>
                            <div class="flex justify-end items-center mt-3 pt-2">
                                <button class="btn-trash" onclick="deleteNotification(event, '${notif.id}')" title="Dismiss">
                                    <i class="fas fa-trash-alt" style="font-size: 12px; opacity: 0.5;"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    list.innerHTML = fullHtml;
}

window.handleNotifAction = function(event, id, url) {
    event.stopPropagation();
    // Mark as read first
    firebase.firestore().collection('notifications').doc(id)
        .update({ isRead: true, read: true })
        .then(() => {
            if (url && url !== "#") {
                window.location.href = url;
            } else {
                // If no URL, just re-render to show it's read
                renderNotifications();
            }
        });
};

function filterNotifications(type, btnElement) {
    currentFilter = type;
    document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
    renderNotifications();
}

/* ============================================================
   CUSTOM CONFIRMATION DIALOG (Serenity Modal Implementation)
   ============================================================ */
function showCustomConfirm(title, message, type, onConfirm) {
    const modal = document.getElementById("confirmModal");
    const iconBox = document.getElementById("confirmIconBox");
    const icon = document.getElementById("confirmIcon");
    const titleEl = document.getElementById("confirmTitle");
    const msgEl = document.getElementById("confirmMessage");
    const okBtn = document.getElementById("confirmOkBtn");
    const cancelBtn = document.getElementById("confirmCancelBtn");

    if (!modal) return;

    // Reset styles
    iconBox.className = "";
    icon.className = "";
    okBtn.style.background = "";

    // Set dynamic properties based on type
    if (type === 'danger') {
        iconBox.style.background = "var(--danger-bg)";
        iconBox.style.color = "var(--danger)";
        icon.className = "fas fa-trash-alt animate__animated animate__shakeX";
        okBtn.style.background = "var(--danger)";
        okBtn.style.color = "white";
    } else if (type === 'warning') {
        iconBox.style.background = "var(--warning-bg)";
        iconBox.style.color = "var(--warning)";
        icon.className = "fas fa-exclamation-triangle animate__animated animate__pulse animate__infinite";
        okBtn.style.background = "var(--secondary)"; // Gold/Brass Accent
        okBtn.style.color = "white";
    } else { // info / success
        iconBox.style.background = "var(--primary-light)";
        iconBox.style.color = "var(--primary)";
        icon.className = "fas fa-check-double animate__animated animate__bounceIn";
        okBtn.style.background = "var(--primary)";
        okBtn.style.color = "white";
    }

    titleEl.innerText = title;
    msgEl.innerText = message;

    // Open modal
    modal.style.display = "flex";

    // Setup action handlers
    const cleanUp = () => {
        modal.style.display = "none";
        // Remove event listeners by cloning elements
        const newOkBtn = okBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    };

    document.getElementById("confirmOkBtn").addEventListener("click", () => {
        cleanUp();
        onConfirm();
    });

    document.getElementById("confirmCancelBtn").addEventListener("click", () => {
        cleanUp();
    });
}

/* ============================
   ACTIONS
   ============================ */

// 1. Clear All (Batch Delete)
window.clearAllNotifications = async function() {
    if(allNotifications.length === 0) return;
    
    showCustomConfirm(
        "Clear All History?",
        "Are you sure you want to permanently delete all notifications? This cannot be undone.",
        "danger",
        async () => {
            const db = firebase.firestore();
            const batch = db.batch();
            
            allNotifications.forEach(n => {
                const ref = db.collection('notifications').doc(n.id);
                batch.delete(ref);
            });

            try {
                await batch.commit();
                if(window.showToast) showToast("Cleared", "All notifications have been deleted.", "success");
            } catch (error) {
                console.error("Error clearing notifications:", error);
                if(window.showToast) showToast("Error", "Could not clear notifications.", "error");
            }
        }
    );
};

// 2. Mark as Read (Single Update)
window.markAsRead = function(id, currentStatus) {
    if (currentStatus === true) return; // Already read

    // Update both field names to be safe
    firebase.firestore().collection('notifications').doc(id)
        .update({ isRead: true, read: true })
        .catch(err => console.error("Error marking read:", err));
};

// 3. Mark All as Read (Batch Update)
window.markAllAsRead = async function() {
    if(allNotifications.length === 0) return;

    // Check if there are actually any unread items
    const unreadCount = allNotifications.filter(n => {
        const isRead = n.isRead !== undefined ? n.isRead : n.read;
        return !isRead;
    }).length;

    if (unreadCount === 0) {
        if(window.showToast) showToast("Info", "No unread notifications", "default");
        return;
    }
    
    showCustomConfirm(
        "Mark All as Read?",
        "Would you like to mark all notifications as read?",
        "info",
        async () => {
            const db = firebase.firestore();
            const batch = db.batch();
            
            allNotifications.forEach(n => {
                const isRead = n.isRead !== undefined ? n.isRead : n.read;
                if (!isRead) {
                    const ref = db.collection('notifications').doc(n.id);
                    batch.update(ref, { isRead: true, read: true });
                }
            });

            try {
                await batch.commit();
                if(window.showToast) showToast("Success", "All notifications marked as read.", "success");
            } catch (error) {
                console.error("Error marking all read:", error);
                if(window.showToast) showToast("Error", "Could not update status", "error");
            }
        }
    );
};

// 4. Delete Single
window.deleteNotification = function(event, id) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const card = btn.closest('.notification-card');

    showCustomConfirm(
        "Dismiss Notification?",
        "Are you sure you want to delete this notification?",
        "warning",
        () => {
            if(card) {
                card.style.transform = 'scale(0.9)';
                card.style.opacity = '0';
            }

            setTimeout(() => {
                firebase.firestore().collection('notifications').doc(id).delete()
                    .then(() => {
                        if(window.showToast) showToast("Deleted", "Notification removed.");
                    })
                    .catch(err => {
                        console.error("Error deleting:", err);
                        if(card) {
                            card.style.transform = 'none';
                            card.style.opacity = '1';
                        }
                    });
            }, 300);
        }
    );
};

/* ============================
   HELPERS & SIMULATION
   ============================ */

function timeAgo(date) {
    if (!date) return "";
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds > 604800) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    let interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "Just now";
}

function getIconForType(type) {
    switch (type) {
        case 'medication': return 'fas fa-pills';
        case 'appointment': return 'fas fa-calendar-check';
        case 'urgent': return 'fas fa-exclamation-triangle';
        case 'alert': return 'fas fa-bell';
        default: return 'fas fa-info-circle';
    }
}

// 5. Simulator (Updated to use Root Collection + Correct Fields)
window.simulateAlert = async function() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) {
        console.error("No user signed in.");
        return;
    }

    const testScenarios = [
        { title: "Medication Reminder", message: "Elder Kasim is due for Lisinopril (10mg) now.", type: "medication" },
        { title: "Upcoming Appointment", message: "Dr. Smith check-up at 2:00 PM.", type: "appointment" },
        { title: "Urgent: High Blood Pressure", message: "Last reading for Kasim was 150/95. Please monitor.", type: "urgent" },
        { title: "Stock Warning", message: "Only 2 days left of Paracetamol stock.", type: "medication" }
    ];

    const scenario = testScenarios[Math.floor(Math.random() * testScenarios.length)];

    try {
        await firebase.firestore().collection('notifications').add({
            familyId: user.familyId,
            recipientId: user.uid,
            title: scenario.title,
            message: scenario.message,
            type: scenario.type,
            isRead: false,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (window.showToast) window.showToast("Success", "Actionable alert created", "success");
    } catch (e) {
        console.error(e);
    }
};