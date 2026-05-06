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

    // Filter Logic
    const filtered = allNotifications.filter(n => {
        // Handle both field names: isRead (old) vs read (new)
        const isRead = n.isRead !== undefined ? n.isRead : n.read;
        if (currentFilter === 'unread') return !isRead;
        return true;
    });

    // 1. Empty State
    if (filtered.length === 0) {
        list.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:60px; background:white; border-radius:24px; border:2px dashed #e2e8f0;">
                <i class="far fa-bell-slash text-5xl text-gray-300 mb-4" style="font-size: 3rem; color: #cbd5e1;"></i>
                <h3 class="text-xl font-bold text-gray-400" style="color: #94a3b8; margin-top: 1rem;">All Caught Up!</h3>
                <p class="text-gray-400" style="color: #94a3b8;">No new activity to show.</p>
            </div>`;
        return;
    }

    // 2. Build HTML String
    let fullHtml = "";

    filtered.forEach(notif => {
        // Normalize fields
        const isRead = notif.isRead !== undefined ? notif.isRead : notif.read;
        const ts = notif.createdAt || notif.timestamp;

        // Time Formatting
        let timeString = '';
        if (ts && typeof ts.toDate === 'function') {
             timeString = timeAgo(ts.toDate());
        } else if (ts) {
             timeString = timeAgo(new Date(ts));
        }

        // Detect Type
        const title = (notif.title || "").toLowerCase();
        const type = (notif.type || "").toLowerCase();
        let isUrgent = false;
        
        if (type === 'urgent' && !title.includes('appointment')) isUrgent = true;
        if (title.includes('missed') || title.includes('sos') || title.includes('alert')) isUrgent = true;

        const cardType = isUrgent ? "urgent" : "info";
        const iconClass = isUrgent ? "fa-exclamation-circle" : (type === 'medication' ? "fa-pills" : "fa-calendar-check");
        
        const statusHtml = !isRead 
            ? `<span class="status-badge status-new">NEW</span>` 
            : `<span class="status-badge status-seen">SEEN</span>`;

        fullHtml += `
            <div class="notification-card ${cardType} ${isRead ? 'opacity-75' : ''}" onclick="markAsRead('${notif.id}', ${isRead})">
                <div class="notif-header w-full">
                    <div class="flex items-start gap-4 w-full">
                        <div class="notif-icon-box">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <div class="flex-grow">
                            <div class="flex justify-between items-start mb-1">
                                <div class="flex flex-col">
                                    <h4 class="${isRead ? 'font-normal' : 'font-bold'} text-lg">${notif.title || 'Notification'}</h4>
                                    <span class="notif-time text-xs text-muted">${timeString}</span>
                                </div>
                            </div>
                            <p class="text-muted text-sm mb-3 mt-1">${notif.message || ''}</p>
                            <div class="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                                ${statusHtml}
                                <button class="btn-trash" onclick="deleteNotification(event, '${notif.id}')" title="Dismiss">
                                    <i class="fas fa-trash-alt"></i>
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

function filterNotifications(type, btnElement) {
    currentFilter = type;
    document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
    renderNotifications();
}

/* ============================
   ACTIONS
   ============================ */

// 1. Clear All (Batch Delete)
window.clearAllNotifications = async function() {
    if(allNotifications.length === 0) return;
    
    if(!confirm("Are you sure you want to clear ALL notifications? This cannot be undone.")) {
        return;
    }

    const db = firebase.firestore();
    const batch = db.batch();
    
    // Deleting from memory list IDs is safer since we already filtered them
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
    
    if(!confirm("Mark all notifications as read?")) return;

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
        if(window.showToast) showToast("Success", "All marked as read", "success");
    } catch (error) {
        console.error("Error marking all read:", error);
        if(window.showToast) showToast("Error", "Could not update status", "error");
    }
};

// 4. Delete Single
window.deleteNotification = function(event, id) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const card = btn.closest('.notification-card');

    if(!confirm("Delete this notification?")) return;

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

    try {
        await firebase.firestore().collection('notifications').add({
            familyId: user.familyId,
            recipientId: user.uid,
            title: "Test Alert " + Math.floor(Math.random() * 100),
            message: "This is a test notification generated at " + new Date().toLocaleTimeString(),
            type: Math.random() > 0.5 ? "urgent" : "normal",
            isRead: false,
            read: false, // Adding both to be safe
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("Simulated alert added.");
        if (window.showToast) window.showToast("Success", "Test alert created", "success");
    } catch (e) {
        console.error("Error simulating alert:", e);
        if (window.showToast) window.showToast("Error", "Could not create alert", "error");
    }
};