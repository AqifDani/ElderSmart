// js/caregiver-dashboard.js - WIRED TO REAL DATA

// js/caregiver-dashboard.js - CALENDAR & CHARTS ADDED

(async () => {
    // Safety check for services
    if (!window.elderService || !window.appointmentService || !window.medicationService || !window.healthService) {
        console.log("Waiting for services...");
        setTimeout(() => location.reload(), 500); 
        return;
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            const dbUser = JSON.parse(localStorage.getItem('currentUser'));
            if (dbUser && dbUser.name) {
                document.getElementById("welcomeName").innerText = dbUser.name;
            }
            loadDashboardStats();
        } else {
            window.location.href = 'login.html';
        }
    });
})();

async function loadDashboardStats() {
    try {
        const [elders, appts, meds, unreadAlerts, healthRecords] = await Promise.all([
            window.elderService.getAll(),
            window.appointmentService.getUpcoming(),
            window.medicationService.getAll(),
            window.notificationService.getUnreadCount(),
            window.healthService.getRecent()
        ]);

        // 1. Basic Stats
        const eldersEl = document.getElementById("totalElders");
        if(eldersEl) {
            eldersEl.classList.remove('skeleton', 'skeleton-text-short');
            eldersEl.innerText = `${elders.length} Profiles`;
        }
        
        const now = new Date();
        const futureAppts = appts.filter(a => new Date(a.date) >= now);
        
        const upcomingEl = document.getElementById("upcomingAppts");
        if(upcomingEl) {
            upcomingEl.classList.remove('skeleton', 'skeleton-text-short');
            upcomingEl.innerText = `${futureAppts.length}`;
        }
        
        const medsEl = document.getElementById("totalMeds");
        if(medsEl) {
            medsEl.classList.remove('skeleton', 'skeleton-text-short');
            medsEl.innerText = `${meds.length} Active`;
        }

        // 2. Alerts
        const alertEl = document.getElementById("activeAlerts");
        if(alertEl) {
            alertEl.innerText = unreadAlerts;
            alertEl.style.color = unreadAlerts > 0 ? "#ef4444" : "#166534";
        }
        updateMiniAlerts(unreadAlerts);

        // 3. Initialize Calendar with Data (Interactive)
        initMiniCalendar(appts);

        // 4. Default: Show Next Immediate Appointment
        updateNextApptWidget(futureAppts);

        // 5. Render Health List (Per Elder)
        renderElderHealthList(healthRecords, elders);

        // 6. Family Leaderboard
        loadFamilyLeaderboard();

    } catch (error) {
        console.error("Dashboard Error:", error);
    }
}

async function loadFamilyLeaderboard() {
    const tableBody = document.getElementById("leaderboardBody");
    if (!tableBody) return;

    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const familyId = currentUser.familyId;

        // Fetch all caregivers in the family
        const [usersSnap, apptsSnap] = await Promise.all([
            firebase.firestore().collection("users")
                .where("familyId", "==", familyId)
                .get(),
            firebase.firestore().collection("appointments")
                .where("familyId", "==", familyId)
                .where("status", "==", "completed")
                .get()
        ]);

        const caregivers = [];
        usersSnap.forEach(doc => {
            const data = doc.data();
            if (data.role === 'caregiver' || data.role === 'primary_caregiver') {
                caregivers.push({ id: doc.id, ...data });
            }
        });

        const shiftCounts = {};
        apptsSnap.forEach(doc => {
            const data = doc.data();
            const name = data.assignedToName;
            if (name) shiftCounts[name] = (shiftCounts[name] || 0) + 1;
        });

        const minDeficit = Math.min(...caregivers.map(c => c.deficitScore || 0));

        tableBody.innerHTML = caregivers.sort((a, b) => (a.deficitScore || 0) - (b.deficitScore || 0)).map(c => {
            const isTarget = (c.deficitScore || 0) === minDeficit;
            const completed = shiftCounts[c.name] || 0;
            const roleLabel = c.role === 'primary_caregiver' ? 'Primary' : 'Support';
            const score = c.deficitScore || 0;
            
            return `
                <tr class="leaderboard-row">
                    <td class="p-4">
                        <div class="flex items-center gap-4">
                            <div class="avatar-pill ${c.role === 'primary_caregiver' ? 'primary' : 'secondary'}">
                                ${c.name.charAt(0)}
                            </div>
                            <div>
                                <div class="font-bold text-sm">${c.name} ${c.id === firebase.auth().currentUser.uid ? '<span class="text-xs text-primary">(You)</span>' : ''}</div>
                                <div class="text-xs text-muted">${roleLabel} Caregiver</div>
                            </div>
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="text-sm font-bold text-dark">${completed} <span class="text-xs text-muted font-normal">Shifts</span></div>
                    </td>
                    <td class="p-4">
                        <span class="font-bold text-sm ${score < 0 ? 'text-danger' : 'text-success'}">${score > 0 ? '+' : ''}${score}</span>
                    </td>
                    <td class="p-4 text-right">
                        ${isTarget ? '<span class="badge badge-stock-low">Next In Line</span>' : '<span class="badge badge-stock-ok">Stable</span>'}
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("Leaderboard Error:", error);
        tableBody.innerHTML = "<tr><td colspan='4' class='text-center p-4 text-danger'>Failed to load leaderboard.</td></tr>";
    }
}

// --- CALENDAR LOGIC ---
function initMiniCalendar(appointments) {
    const eventDates = appointments.map(a => a.date.split('T')[0]);

    flatpickr("#miniCalendar", {
        inline: true,
        dateFormat: "Y-m-d",
        shorthandCurrentMonth: true,
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (eventDates.includes(dateStr)) {
                dayElem.innerHTML += "<span class='event-dot'></span>";
            }
        },
        onChange: function(selectedDates, dateStr) {
            if (selectedDates.length === 0) return;
            const selectedAppts = appointments.filter(a => a.date.startsWith(dateStr));
            const badge = document.getElementById("selectedDateBadge");
            if(badge) {
                badge.classList.remove("hidden");
                badge.innerText = new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
            }

            if (selectedAppts.length > 0) {
                updateNextApptWidget(selectedAppts, true);
            } else {
                const summary = document.getElementById("nextApptSummary");
                if(summary) summary.innerHTML = `
                    <div style="text-align:center; padding:15px;">
                        <i class="far fa-calendar text-2xl text-muted mb-2"></i>
                        <p class="text-sm text-muted">No visits scheduled for this day.</p>
                    </div>`;
            }
        }
    });
}

function updateNextApptWidget(appts, isSpecificDate = false) {
    const container = document.getElementById("nextApptSummary");
    const title = document.getElementById("scheduleTitle");
    if(!container) return;
    container.classList.remove('skeleton');

    if(title) title.innerText = isSpecificDate ? "Day Schedule" : "Next In Line";

    if (appts.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:10px;">
                <i class="fas fa-calendar-check" style="font-size:24px; color:#ccc; margin-bottom:10px;"></i>
                <p style="color:#666; margin:0;">No upcoming appointments.</p>
            </div>`;
        return;
    }

    appts.sort((a, b) => new Date(a.date) - new Date(b.date));
    const limit = isSpecificDate ? 3 : 1;
    const itemsToShow = appts.slice(0, limit);

    let html = "";
    itemsToShow.forEach(next => {
        const dateObj = new Date(next.date);
        html += `
        <div class="next-appt-card">
            <div class="flex justify-between items-center">
                <div>
                    <div class="appt-time">
                        ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <p class="font-bold text-sm text-dark mt-1 mb-0">${next.title}</p>
                    <p class="text-xs text-muted mt-1">
                        ${next.doctor ? '👨‍⚕️ ' + next.doctor : ''} 
                    </p>
                </div>
                <div class="text-right">
                    <span class="badge appt-badge">
                        ${dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                    <div class="mt-2">
                        ${next.assignedToName 
                            ? `<span class="text-xs text-success font-bold">✔ ${next.assignedToName.split(' ')[0]}</span>` 
                            : `<span class="text-xs text-danger font-bold">⚠ Unassigned</span>`
                        }
                    </div>
                </div>
            </div>
        </div>`;
    });

    if(isSpecificDate && appts.length > limit) {
        html += `<p class="text-center text-xs text-link">+${appts.length - limit} more</p>`;
    }

    container.innerHTML = html;
}

function updateMiniAlerts(count) {
    const container = document.getElementById("miniAlertList");
    if (!container) return;
    
    if (count > 0) {
        container.innerHTML = `
            <div class="flex items-center gap-4 p-4 bg-red-50 rounded-2xl border border-red-100 shadow-sm animate__animated animate__headShake">
                <div class="flex-shrink-0 w-10 h-10 bg-danger rounded-xl flex items-center justify-center shadow-md">
                    <i class="fas fa-exclamation-triangle text-white text-lg"></i>
                </div>
                <div>
                    <h4 class="font-black text-danger text-sm tracking-tight" style="font-family:'Outfit', sans-serif;">Action Needed</h4>
                    <p class="text-xs text-danger opacity-80">You have ${count} unread alerts.</p>
                </div>
            </div>`;
    } else {
        container.innerHTML = `
            <div class="flex items-center gap-4 p-4 bg-green-50 rounded-2xl border border-green-100">
                <div class="flex-shrink-0 w-10 h-10 bg-success rounded-xl flex items-center justify-center">
                    <i class="fas fa-check-circle text-white text-lg"></i>
                </div>
                <div>
                    <h4 class="font-black text-success text-sm tracking-tight" style="font-family:'Outfit', sans-serif;">All Clear</h4>
                    <p class="text-xs text-success opacity-80">System is running smoothly.</p>
                </div>
            </div>`;
    }
}

function renderElderHealthList(records, elders) {
    const container = document.getElementById("elderHealthList");
    if (!container) return;
    
    if (elders.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#9ca3af; font-size:13px; padding:16px;">No elder profiles found.</p>`;
        return;
    }

    const STATUS = {
        safe:    { label: 'Safe',      bg: '#f0fdf4', dot: '#22c55e', text: '#16a34a', bar: 'linear-gradient(90deg,#4ade80,#22c55e)' },
        stable:  { label: 'Stable',    bg: '#fefce8', dot: '#eab308', text: '#ca8a04', bar: 'linear-gradient(90deg,#fde047,#eab308)' },
        warning: { label: 'Attention', bg: '#fff1f2', dot: '#ef4444', text: '#dc2626', bar: 'linear-gradient(90deg,#fca5a5,#ef4444)' },
    };

    let html = "";

    elders.forEach((elder, idx) => {
        const elderRecords = records.filter(r => 
            r.elderId === elder.id || 
            (r.elderName && r.elderName.toLowerCase() === elder.name.toLowerCase())
        );
        let safeCount = elderRecords.length === 0 ? 1 : 0;
        let warningCount = 0;

        elderRecords.forEach(rec => {
            if (rec.bp && rec.bp.includes('/')) {
                const [sys, dia] = rec.bp.split('/').map(Number);
                (sys > 140 || dia > 90) ? warningCount++ : safeCount++;
            } else { safeCount++; }
        });

        const total = safeCount + warningCount;
        const percent = Math.round((safeCount / total) * 100);
        const key = percent < 70 ? 'warning' : percent < 90 ? 'stable' : 'safe';
        const s = STATUS[key];
        const initials = elder.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const dataCount = elderRecords.length > 0 ? `${elderRecords.length} records` : 'No records yet';

        html += `
        <div class="health-status-card stagger-${(idx % 4) + 1}" onclick="window.location.href='health_records.html?elderId=${elder.id}'">
            <div class="health-status-accent" style="background: ${s.bar};"></div>

            <div class="flex items-center gap-4">
                <div class="health-avatar" style="background: ${s.bg}; color: ${s.text}; border: 1.5px solid ${s.dot}30;">
                    ${initials}
                </div>

                <div class="w-full">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold text-sm text-dark">${elder.name}</span>
                        <span class="font-bold text-lg text-dark">${percent}%</span>
                    </div>
                    <div class="progress-container" style="margin-top: 0; height: 8px;">
                        <div class="progress-fill-gradient" style="width: ${percent}%; background: ${s.bar};"></div>
                    </div>
                    <div class="flex justify-between items-center mt-2">
                        <span class="badge" style="background: ${s.bg}; color: ${s.text};">${s.label}</span>
                        <span class="text-xs text-muted font-medium">${dataCount}</span>
                    </div>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

async function runSafetyChecks() {
    const user = firebase.auth().currentUser;
    if (user && window.medicationService) {
        try {
            console.log("Running safety check for missed meds...");
            const count = await window.medicationService.checkForMissedMeds(user);
            
            if (count > 0) {
                if(window.showToast) showToast("Attention Needed", `${count} medications were missed yesterday.`, "error");
            }
        } catch (e) {
            console.error("Safety check failed:", e);
        }
    }
}

// Trigger it 3 seconds after load
setTimeout(runSafetyChecks, 3000);