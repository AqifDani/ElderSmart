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
        eldersEl.classList.remove('skeleton', 'skeleton-text-short');
        eldersEl.innerText = `${elders.length} Profiles`;
        
        const now = new Date();
        const futureAppts = appts.filter(a => new Date(a.date) >= now);
        
        const upcomingEl = document.getElementById("upcomingAppts");
        upcomingEl.classList.remove('skeleton', 'skeleton-text-short');
        upcomingEl.innerText = `${futureAppts.length}`;
        
        const medsEl = document.getElementById("totalMeds");
        medsEl.classList.remove('skeleton', 'skeleton-text-short');
        medsEl.innerText = `${meds.length} Active`;

        // 2. Alerts
        const alertEl = document.getElementById("activeAlerts");
        alertEl.innerText = unreadAlerts;
        alertEl.style.color = unreadAlerts > 0 ? "#ef4444" : "#166534";
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

        // Tally completed shifts per caregiver
        const shiftCounts = {};
        apptsSnap.forEach(doc => {
            const data = doc.data();
            // Use assignedToName as the key since current system often uses names
            const name = data.assignedToName;
            if (name) shiftCounts[name] = (shiftCounts[name] || 0) + 1;
        });

        // Find minimum deficit score for highlighting
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

// --- NEW CALENDAR LOGIC ---
function initMiniCalendar(appointments) {
    // 1. Extract dates that have events for the "dot" indicators
    const eventDates = appointments.map(a => a.date.split('T')[0]);

    flatpickr("#miniCalendar", {
        inline: true,
        dateFormat: "Y-m-d",
        shorthandCurrentMonth: true,
        
        // Add Dots to days with events
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            // Format dayElem date to YYYY-MM-DD to compare
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (eventDates.includes(dateStr)) {
                dayElem.innerHTML += "<span class='event-dot'></span>";
            }
        },

        // Handle Click Event
        onChange: function(selectedDates, dateStr) {
            if (selectedDates.length === 0) return;
            
            // Filter appointments for this specific date
            const selectedAppts = appointments.filter(a => a.date.startsWith(dateStr));
            
            // Update the UI Badge
            const badge = document.getElementById("selectedDateBadge");
            badge.classList.remove("hidden");
            badge.innerText = new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });

            if (selectedAppts.length > 0) {
                // Show list of appointments for that day
                updateNextApptWidget(selectedAppts, true);
            } else {
                // Show empty state
                document.getElementById("nextApptSummary").innerHTML = `
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
    container.classList.remove('skeleton');

    // Update Title context
    title.innerText = isSpecificDate ? "Day Schedule" : "Next In Line";

    if (appts.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:10px;">
                <i class="fas fa-calendar-check" style="font-size:24px; color:#ccc; margin-bottom:10px;"></i>
                <p style="color:#666; margin:0;">No upcoming appointments.</p>
            </div>`;
        return;
    }

    appts.sort((a, b) => new Date(a.date) - new Date(b.date));

    // If specific date selected, we might show multiple. For "Next In Line", we show one.
    // Let's show up to 2 items if specific date is clicked, otherwise just the top 1.
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

// ... (Existing updateMiniAlerts, renderCompositionChart, runSafetyChecks logic unchanged) ...

function updateMiniAlerts(count) {
    const container = document.getElementById("miniAlertList");
    if (!container) return;
    
    if (count > 0) {
        container.innerHTML = `
            <div class="flex items-center gap-3 p-3 bg-danger-bg rounded-lg border border-red-200">
                <i class="fas fa-exclamation-circle text-danger text-xl"></i>
                <div>
                    <h4 class="font-bold text-danger text-sm">Action Needed</h4>
                    <p class="text-xs text-danger">You have ${count} unread alerts.</p>
                </div>
            </div>`;
    } else {
        container.innerHTML = `
            <div class="flex items-center gap-3 p-3 bg-success-bg rounded-lg border border-green-200">
                <i class="fas fa-check-circle text-success text-xl"></i>
                <div>
                    <h4 class="font-bold text-success text-sm">All Clear</h4>
                    <p class="text-xs text-success">System is running smoothly.</p>
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
        // Match by elderId (new records) OR elderName (legacy records)
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
        try { await window.medicationService.checkForMissedMeds(user); } catch (e) {}
    }
}
setTimeout(runSafetyChecks, 3000);

// Add this to your main Dashboard/Overview initialization
async function runSafetyChecks() {
    const user = firebase.auth().currentUser;
    if (user && window.medicationService) {
        try {
            console.log("Running safety check for missed meds...");
            const count = await window.medicationService.checkForMissedMeds(user);
            
            if (count > 0) {
                // Play a sound or show a toast
                if(window.showToast) showToast("Attention Needed", `${count} medications were missed yesterday.`, "error");
            }
        } catch (e) {
            console.error("Safety check failed:", e);
        }
    }
}

// Trigger it 2 seconds after load (to ensure services are ready)
setTimeout(runSafetyChecks, 2000);

function updateNextApptWidget(appts) {
    const container = document.getElementById("nextApptSummary");
    if(container) container.classList.remove('skeleton');
    
    if (appts.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:10px;">
                <i class="fas fa-calendar-check" style="font-size:24px; color:#ccc; margin-bottom:10px;"></i>
                <p style="color:#666; margin:0;">No upcoming appointments.</p>
            </div>`;
        return;
    }

    // Sort by date (nearest first) just in case
    appts.sort((a, b) => new Date(a.date) - new Date(b.date));
    const next = appts[0];
    const dateObj = new Date(next.date);

    // Dynamic HTML for the widget
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h2 style="margin:0; font-size:24px; color:var(--primary);">
                    ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </h2>
                <p style="margin:5px 0 0; font-weight:bold; color:#333;">${next.title}</p>
                <p style="margin:2px 0 0; font-size:13px; color:#666;">
                    ${next.doctor ? '👨‍⚕️ ' + next.doctor : ''} 
                    ${next.location ? '📍 ' + next.location : ''}
                </p>
            </div>
            <div style="text-align:right;">
                <span style="background:#e0f2fe; color:#0369a1; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">
                    ${dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
                <div style="margin-top:8px;">
                     ${next.assignedToName 
                        ? `<span style="font-size:12px; color:green;">✔ ${next.assignedToName}</span>` 
                        : `<span style="font-size:12px; color:red; font-weight:bold;">⚠ Unassigned</span>`
                     }
                </div>
            </div>
        </div>
    `;
}