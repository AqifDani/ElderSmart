// js/appointments.js - REFACTORED (Clean Classes)

let datePickerInstance = null;

(async () => {
    if (!window.appointmentService || !window.elderService || !window.scheduleService) return;
    const userRole = await window.checkUserRole();
    if (!userRole) return;

    if (userRole === 'caregiver') {
        const addBtn = document.getElementById("addApptBtn");
        if (addBtn) addBtn.classList.remove("hidden");
    }

    initDatePicker();
    loadAppointments(userRole);
})();

// ==========================================
// 1. FLATPICKR & SMART SCHEDULING
// ==========================================
function initDatePicker() {
    datePickerInstance = flatpickr("#apptDate", {
        enableTime: true, dateFormat: "Y-m-d\\TH:i", altInput: true, altFormat: "F j, Y at h:i K",
        minDate: "today", time_24hr: false,
        onChange: function (selectedDates, dateStr) { checkShiftAvailability(dateStr); }
    });
}

async function getLeastBusyCaregiver() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const familyId = currentUser.familyId;
        const usersSnap = await firebase.firestore().collection("users").where("familyId", "==", familyId).get();

        const workload = {};
        usersSnap.forEach(doc => {
            if (doc.data().role !== 'elder') workload[doc.data().name] = 0;
        });

        const appts = await window.appointmentService.getUpcoming();
        appts.forEach(a => {
            if (a.assignedToName) workload[a.assignedToName] = (workload[a.assignedToName] || 0) + 1;
        });

        const sorted = Object.entries(workload).sort((a, b) => a[1] - b[1]);
        return sorted.length > 0 ? sorted[0][0] : null;
    } catch (e) { return null; }
}
async function checkShiftAvailability(fullDateStr) {
    if (!fullDateStr) return;
    const assignedInput = document.getElementById("apptAssigned");
    const dateStr = fullDateStr.split("T")[0];
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    // Reset Classes
    assignedInput.className = ""; // clear all
    assignedInput.classList.add("input-loading");
    assignedInput.value = "Calculating...";

    try {
        const shifts = await window.scheduleService.getShifts(dateStr, dateStr);
        assignedInput.classList.remove("input-loading");

        if (shifts.length > 0) {
            const onDutyPerson = shifts[0].caregiver;
            assignedInput.value = onDutyPerson;
            assignedInput.classList.add("input-success"); // Green
            if(window.showToast) showToast("Smart Assign", `${onDutyPerson} is on shift.`, "success");
        } else {
            const fairName = await getLeastBusyCaregiver();
            if (fairName) {
                assignedInput.value = fairName;
                assignedInput.classList.add("input-warning"); // Yellow
                if(window.showToast) showToast("Fairness Engine", `${fairName} is most free.`, "default");
            } else {
                if (currentUser) assignedInput.value = currentUser.name;
                assignedInput.classList.add("input-auto"); // Blue
            }
        }
    } catch (error) {
        if (currentUser) assignedInput.value = currentUser.name;
        assignedInput.classList.add("input-auto");
    }
}

// ==========================================
// 2. LOAD & DISPLAY
// ==========================================
async function loadAppointments(userRole) {
    const tableBody = document.getElementById("apptTableBody");

    try {
        const appointments = await window.appointmentService.getUpcoming();
        tableBody.innerHTML = "";

        if (appointments.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='7' class='text-center p-4 text-muted'>No upcoming appointments found.</td></tr>";
            updateSummaryCard(null);
            document.getElementById("totalAppts").innerText = "0";
            return;
        }

        document.getElementById("totalAppts").innerText = appointments.length;

        let isFirst = true;
        appointments.sort((a, b) => {
            if (a.status === 'completed' && b.status !== 'completed') return 1;
            if (a.status !== 'completed' && b.status === 'completed') return -1;
            return new Date(a.date) - new Date(b.date);
        });

        appointments.forEach((data) => {
            const isCompleted = data.status === 'completed';

            if (isFirst && !isCompleted) {
                const dObj = new Date(data.date);
                updateSummaryCard(data, dObj.toLocaleDateString(), dObj.toLocaleTimeString());
                isFirst = false;
            }

            const dateObj = new Date(data.date);
            const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

            const elderDisplay = data.elderName || '--';
            const assignedBadge = data.assignedToName
                ? `<span class="badge" style="background:#e0f2fe; color:#0369a1;">👤 ${data.assignedToName}</span>`
                : `<span class="text-muted">--</span>`;

            // Action Buttons
            let actionButtons = "";
            if (isCompleted) {
                actionButtons = `<span class="text-success text-xs font-bold">✔ Done</span>`;
            } else if (userRole === 'caregiver') {
                actionButtons = `
                    <button onclick="completeAppt('${data.id}')" title="Mark Done" class="btn-icon text-success"><i class="fas fa-check-circle"></i></button>
                    <button onclick="openApptModal('${data.id}')" title="Edit" class="btn-icon text-muted"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteAppt('${data.id}')" title="Delete" class="btn-icon text-danger"><i class="fas fa-times"></i></button>
                `;
            } else {
                actionButtons = `<span class="text-muted text-xs">Locked</span>`;
            }

            const rowClass = isCompleted ? "row-completed" : "";
            const textClass = isCompleted ? "text-strike" : "";

            tableBody.innerHTML += `
                <tr class="${rowClass}">
                    <td class="${textClass}">
                        <strong>${dateStr}</strong><br> 
                        <span class="text-xs text-muted">${timeStr}</span>
                    </td>
                    <td class="${textClass}">${elderDisplay}</td>
                    <td class="${textClass}">${data.title}</td>
                    <td class="${textClass}">${data.doctor || "Not listed"}</td>
                    <td class="${textClass}">${assignedBadge}</td>
                    <td class="${textClass}">${data.location}</td>
                    <td>${actionButtons}</td>
                </tr>
            `;
        });

    } catch (error) { console.error("Error loading appointments:", error); }
}

function updateSummaryCard(data, dateStr, timeStr) {
    if (data) {
        document.getElementById("nextApptDate").innerHTML = `<span class="text-primary font-bold text-lg">${dateStr}</span> <span class="text-sm">at ${timeStr}</span>`;
        document.getElementById("nextApptDetails").innerText = `${data.title} - ${data.doctor || ''} (${data.elderName || 'Unknown'})`;
    } else {
        document.getElementById("nextApptDate").innerText = "No upcoming visits";
        document.getElementById("nextApptDetails").innerText = "--";
    }
}

// ... (Load Elder Options, Open/Close Modal - Standard) ...
async function loadElderOptions() {
    const select = document.getElementById("apptElder");
    select.innerHTML = '<option value="">Loading...</option>';
    try {
        const elders = await window.elderService.getAll();
        select.innerHTML = '';
        elders.forEach(e => {
            const op = document.createElement("option");
            op.value = e.id; op.text = e.name; select.appendChild(op);
        });
    } catch (e) { }
}

window.openApptModal = async function (id = null) {
    document.getElementById("apptModal").style.display = "flex";
    await loadElderOptions();
    if (id) {
        const doc = await firebase.firestore().collection("appointments").doc(id).get();
        if (doc.exists) {
            const d = doc.data();
            document.getElementById("apptId").value = id;
            document.getElementById("apptTitle").value = d.title;
            document.getElementById("apptDoctor").value = d.doctor || "";
            document.getElementById("apptLocation").value = d.location;
            document.getElementById("apptNotes").value = d.notes;
            if (datePickerInstance) datePickerInstance.setDate(d.date);
            document.getElementById("apptAssigned").value = d.assignedToName;
            document.getElementById("apptElder").value = d.elderId;
        }
    } else {
        document.getElementById("apptForm").reset();
        document.getElementById("apptId").value = "";
        if (datePickerInstance) datePickerInstance.clear();
        const u = JSON.parse(localStorage.getItem('currentUser'));
        if (u) document.getElementById("apptAssigned").value = u.name;
    }
};

window.closeApptModal = function () { document.getElementById("apptModal").style.display = "none"; };

// ... (Delete and Complete Logic - Same as before) ...
window.deleteAppt = function (id) {
    if (confirm("Delete appointment?")) {
        window.appointmentService.delete(id).then(() => loadAppointments('caregiver'));
    }
};

window.completeAppt = function (id) {
    if (!confirm("Mark this appointment as completed?")) return;
    window.appointmentService.markComplete(id).then(() => {
        showToast("Success", "Appointment completed!", "success");
        loadAppointments('caregiver');
    });
};

// Form Submit
const apptForm = document.getElementById("apptForm");
if (apptForm) {
    apptForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const id = document.getElementById("apptId").value;
        const elderSelect = document.getElementById("apptElder");
        const assignedName = document.getElementById("apptAssigned").value;
        const title = document.getElementById("apptTitle").value;
        const currentUser = firebase.auth().currentUser;

        const apptData = {
            date: document.getElementById("apptDate").value,
            title: title,
            doctor: document.getElementById("apptDoctor").value,
            location: document.getElementById("apptLocation").value,
            notes: document.getElementById("apptNotes").value,
            assignedToName: assignedName,
            elderId: elderSelect.value,
            elderName: elderSelect.options[elderSelect.selectedIndex].text,
            loggedBy: currentUser.email
        };

        try {
            await window.appointmentService.save(apptData, id || null);
            // Notify Logic
            if (assignedName) {
                const myFamilyId = JSON.parse(localStorage.getItem('currentUser')).familyId;
                const userSnap = await firebase.firestore().collection("users")
                    .where("familyId", "==", myFamilyId).where("name", "==", assignedName).get();

                if (!userSnap.empty && userSnap.docs[0].id !== currentUser.uid) {
                    await window.notificationService.save({
                        recipientId: userSnap.docs[0].id,
                        title: "New Appointment",
                        message: `You have been assigned to: ${title}`,
                        type: "urgent", isRead: false
                    });
                }
            }
            showToast("Success", "Appointment saved!", "success");
            closeApptModal();
            loadAppointments('caregiver');
        } catch (error) { showToast("Error", "Could not save", "error"); }
    });
}