// js/health.js - REFACTORED (Medical Master Feed)

let miniChartInstance = null;

(async () => {
    if (!window.healthService || !window.elderService) return;
    const userRole = await window.checkUserRole();
    if (!userRole) return;
    
    if (userRole === 'caregiver' || userRole === 'primary_caregiver') {
        const btn = document.getElementById("addHealthBtn");
        if (btn) btn.classList.remove("hidden");
    }
    
    firebase.auth().onAuthStateChanged((user) => {
        if (user) loadMedicalFeed(userRole);
    });
})();

function loadMedicalFeed(userRole) {
    const feed = document.getElementById("healthFeed");
    const criticalAlerts = document.getElementById("criticalAlerts");
    const criticalList = document.getElementById("criticalList");
    const criticalCount = document.getElementById("criticalCount");
    const visitsTodayEl = document.getElementById("visitsToday");
    const checkupsDueEl = document.getElementById("checkupsDue");

    window.healthService.listenRecent(async (records) => {
        feed.innerHTML = "";
        
        const todayStr = new Date().toISOString().split('T')[0];
        let todayCount = 0;
        let criticalElders = new Map(); // Map to keep latest high reading per elder

        // Get total elders for "Due" calculation
        const allElders = await window.elderService.getAll();
        const eldersWithRecentLog = new Set();
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        records.forEach(r => {
            // Count Today's Visits
            if (r.date === todayStr) todayCount++;

            // Track Recent Activity (Last 48h)
            const recordDate = new Date(r.date);
            if (recordDate >= twoDaysAgo) {
                eldersWithRecentLog.add(r.elderId);
            }

            // Check for Critical BP (Ignore if already acknowledged)
            if (r.bp && r.bp.includes('/') && !r.acknowledged) {
                const [sys, dia] = r.bp.split('/').map(Number);
                if (sys >= 140 || dia >= 90) {
                    if (!criticalElders.has(r.elderId)) {
                        criticalElders.set(r.elderId, { name: r.elderName, bp: r.bp, recordId: r.id });
                    }
                }
            }
        });

        // 1. Update Critical Alert Box
        if (criticalElders.size > 0) {
            criticalAlerts.classList.remove('hidden');
            criticalCount.innerText = criticalElders.size;
            criticalList.innerHTML = Array.from(criticalElders.values()).map(e => `
                <div class="flex justify-between items-center bg-white/10 p-2 rounded-lg text-sm mb-2">
                    <span class="font-bold">${e.name}</span>
                    <div class="flex items-center gap-2">
                        <span class="badge bg-white text-danger">${e.bp}</span>
                        <button onclick="acknowledgeAlert('${e.recordId}')" class="text-white hover:text-green-300 transition-colors" title="Mark as Handled">
                            <i class="fas fa-check-circle text-lg"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            criticalAlerts.classList.add('hidden');
        }

        // 2. Update Pulse Stats
        if (visitsTodayEl) visitsTodayEl.innerText = todayCount;
        if (checkupsDueEl) checkupsDueEl.innerText = Math.max(0, allElders.length - eldersWithRecentLog.size);

        // 3. Update Medication Adherence
        updateAdherenceChart();

        // --- Render Feed Cards ---
        records.forEach((data, index) => {
            const dateStr = new Date(data.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
            const delay = (index * 0.1).toFixed(1);
            
            // Highlight High BP
            let bpStatusClass = "";
            if (data.bp && data.bp.includes('/')) {
                const [sys, dia] = data.bp.split('/').map(Number);
                if (sys > 140 || dia > 90) bpStatusClass = "high-bp-pulse";
            }

            const card = `
                <div class="card p-6 animate__animated animate__fadeInUp" style="animation-delay: ${delay}s; position:relative; overflow:hidden;">
                    <div class="clinical-event-bar"></div>
                    
                    <div class="flex justify-between items-start mb-5">
                        <div class="flex items-center gap-4">
                            <div class="elder-mini-avatar" onclick="window.location.href='view_profile.html?id=${data.elderId}'">
                                ${data.elderName ? data.elderName[0] : '?'}
                            </div>
                            <div>
                                <h4 class="font-bold text-dark text-lg hover:text-primary cursor-pointer transition-colors" 
                                    onclick="window.location.href='view_profile.html?id=${data.elderId}'">
                                    ${data.elderName || 'Unknown Patient'}
                                </h4>
                                <p class="text-xs text-muted font-bold uppercase tracking-widest">
                                    <i class="fas fa-clinic-medical mr-1"></i> ${data.location || 'Clinic Visit'}
                                </p>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] font-bold text-muted uppercase tracking-tighter block">${dateStr}</span>
                            <span class="badge badge-success mt-1" style="font-size:9px;">Logged by Team</span>
                        </div>
                    </div>

                    <div class="grid grid-3 gap-6 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 mb-5">
                        <div class="text-center">
                            <p class="text-[10px] text-muted uppercase font-bold mb-1">Blood Pressure</p>
                            <div class="text-xl font-bold text-primary ${bpStatusClass}">${data.bp || '--/--'}</div>
                        </div>
                        <div class="text-center border-x border-gray-200">
                            <p class="text-[10px] text-muted uppercase font-bold mb-1">Heart Rate</p>
                            <div class="text-xl font-bold text-secondary">${data.hr || '--'} <span class="text-xs opacity-50">bpm</span></div>
                        </div>
                        <div class="text-center">
                            <p class="text-[10px] text-muted uppercase font-bold mb-1">Weight</p>
                            <div class="text-xl font-bold text-dark">${data.weight || '--'} <span class="text-xs opacity-50">kg</span></div>
                        </div>
                    </div>

                    <div class="flex justify-between items-end">
                        <div style="flex:1;">
                            <p class="text-xs text-muted font-bold uppercase mb-2">Doctor's Observations</p>
                            <p class="text-sm text-dark italic opacity-80 line-clamp-2">"${data.notes || 'No specific notes recorded for this visit.'}"</p>
                        </div>
                        ${(userRole === 'caregiver' || userRole === 'primary_caregiver') ? `
                            <button onclick="deleteHealthRecord('${data.id}')" class="btn-icon-hover text-danger ml-4">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            feed.innerHTML += card;
        });
    });
}

let adherenceChartInstance = null;

async function updateAdherenceChart() {
    const ctx = document.getElementById('adherenceChart');
    if (!ctx) return;

    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const dayIndex = new Date().getDay();

        const [meds, logs] = await Promise.all([
            window.medicationService.getAll(),
            window.medicationService.getLogsByDate(todayStr)
        ]);

        // Calculate Total Scheduled for Today
        const scheduledToday = meds.filter(m => {
            if (m.startDate && todayStr < m.startDate) return false;
            if (m.frequency === 'daily') return true;
            if (m.frequency === 'specific' && m.days && m.days.includes(dayIndex)) return true;
            return false;
        });

        const totalScheduled = scheduledToday.length;
        const totalTaken = Object.keys(logs).length;
        const percent = totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 100;

        document.getElementById("adherencePercent").innerText = `${percent}%`;

        if (adherenceChartInstance) adherenceChartInstance.destroy();

        adherenceChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Taken', 'Pending'],
                datasets: [{
                    data: [totalTaken, Math.max(0, totalScheduled - totalTaken)],
                    backgroundColor: ['#4A6351', '#f1f5f9'],
                    borderWidth: 0,
                    cutout: '80%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    } catch (error) {
        console.error("Adherence calculation failed:", error);
    }
}

// ... MODAL & DELETE LOGIC (Same as previous but with improved services calls) ...
window.loadElderOptions = async function () {
    const select = document.getElementById("visitElder");
    if(!select) return;
    const elders = await window.elderService.getAll();
    select.innerHTML = elders.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
};

window.openHealthModal = function () {
    document.getElementById("healthModal").style.display = "flex";
    const todayStr = new Date().toISOString().split('T')[0];
    const visitDateInput = document.getElementById("visitDate");
    visitDateInput.max = todayStr;
    visitDateInput.value = todayStr;
    loadElderOptions();
};
window.closeHealthModal = function () { document.getElementById("healthModal").style.display = "none"; };

window.deleteHealthRecord = async function (id) {
    if (confirm("Delete this medical record from the master log?")) {
        await window.healthService.delete(id);
    }
};

window.acknowledgeAlert = async function (recordId) {
    try {
        await firebase.firestore().collection("health_records").doc(recordId).update({
            acknowledged: true,
            acknowledgedAt: firebase.firestore.FieldValue.serverTimestamp(),
            acknowledgedBy: firebase.auth().currentUser.email
        });
        showToast("Clinical Alert", "Record marked as handled", "success");
    } catch (error) {
        console.error("Acknowledgment failed:", error);
        showToast("Error", "Could not acknowledge alert", "error");
    }
};

const healthForm = document.getElementById("healthForm");
if (healthForm) {
    healthForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const role = localStorage.getItem('userRole');
        if (role !== 'caregiver' && role !== 'primary_caregiver') return;

        const visitDateStr = document.getElementById("visitDate").value;
        const todayStr = new Date().toISOString().split('T')[0];
        if (visitDateStr > todayStr) {
            showToast("Error", "Cannot log a visit for a future date.", "error");
            return;
        }

        const elderSelect = document.getElementById("visitElder");
        const visitData = {
            date: visitDateStr,
            location: document.getElementById("visitLocation").value.trim(),
            bp: document.getElementById("visitBP").value.trim(),
            hr: document.getElementById("visitHR").value,
            weight: document.getElementById("visitWeight").value,
            notes: document.getElementById("visitNotes").value.trim(),
            elderId: elderSelect.value,
            elderName: elderSelect.options[elderSelect.selectedIndex].text
        };

        try {
            await window.healthService.logVisit(visitData);
            showToast("Success", "Medical record added to feed", "success");
            closeHealthModal();
        } catch (error) { showToast("Error", "Save failed", "error"); }
    });
}