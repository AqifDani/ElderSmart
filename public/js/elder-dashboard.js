// js/elder-dashboard.js

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
        const dayIndex = todayDate.getDay();

        const myAppts = appts.filter(a => a.elderId === currentUserId);
        const myMeds = meds.filter(m => m.elderId === currentUserId);

        const todaysAppts = myAppts.filter(a => a.date.startsWith(todayStr));
        
        const todaysMeds = myMeds.filter(m => {
            if (m.startDate && todayStr < m.startDate) return false;

            if (m.frequency === 'daily') return true;
            if (m.frequency === 'specific' && m.days && m.days.includes(dayIndex)) return true;
            return false;
        });

        if (myAppts.length > 0) {
            myAppts.sort((a, b) => new Date(a.date) - new Date(b.date));
            const next = myAppts[0];
            const nextDate = new Date(next.date);
            
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

        const medsCountEl = document.getElementById("medsCount");
        medsCountEl.classList.remove('skeleton', 'skeleton-text-short');
        medsCountEl.innerText = todaysMeds.length;

        const table = document.getElementById("scheduleBody");
        table.innerHTML = "";

        let items = [];

        todaysAppts.forEach(a => {
            items.push({
                time: new Date(a.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'Visit',
                title: a.title,
                detail: a.location || 'No location',
                sortTime: new Date(a.date).getTime()
            });
        });

        todaysMeds.forEach(m => {
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