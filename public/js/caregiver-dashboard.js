// js/caregiver-dashboard.js


(async () => {
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

        const alertEl = document.getElementById("activeAlerts");
        if(alertEl) {
            alertEl.innerText = unreadAlerts;
            alertEl.style.color = unreadAlerts > 0 ? "#ef4444" : "#166534";
        }
        renderRecentHealthUpdates(healthRecords);

        initMiniCalendar(appts);

        updateNextApptWidget(futureAppts);

        renderElderHealthList(healthRecords, elders);

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

        const [usersSnap, appointmentsSnap] = await Promise.all([
            firebase.firestore().collection("users")
                .where("familyId", "==", familyId)
                .get(),
            firebase.firestore().collection("appointments")
                .where("familyId", "==", familyId)
                .get()
        ]);

        const caregivers = [];
        usersSnap.forEach(doc => {
            const data = doc.data();
            if (data.role === 'caregiver' || data.role === 'primary_caregiver') {
                caregivers.push({
                    id: doc.id,
                    name: data.name,
                    role: data.role,
                    totalShiftsCompleted: data.totalShiftsCompleted || 0,
                    pendingShifts: 0
                });
            }
        });

        const localNow = new Date();
        const year = localNow.getFullYear();
        const month = String(localNow.getMonth() + 1).padStart(2, '0');
        const day = String(localNow.getDate()).padStart(2, '0');
        const hours = String(localNow.getHours()).padStart(2, '0');
        const minutes = String(localNow.getMinutes()).padStart(2, '0');
        const localNowStr = `${year}-${month}-${day}T${hours}:${minutes}`;

        appointmentsSnap.forEach(doc => {
            const appt = doc.data();
            if (appt.status !== 'completed' && appt.assignedToName && appt.date >= localNowStr) {
                const caregiver = caregivers.find(c => c.name === appt.assignedToName || c.id === appt.assignedToId);
                if (caregiver) {
                    caregiver.pendingShifts++;
                }
            }
        });


        const enrichedCaregivers = caregivers.map(c => {
            const completed = c.totalShiftsCompleted;
            const total = completed + c.pendingShifts;
            return {
                ...c,
                completed,
                total
            };
        });

        const minShifts = enrichedCaregivers.length > 0 ? Math.min(...enrichedCaregivers.map(c => c.total)) : 0;

        tableBody.innerHTML = enrichedCaregivers.sort((a, b) => a.total - b.total).map(c => {
            const isTarget = c.total === minShifts;
            const roleLabel = c.role === 'primary_caregiver' ? 'Primary' : 'Support';
            
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
                        <div class="text-sm font-bold text-dark">${c.total} <span class="text-xs text-muted font-normal">Shifts</span></div>
                        <div class="text-xs text-muted font-normal">${c.pendingShifts} pending</div>
                    </td>
                    <td class="p-4">
                        <span class="font-bold text-sm text-dark">${c.completed}</span>
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
                    <div class="mt-2" style="display: flex; justify-content: flex-end;">
                        ${next.assignedToName 
                            ? `
                            <div class="driver-pill" style="padding: 4px 8px; font-size: 11px; border-radius: 12px; gap: 4px;">
                                <div class="avatar-circle" style="width: 18px; height: 18px; font-size: 8px;">${next.assignedToName.substring(0, 2).toUpperCase()}</div>
                                <span>${next.assignedToName.split(' ')[0]}</span>
                            </div>` 
                            : `
                            <div class="driver-pill" style="background: #fef2f2; color: #991b1b; padding: 4px 8px; font-size: 11px; border-radius: 12px; gap: 4px;">
                                <div class="avatar-circle" style="width: 18px; height: 18px; background: #ef4444; color: white; font-size: 8px;">⚠</div>
                                <span>Unassigned</span>
                            </div>`
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

function renderRecentHealthUpdates(records) {
    const container = document.getElementById("miniAlertList");
    if (!container) return;

    if (!records || records.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                <i class="fas fa-notes-medical" style="font-size: 24px; margin-bottom: 8px; opacity: 0.5;"></i>
                <p style="margin: 0; font-size: 13px;">No recent health logs recorded.</p>
            </div>`;
        return;
    }

    const recent = records.slice(0, 3);
    let html = "";
    recent.forEach(rec => {
        const dateStr = new Date(rec.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        
        let bpBadge = "";
        if (rec.bp) {
            let bpStyle = "background: #e6f4ea; color: #137333;";
            if (rec.bp.includes('/')) {
                const [sys, dia] = rec.bp.split('/').map(Number);
                if (sys > 140 || dia > 90) {
                    bpStyle = "background: #fce8e6; color: #c5221f; font-weight: 800;";
                }
            }
            bpBadge = `<span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; ${bpStyle}">${rec.bp}</span>`;
        }

        const hrInfo = rec.hr ? `<span style="font-size: 11px; color: var(--text-muted);"><i class="fas fa-heartbeat" style="color: var(--secondary); margin-right: 2px;"></i>${rec.hr} bpm</span>` : "";

        html += `
            <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: white; border-radius: 12px; border: 1.5px solid #f1f5f9; box-shadow: var(--shadow-soft); transition: transform 0.2s;" onmouseenter="this.style.transform='translateX(4px)'" onmouseleave="this.style.transform=''">
                <div style="width: 32px; height: 32px; background: var(--primary-light); color: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0;">
                    ${rec.elderName ? rec.elderName[0].toUpperCase() : '?'}
                </div>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <span style="font-size: 13px; font-weight: 700; color: var(--text-main);">${rec.elderName}</span>
                        <span style="font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">${dateStr}</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; font-weight: 600;">
                        <i class="fas fa-clinic-medical" style="font-size: 9px; margin-right: 2px;"></i>${rec.location || 'Clinic Visit'}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${bpBadge}
                        ${hrInfo}
                    </div>
                </div>
            </div>`;
    });

    container.innerHTML = html;
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

setTimeout(runSafetyChecks, 3000);