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

        // 5. Render Health Chart
        renderCompositionChart(healthRecords);

    } catch (error) {
        console.error("Dashboard Error:", error);
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
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
            <div>
                <h2 style="margin:0; font-size:20px; color:var(--primary);">
                    ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </h2>
                <p style="margin:5px 0 0; font-weight:bold; color:#333; font-size:14px;">${next.title}</p>
                <p style="margin:2px 0 0; font-size:12px; color:#666;">
                    ${next.doctor ? '👨‍⚕️ ' + next.doctor : ''} 
                </p>
            </div>
            <div style="text-align:right;">
                <span style="background:#e0f2fe; color:#0369a1; padding:4px 10px; border-radius:12px; font-size:11px; font-weight:bold;">
                    ${dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
                <div style="margin-top:8px;">
                     ${next.assignedToName 
                        ? `<span style="font-size:12px; color:green;">✔ ${next.assignedToName.split(' ')[0]}</span>` 
                        : `<span style="font-size:12px; color:red; font-weight:bold;">⚠ Unassigned</span>`
                     }
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

function renderCompositionChart(records) {
    const ctx = document.getElementById('compositionChart');
    if (!ctx) return;

    let safeCount = 0;
    let warningCount = 0;

    if (records.length === 0) { safeCount = 0; warningCount = 1; } 
    else {
        records.forEach(rec => {
            if (rec.bp && rec.bp.includes('/')) {
                const [sys, dia] = rec.bp.split('/').map(Number);
                if (sys > 140 || dia > 90) warningCount++; else safeCount++;
            } else { safeCount++; }
        });
    }

    if (safeCount === 0 && warningCount === 0) safeCount = 1;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Normal', 'Attention'],
            datasets: [{
                data: [safeCount, warningCount],
                backgroundColor: ['#166534', '#ef4444'],
                borderWidth: 0, hoverOffset: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '75%',
            plugins: { legend: { display: false }, tooltip: { enabled: true } }
        },
        plugins: [{
            id: 'centerText',
            beforeDraw: function(chart) {
                if (records.length === 0) return;
                const width = chart.width, height = chart.height, ctx = chart.ctx;
                ctx.restore();
                const total = safeCount + warningCount;
                const percent = Math.round((safeCount / total) * 100);
                
                const fontSize = (height / 114).toFixed(2);
                ctx.font = "bold " + fontSize + "em sans-serif";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "#166534";
                
                const text = percent + "%", textX = Math.round((width - ctx.measureText(text).width) / 2), textY = height / 2.2;
                ctx.fillText(text, textX, textY);
                
                ctx.font = "normal " + (fontSize*0.4).toFixed(2) + "em sans-serif";
                ctx.fillStyle = "#6b7280";
                const subtext = "Safe", subtextX = Math.round((width - ctx.measureText(subtext).width) / 2), subtextY = height / 1.75;
                ctx.fillText(subtext, subtextX, subtextY);
                ctx.save();
            }
        }]
    });
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