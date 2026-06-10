// js/schedule.js - TASKIE LAYOUT + REAL PROGRESS

let allAppointments = [];
let currentStatusFilter = 'all'; // 'all', 'pending', 'completed'
let currentAssigneeFilter = 'all'; // 'all', 'me'
let loggedInUser = null;
let cachedUserRole = null;
let filtersInitialized = false;

(async () => {
    if (!window.appointmentService) return;
    const userRole = await window.checkUserRole();
    if (!userRole) return;
    loadAppointmentLogistics(userRole);
})();

async function loadAppointmentLogistics(userRole) {
    cachedUserRole = userRole;
    const grid = document.getElementById("scheduleGrid");
    const nextTime = document.getElementById("nextApptTime");
    const nextTitle = document.getElementById("nextApptTitle");
    const nextDriver = document.getElementById("nextApptDriver");
    
    const statOpen = document.getElementById("statOpenCount");
    const statTotal = document.getElementById("statTotalShifts");
    const statTopName = document.getElementById("statTopWorker");

    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        loggedInUser = currentUser;
        const familyId = currentUser.familyId;

        const [usersSnap, appointments] = await Promise.all([
            firebase.firestore().collection("users").where("familyId", "==", familyId).get(),
            window.appointmentService.getUpcoming()
        ]);

        allAppointments = appointments;

        // 1. Logic: Workload & Unassigned
        const workload = {};
        let unassignedCount = 0;

        usersSnap.forEach(doc => { if (doc.data().role !== 'elder') workload[doc.data().name] = 0; });
        appointments.forEach(appt => {
            if (appt.assignedToName) workload[appt.assignedToName] = (workload[appt.assignedToName] || 0) + 1;
            else unassignedCount++;
        });

        const sortedWorkers = Object.entries(workload).sort((a, b) => b[1] - a[1]);
        const topName = sortedWorkers.length > 0 && sortedWorkers[0][1] > 0 ? sortedWorkers[0][0] : "None";
        const leastBusyName = sortedWorkers.length > 0 ? sortedWorkers[sortedWorkers.length - 1][0] : "Anyone";

        if(statOpen) statOpen.innerText = unassignedCount;
        if(statTotal) statTotal.innerText = appointments.length;
        if(statTopName) statTopName.innerText = topName;
        
        const listContainer = document.getElementById("workloadList");
        if (listContainer) {
            listContainer.innerHTML = "";
            const maxShifts = Math.max(...Object.values(workload), 1);
            
            sortedWorkers.forEach(([name, count]) => {
                const percent = (count / maxShifts) * 100;
                const isLeastBusy = (name === leastBusyName && count < maxShifts);
                const barColor = isLeastBusy ? 'var(--secondary)' : 'var(--primary)';
                
                const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                const rowClass = isLeastBusy ? 'workload-row suggested' : 'workload-row';
                
                listContainer.innerHTML += `
                    <div class="${rowClass}">
                        <div class="workload-avatar" style="background: ${isLeastBusy ? 'var(--secondary)' : 'var(--primary)'}">
                            ${initials}
                        </div>
                        <div class="workload-info">
                            <div class="workload-header">
                                <span class="workload-name">${name}</span>
                                <span class="workload-badge">${count} Shifts</span>
                            </div>
                            <div class="progress-track" style="height: 5px; margin-top: 0;">
                                <div class="progress-fill" style="width: ${percent}%; background: ${barColor};"></div>
                            </div>
                        </div>
                    </div>`;
            });
        }

        const topBar = document.getElementById("topWorkerBar");
        if (topBar && sortedWorkers.length > 0) {
            const topPercent = (sortedWorkers[0][1] / appointments.length) * 100;
            topBar.style.width = `${topPercent}%`;
        }

        // 2. Next Task Logic
        if (appointments.length === 0) {
            if(nextTime) nextTime.innerText = "--:--";
            if(nextTitle) nextTitle.innerText = "No upcoming tasks";
            if(nextDriver) nextDriver.innerText = "RELAX MODE";
            grid.innerHTML = `<div class="text-center p-8 text-muted">No visits scheduled.</div>`;
            return;
        }

        const firstAppt = appointments[0];
        const nextDate = new Date(firstAppt.date);
        
        if(nextTime) nextTime.innerText = nextDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        if(nextTitle) nextTitle.innerText = firstAppt.title;
        if(nextDriver) nextDriver.innerText = firstAppt.assignedToName || "Unassigned";

        // Setup filter handlers
        setupFilters();

        // 3. Render List (Task Cards)
        renderAppointmentsList();

    } catch (e) { console.error("Error:", e); }
}

function setupFilters() {
    if (filtersInitialized) return;

    const assigneeSelect = document.getElementById("assigneeFilterSelect");
    if (assigneeSelect) {
        assigneeSelect.addEventListener("change", (e) => {
            currentAssigneeFilter = e.target.value;
            renderAppointmentsList();
        });
    }

    const chips = document.querySelectorAll(".filter-chip");
    chips.forEach(chip => {
        chip.addEventListener("click", () => {
            chips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            
            const filterText = chip.textContent.trim().toLowerCase();
            currentStatusFilter = filterText;
            renderAppointmentsList();
        });
    });

    filtersInitialized = true;
}

function renderAppointmentsList() {
    const grid = document.getElementById("scheduleGrid");
    if (!grid) return;

    let filtered = allAppointments;

    // A. Apply Status Filter
    if (currentStatusFilter === 'pending') {
        filtered = filtered.filter(a => a.status !== 'completed');
    } else if (currentStatusFilter === 'completed') {
        filtered = filtered.filter(a => a.status === 'completed');
    }

    // B. Apply Assignee Filter
    if (currentAssigneeFilter === 'me') {
        filtered = filtered.filter(a => a.assignedToName === loggedInUser.name || a.assignedToId === loggedInUser.uid);
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="text-center p-12 text-muted">No tasks found matching current filters.</div>`;
        return;
    }

    grid.innerHTML = "";
    const dates = [...new Set(filtered.map(a => a.date.split('T')[0]))];

    dates.forEach(dStr => {
        const dayAppts = filtered.filter(a => a.date.startsWith(dStr));
        const dateDisplay = new Date(dStr).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

        grid.innerHTML += `<div class="text-xs font-bold text-muted uppercase mt-6 mb-3 ml-1">${dateDisplay}</div>`;

        dayAppts.forEach(a => {
            const isAssigned = a.assignedToName && a.assignedToName !== "";
            const time = new Date(a.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const cardClass = isAssigned ? "task-card assigned" : "task-card unassigned";
            
            const now = new Date();
            const apptTime = new Date(a.date);
            const oneHourLater = new Date(apptTime.getTime() + 60 * 60000);

            let timeStatusHtml = "";
            if (a.status === 'completed') {
                timeStatusHtml = `<span style="background: #e6f4ea; color: #137333; font-weight: 800; padding: 3px 10px; border-radius: 12px; font-size: 11px;">Completed</span>`;
            } else if (a.status === 'missed') {
                timeStatusHtml = `<span style="background: #fce8e6; color: #c5221f; font-weight: 800; padding: 3px 10px; border-radius: 12px; font-size: 11px;">Missed</span>`;
            } else if (now > oneHourLater) {
                timeStatusHtml = `<span style="background: #fffbeb; color: #b45309; font-weight: 800; padding: 3px 10px; border-radius: 12px; font-size: 11px;">Overdue</span>`;
            } else if (now >= apptTime && now <= oneHourLater) {
                timeStatusHtml = `<span style="background: #f0f9ff; color: #0369a1; font-weight: 800; padding: 3px 10px; border-radius: 12px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><span style="width:6px; height:6px; background:#0ea5e9; border-radius:50%; display:inline-block; animation: pulse 1.5s infinite;"></span>Active Now</span>`;
            } else {
                timeStatusHtml = `<span style="background: #f8fafc; color: #475569; font-weight: 800; padding: 3px 10px; border-radius: 12px; font-size: 11px;">Upcoming</span>`;
            }

            const statusLabel = isAssigned ? "Scheduled" : "Pending";
            const statusClass = isAssigned ? "active" : "";

            let actionHtml = "";
            const isPrimary = cachedUserRole === 'primary_caregiver';

            if (a.status === 'completed') {
                actionHtml = `<div class="flex items-center justify-center w-full"><span class="text-success text-xs font-bold">✔ Completed</span></div>`;
            } else if (isAssigned) {
                const initials = a.assignedToName.substring(0,2).toUpperCase();
                const titleEsc = a.title.replace(/'/g, "\\'");
                actionHtml = `
                    <div class="flex items-center gap-2">
                        <div class="driver-pill">
                            <div class="avatar-circle">${initials}</div>
                            <span>${a.assignedToName}</span>
                        </div>
                        <button onclick="openAssignModal('${a.id}', '${titleEsc}')" class="btn-mini-action" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                        ${isPrimary ? `<button onclick="openOverrideModal('${a.id}')" class="btn-mini-action" style="background:#1e293b; color:white;" title="Force Override"><i class="fas fa-shield-alt"></i></button>` : ''}
                        <button onclick="openDropModal('${a.id}', '${titleEsc}')" class="btn-mini-action danger" title="Drop"><i class="fas fa-trash"></i></button>
                    </div>`;
            } else {
                const titleEsc = a.title.replace(/'/g, "\\'");
                actionHtml = `
                    <div class="flex items-center gap-2">
                        <button onclick="openAssignModal('${a.id}', '${titleEsc}')" class="btn-assign">Assign</button>
                        ${isPrimary ? `<button onclick="openOverrideModal('${a.id}')" class="btn-mini-action" style="background:#1e293b; color:white;" title="Force Override"><i class="fas fa-shield-alt"></i></button>` : ''}
                    </div>
                `;
            }

            grid.innerHTML += `
                <div class="${cardClass} animate__animated animate__fadeInUp">
                    <div class="task-bar"></div>
                    
                    <div style="flex:1;">
                        <div class="flex items-center gap-3 mb-2">
                            <h4 class="font-bold text-md text-dark" style="margin: 0;">${a.title}</h4>
                            <span class="status-pill-task ${statusClass}" style="padding: 4px 8px; font-size: 10px; border-radius: 6px; line-height: 1;">${statusLabel}</span>
                        </div>
                        
                        <div class="flex gap-4 text-xs text-muted mb-4">
                            <span><i class="far fa-clock"></i> ${time}</span>
                            <span><i class="fas fa-map-marker-alt"></i> ${a.location || 'Home'}</span>
                            <span><i class="fas fa-user"></i> ${a.elderName || 'Elder'}</span>
                        </div>

                        <div class="flex items-center gap-2" style="margin-top: 4px;">
                            <span style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Schedule Status:</span>
                            ${timeStatusHtml}
                        </div>
                    </div>

                    <div class="pl-4 border-l border-gray-100 flex items-center">
                        ${actionHtml}
                    </div>
                </div>`;
        });
    });
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

    const apptDoc = await firebase.firestore().collection("appointments").doc(apptId).get();
    if (apptDoc.exists && apptDoc.data().status === 'completed') {
        if (window.showToast) showToast("Error", "Cannot assign a completed shift.", "error");
        closeAssignModal();
        return;
    }

    const updatePayload = {
        assignedToName: name,
        lastModifiedBy: currentUser.name,
        lastModifiedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (remark) updatePayload.lastRemark = remark;

    await firebase.firestore().collection("appointments").doc(apptId).update(updatePayload);
    if (window.showToast) showToast("Assigned", `Shift assigned to ${name}.`, "success");
    closeAssignModal();
    loadAppointmentLogistics(cachedUserRole);
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

    const apptDoc = await firebase.firestore().collection("appointments").doc(apptId).get();
    if (apptDoc.exists && apptDoc.data().status === 'completed') {
        if (window.showToast) showToast("Error", "Cannot drop a completed shift.", "error");
        closeDropModal();
        return;
    }

    await firebase.firestore().collection("appointments").doc(apptId).update({
        assignedToName: "",
        lastRemark: remark,
        lastModifiedBy: currentUser.name,
        lastModifiedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (window.showToast) showToast("Dropped", "Shift has been unassigned.", "error");
    closeDropModal();
    loadAppointmentLogistics(cachedUserRole);
};

// Legacy: keep dropShift as alias for backward compatibility
window.dropShift = function(apptId) { openDropModal(apptId, 'this shift'); };

// ==========================================
// ADMIN OVERRIDE LOGIC
// ==========================================
window.openOverrideModal = async function(apptId) {
    if (localStorage.getItem('userRole') !== 'primary_caregiver') return;

    const modal = document.getElementById("overrideModal");
    const select = document.getElementById("overrideDriverSelect");
    document.getElementById("overrideApptId").value = apptId;

    if (familyMembersCache.length === 0) {
        select.innerHTML = '<option>Loading...</option>';
        try {
            const currentUser = JSON.parse(localStorage.getItem('currentUser'));
            const snap = await firebase.firestore().collection("users")
                .where("familyId", "==", currentUser.familyId).get();
            familyMembersCache = [];
            snap.forEach(doc => { if (doc.data().role !== 'elder') familyMembersCache.push({ name: doc.data().name, uid: doc.id }); });
        } catch(e){}
    }

    select.innerHTML = '<option value="">-- Choose Caregiver --</option>';
    familyMembersCache.forEach(u => {
        const op = document.createElement("option");
        op.value = u.name; op.text = u.name; select.appendChild(op);
    });

    modal.style.display = "flex";
};

window.closeOverrideModal = function() { document.getElementById("overrideModal").style.display = "none"; };

window.confirmOverride = async function() {
    const apptId = document.getElementById("overrideApptId").value;
    const name = document.getElementById("overrideDriverSelect").value;
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    if (!name) return showToast("Required", "Select a caregiver to override.", "error");

    try {
        const apptDoc = await firebase.firestore().collection("appointments").doc(apptId).get();
        if (apptDoc.exists && apptDoc.data().status === 'completed') {
            if (window.showToast) showToast("Error", "Cannot override a completed shift.", "error");
            closeOverrideModal();
            return;
        }

        await firebase.firestore().collection("appointments").doc(apptId).update({
            assignedToName: name,
            lastModifiedBy: currentUser.name + " (Admin Override)",
            lastModifiedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (window.showToast) showToast("Override Successful", `Shift forcefully assigned to ${name}.`, "success");
        closeOverrideModal();
        loadAppointmentLogistics(currentUser.role);
    } catch (error) {
        console.error("Override Error:", error);
        showToast("Error", "Failed to override assignment.", "error");
    }
};