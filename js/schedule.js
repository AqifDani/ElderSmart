// js/schedule.js - TASKIE LAYOUT + REAL PROGRESS

(async () => {
    if (!window.appointmentService) return;
    const userRole = await window.checkUserRole();
    if (!userRole) return;
    loadAppointmentLogistics(userRole);
})();

async function loadAppointmentLogistics(userRole) {
    const grid = document.getElementById("scheduleGrid");
    const nextTime = document.getElementById("nextApptTime");
    const nextTitle = document.getElementById("nextApptTitle");
    const nextDriver = document.getElementById("nextApptDriver");
    
    // Stats Elements
    const statOpen = document.getElementById("statOpenCount");
    const statTotal = document.getElementById("statTotalShifts");
    const statTopName = document.getElementById("statTopWorker");
    const topAvatar = document.getElementById("topWorkerAvatar");

    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const familyId = currentUser.familyId;

        const [usersSnap, appointments] = await Promise.all([
            firebase.firestore().collection("users").where("familyId", "==", familyId).get(),
            window.appointmentService.getUpcoming()
        ]);

        // 1. Logic: Workload & Unassigned
        const workload = {};
        let unassignedCount = 0;

        usersSnap.forEach(doc => { if (doc.data().role !== 'elder') workload[doc.data().name] = 0; });
        appointments.forEach(appt => {
            if (appt.assignedToName) workload[appt.assignedToName] = (workload[appt.assignedToName] || 0) + 1;
            else unassignedCount++;
        });

        // Sort Workers
        const sortedWorkers = Object.entries(workload).sort((a, b) => b[1] - a[1]);
        const topName = sortedWorkers.length > 0 && sortedWorkers[0][1] > 0 ? sortedWorkers[0][0] : "None";
        const leastBusyName = sortedWorkers.length > 0 ? sortedWorkers[sortedWorkers.length - 1][0] : "Anyone";

        // Update Stats UI
        if(statOpen) statOpen.innerText = unassignedCount;
        if(statTotal) statTotal.innerText = appointments.length;
        if(statTopName) statTopName.innerText = topName;
        
        // Render Workload List
        const listContainer = document.getElementById("workloadList");
        if (listContainer) {
            listContainer.innerHTML = "";
            const maxShifts = Math.max(...Object.values(workload), 1);
            
            sortedWorkers.forEach(([name, count]) => {
                const percent = (count / maxShifts) * 100;
                const isLeastBusy = (name === leastBusyName && count < maxShifts);
                const barColor = isLeastBusy ? 'var(--secondary)' : 'var(--primary)';
                
                listContainer.innerHTML += `
                    <div class="workload-item">
                        <div class="workload-info">
                            <div class="workload-name">
                                ${name}
                                ${isLeastBusy ? '<span class="fairness-badge">Suggested</span>' : ''}
                            </div>
                            <div class="workload-bar-bg">
                                <div class="workload-bar-fill" style="width: ${percent}%; background: ${barColor};"></div>
                            </div>
                        </div>
                        <div class="workload-count">${count} Shifts</div>
                    </div>`;
            });
        }

        // Update Top Performer Bar
        const topBar = document.getElementById("topWorkerBar");
        if (topBar && sortedWorkers.length > 0) {
            const topPercent = (sortedWorkers[0][1] / appointments.length) * 100;
            topBar.style.width = `${topPercent}%`;
        }

        // 2. Next Task Logic
        if (appointments.length === 0) {
            grid.innerHTML = `<div class="text-center p-8 text-muted">No visits scheduled.</div>`;
            return;
        }

        const firstAppt = appointments[0];
        const nextDate = new Date(firstAppt.date);
        
        if(nextTime) nextTime.innerText = nextDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        if(nextTitle) nextTitle.innerText = firstAppt.title;
        if(nextDriver) nextDriver.innerText = firstAppt.assignedToName || "Unassigned";

        // 3. Render List (Task Cards)
        grid.innerHTML = "";
        const dates = [...new Set(appointments.map(a => a.date.split('T')[0]))];

        dates.forEach(dStr => {
            const dayAppts = appointments.filter(a => a.date.startsWith(dStr));
            const dateDisplay = new Date(dStr).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

            // Date Header
            grid.innerHTML += `<div class="text-xs font-bold text-muted uppercase mt-6 mb-3 ml-1">${dateDisplay}</div>`;

            dayAppts.forEach(a => {
                const isAssigned = a.assignedToName && a.assignedToName !== "";
                const time = new Date(a.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const cardClass = isAssigned ? "task-card assigned" : "task-card unassigned";
                
                // "Real" Feel: Calculate Progress
                // Assumption: A visit lasts 1 hour. If current time is past start, show 100%. If approaching, show 0%.
                // For a dynamic feel, we'll randomize 'Estimated Duration' visuals or use real time if it's today.
                let progressPercent = 0;
                const now = new Date();
                const apptTime = new Date(a.date);
                const oneHourLater = new Date(apptTime.getTime() + 60*60000);

                if (now > oneHourLater) progressPercent = 100;
                else if (now > apptTime) progressPercent = 50; // In progress
                
                // Color for progress bar
                const progressColor = isAssigned ? 'var(--primary)' : 'var(--danger)';
                const statusLabel = isAssigned ? "Scheduled" : "Pending";
                const statusClass = isAssigned ? "active" : "";

                let actionHtml = "";
                if (isAssigned) {
                    const initials = a.assignedToName.substring(0,2).toUpperCase();
                    const titleEsc = a.title.replace(/'/g, "\\'");
                    actionHtml = `
                        <div class="flex items-center gap-2">
                            <div class="driver-pill">
                                <div class="avatar-circle">${initials}</div>
                                <span class="hidden sm:inline">${a.assignedToName}</span>
                            </div>
                            <button onclick="openAssignModal('${a.id}', '${titleEsc}')" class="btn-mini-action" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                            <button onclick="openDropModal('${a.id}', '${titleEsc}')" class="btn-mini-action danger" title="Drop"><i class="fas fa-trash"></i></button>
                        </div>`;
                } else {
                    const titleEsc = a.title.replace(/'/g, "\\'");
                    actionHtml = `<button onclick="openAssignModal('${a.id}', '${titleEsc}')" class="btn-assign">Assign</button>`;
                }

                grid.innerHTML += `
                    <div class="${cardClass} animate__animated animate__fadeInUp">
                        <div class="task-bar"></div>
                        
                        <div style="flex:1;">
                            <div class="flex justify-between items-start mb-1">
                                <h4 class="font-bold text-sm text-dark">${a.title}</h4>
                                <span class="status-pill-task ${statusClass}">${statusLabel}</span>
                            </div>
                            
                            <div class="flex gap-4 text-xs text-muted mb-3">
                                <span><i class="far fa-clock"></i> ${time}</span>
                                <span><i class="fas fa-map-marker-alt"></i> ${a.location || 'Home'}</span>
                            </div>

                            <div class="flex items-center gap-2">
                                <span class="text-xs font-bold text-muted">Progress</span>
                                <div class="progress-track-sm">
                                    <div class="progress-fill-sm" style="width: ${progressPercent}%; background: ${progressColor};"></div>
                                </div>
                                <span class="text-xs text-muted">${progressPercent}%</span>
                            </div>
                        </div>

                        <div class="pl-4 border-l border-gray-100 flex items-center">
                            ${actionHtml}
                        </div>
                    </div>`;
            });
        });

    } catch (e) { console.error("Error:", e); }
}

// ==========================================
// ASSIGN MODAL
// ==========================================
let familyMembersCache = [];

window.openAssignModal = async function(apptId, title) {
    const modal = document.getElementById("assignModal");
    const select = document.getElementById("driverSelect");
    const recText = document.getElementById("suggestionText");
    const recName = document.getElementById("recName");
    const shiftName = document.getElementById("assignShiftName");
    const remarkBox = document.getElementById("assignRemark");
    
    document.getElementById("targetApptId").value = apptId;
    if (shiftName) shiftName.innerText = title || "Shift";
    if (remarkBox) remarkBox.value = "";

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    // 1. Load Caregivers if not cached
    if (familyMembersCache.length === 0) {
        select.innerHTML = '<option>Loading caregivers...</option>';
        try {
            const snap = await firebase.firestore().collection("users")
                .where("familyId", "==", currentUser.familyId).get();
            familyMembersCache = [];
            snap.forEach(doc => { if (doc.data().role !== 'elder') familyMembersCache.push({ name: doc.data().name, uid: doc.id }); });
        } catch(e){}
    }

    select.innerHTML = '<option value="">-- Select Caregiver --</option>';
    familyMembersCache.forEach(u => {
        const op = document.createElement("option");
        op.value = u.name; op.text = u.name; select.appendChild(op);
    });

    // 2. CALL THE STRICT FAIRNESS ENGINE
    // We need the date of this specific appointment to check availability
    try {
        if (recText) recText.classList.add("hidden");
        const apptDoc = await firebase.firestore().collection("appointments").doc(apptId).get();
        if (apptDoc.exists) {
            const dateStr = apptDoc.data().date.split('T')[0];
            const priorityResult = await window.scheduleService.calculateFairnessPriority(currentUser.familyId, dateStr);
            
            if (priorityResult) {
                select.value = priorityResult.name;
                if (recName) recName.innerText = priorityResult.name;
                if (recText) recText.classList.remove("hidden");
            }
        }
    } catch (e) { console.error("Fairness Suggestion Error:", e); }

    modal.style.display = "flex";
};

window.closeAssignModal = function() { document.getElementById("assignModal").style.display = "none"; };

window.confirmAssignment = async function() {
    const apptId = document.getElementById("targetApptId").value;
    const name = document.getElementById("driverSelect").value;
    const remark = document.getElementById("assignRemark").value.trim();
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    if (!name) return showToast("Missing", "Please select a caregiver.", "error");

    const updatePayload = {
        assignedToName: name,
        lastModifiedBy: currentUser.name,
        lastModifiedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (remark) updatePayload.lastRemark = remark;

    await firebase.firestore().collection("appointments").doc(apptId).update(updatePayload);
    if (window.showToast) showToast("Assigned", `Shift assigned to ${name}.`, "success");
    closeAssignModal();
    loadAppointmentLogistics();
};

// ==========================================
// DROP SHIFT MODAL
// ==========================================
window.openDropModal = function(apptId, title) {
    const modal = document.getElementById("dropModal");
    const shiftName = document.getElementById("dropShiftName");
    const remarkBox = document.getElementById("dropRemark");
    const errMsg = document.getElementById("dropRemarkError");
    
    document.getElementById("targetDropApptId").value = apptId;
    if (shiftName) shiftName.innerText = title || "Shift";
    if (remarkBox) remarkBox.value = "";
    if (errMsg) errMsg.classList.add("hidden");
    modal.style.display = "flex";
};

window.closeDropModal = function() { document.getElementById("dropModal").style.display = "none"; };

window.confirmDropShift = async function() {
    const apptId = document.getElementById("targetDropApptId").value;
    const remark = document.getElementById("dropRemark").value.trim();
    const errMsg = document.getElementById("dropRemarkError");
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    if (!remark) {
        if (errMsg) errMsg.classList.remove("hidden");
        return;
    }
    if (errMsg) errMsg.classList.add("hidden");

    await firebase.firestore().collection("appointments").doc(apptId).update({
        assignedToName: "",
        lastRemark: remark,
        lastModifiedBy: currentUser.name,
        lastModifiedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (window.showToast) showToast("Dropped", "Shift has been unassigned.", "error");
    closeDropModal();
    loadAppointmentLogistics();
};

// Legacy: keep dropShift as alias for backward compatibility
window.dropShift = function(apptId) { openDropModal(apptId, 'this shift'); };