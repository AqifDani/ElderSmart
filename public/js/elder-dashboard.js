// js/elder-dashboard.js - REFACTORED (Smart Logic + Privacy Filter)

(async () => {
    if (!window.appointmentService || !window.medicationService) return;

    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            const storedUser = JSON.parse(localStorage.getItem('currentUser'));
            if (storedUser) {
                document.getElementById("welcomeName").innerText = storedUser.name || "Friend";
                const codeElem = document.getElementById("displayFamilyId");
                if (codeElem) codeElem.innerText = storedUser.familyId;
            }
            // Pass the user ID to filter data strictly for this elder
            loadMyDay(user.uid);
        } else {
            window.location.href = 'login.html';
        }
    });

    window.copyFamilyCode = function () {
        const code = document.getElementById("displayFamilyId").innerText;
        navigator.clipboard.writeText(code);
        if(window.showToast) showToast("Copied!", "Share this code with your caregivers.", "success");
    };
})();

async function loadMyDay(currentUserId) {
    try {
        const [appts, meds] = await Promise.all([
            window.appointmentService.getUpcoming(),
            window.medicationService.getAll()
        ]);

        const todayStr = new Date().toISOString().split('T')[0];
        const todayDate = new Date();
        const dayIndex = todayDate.getDay(); // 0 = Sun, 1 = Mon...

        // --- 1. PRIVACY FILTER: Only show items for THIS elder ---
        // We filter by 'elderId' which should match the logged-in user's UID.
        // If data doesn't have elderId (legacy), we might hide it or show it (safety choice).
        // Here we STRICTLY filter: record.elderId === currentUserId
        
        const myAppts = appts.filter(a => a.elderId === currentUserId);
        const myMeds = meds.filter(m => m.elderId === currentUserId);

        // --- 2. FILTER: Get Today's Appointments & Today's Meds ---
        const todaysAppts = myAppts.filter(a => a.date.startsWith(todayStr));
        
        const todaysMeds = myMeds.filter(m => {
            // Check start date if applicable
            if (m.startDate && todayStr < m.startDate) return false;

            if (m.frequency === 'daily') return true;
            if (m.frequency === 'specific' && m.days && m.days.includes(dayIndex)) return true;
            return false;
        });

        // --- 3. CARD: Next Visit (ANY Upcoming Date for THIS Elder) ---
        if (myAppts.length > 0) {
            // Sort by date to be safe
            myAppts.sort((a, b) => new Date(a.date) - new Date(b.date));
            const next = myAppts[0]; // First one is the next one
            const nextDate = new Date(next.date);
            
            // Format: "10:30 AM" or "Oct 24, 10:30 AM" if not today
            const timeStr = nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isToday = next.date.startsWith(todayStr);
            const finalDisplay = isToday ? timeStr : `${nextDate.getDate()}/${nextDate.getMonth()+1}, ${timeStr}`;

            const nextApptTimeEl = document.getElementById("nextApptTime");
            const nextApptTitleEl = document.getElementById("nextApptTitle");
            nextApptTimeEl.classList.remove('skeleton', 'skeleton-text-short');
            nextApptTitleEl.classList.remove('skeleton', 'skeleton-text');
            nextApptTimeEl.innerText = finalDisplay;
            nextApptTitleEl.innerText = next.title;
        } else {
            const nextApptTimeEl = document.getElementById("nextApptTime");
            const nextApptTitleEl = document.getElementById("nextApptTitle");
            nextApptTimeEl.classList.remove('skeleton', 'skeleton-text-short');
            nextApptTitleEl.classList.remove('skeleton', 'skeleton-text');
            nextApptTimeEl.innerText = "--:--";
            nextApptTitleEl.innerText = "No upcoming visits";
        }

        // --- 4. CARD: Medication Count (Today Only) ---
        const medsCountEl = document.getElementById("medsCount");
        medsCountEl.classList.remove('skeleton', 'skeleton-text-short');
        medsCountEl.innerText = todaysMeds.length;

        // --- 5. TABLE: Build Timeline (Today Only) ---
        const table = document.getElementById("scheduleBody");
        table.innerHTML = "";

        let items = [];

        // Add Today's Visits
        todaysAppts.forEach(a => {
            items.push({
                time: new Date(a.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'Visit',
                title: a.title,
                detail: a.location || 'No location',
                sortTime: new Date(a.date).getTime()
            });
        });

        // Add Today's Meds
        todaysMeds.forEach(m => {
            // Helper to sort meds roughly by time string
            const [h, min] = m.time.split(':').map(Number);
            const d = new Date(); d.setHours(h, min, 0);
            
            items.push({
                time: formatTime(m.time),
                type: 'Meds',
                title: m.name,
                detail: `${m.dosage} (Take ${m.perDose || 1})`,
                sortTime: d.getTime()
            });
        });

        if (items.length === 0) {
            table.innerHTML = `<tr><td colspan='3' class='text-center p-8'>
                <div style="display:flex; flex-direction:column; align-items:center; gap:10px; color:var(--text-muted);">
                    <i class="fas fa-mug-hot" style="font-size:32px; color:#d1d5db;"></i>
                    <p style="margin:0; font-weight:500;">Nothing scheduled for today.</p>
                    <p style="margin:0; font-size:13px;">Enjoy your free time!</p>
                </div>
            </td></tr>`;
            return;
        }

        // Sort timeline by time
        items.sort((a, b) => a.sortTime - b.sortTime);

        items.forEach(item => {
            const isVisit = item.type === 'Visit';
            const badgeClass = isVisit ? 'bg-info-light text-primary' : 'bg-warning-light text-warning';
            const icon = isVisit ? '<i class="fas fa-user-md"></i>' : '<i class="fas fa-pills"></i>';

            const row = `
                <tr>
                    <td class="timeline-time">${item.time}</td>
                    <td>
                        <span class="type-badge ${badgeClass}">
                            ${icon} ${item.type}
                        </span>
                    </td>
                    <td>
                        <div class="font-bold">${item.title}</div>
                        <div class="timeline-detail">${item.detail}</div>
                    </td>
                </tr>
            `;
            table.innerHTML += row;
        });

    } catch (error) {
        console.error("Error loading day:", error);
    }
}

function formatTime(t) {
    if (!t) return "--:--";
    const [h, m] = t.split(":");
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m} ${ampm}`;
}