// js/appointments.js - REFACTORED (Clean Classes)

// Función auxiliar para escapar caracteres HTML y mitigar ataques de Cross-Site Scripting (XSS).
// Convierte caracteres especiales en sus entidades HTML correspondientes antes del renderizado.
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

let datePickerInstance = null;

(async () => {
    if (!window.appointmentService || !window.elderService || !window.scheduleService) return;
    const userRole = await window.checkUserRole();
    if (!userRole) return;

    if (userRole === 'caregiver' || userRole === 'primary_caregiver') {
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

async function checkShiftAvailability(fullDateStr) {
    if (!fullDateStr) return;
    const assignedInput = document.getElementById("apptAssigned");
    const dateStr = fullDateStr.split("T")[0];
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    // Agregamos una clase css visual para indicar cálculo en curso sin destruir las opciones cargadas
    assignedInput.classList.add("input-loading");

    try {
        const shifts = await window.scheduleService.getShifts(dateStr, dateStr);
        assignedInput.classList.remove("input-loading");

        if (shifts.length > 0) {
            const onDutyPerson = shifts[0].caregiver;
            const found = selectOptionByName(assignedInput, onDutyPerson);
            assignedInput.className = "input-success";
            if (window.showToast) {
                if (found) {
                    showToast("Smart Assign", `${onDutyPerson} is on shift.`, "success");
                } else {
                    showToast("Smart Assign", `${onDutyPerson} is on shift, but option not found.`, "warning");
                }
            }
        } else {
            // Consultamos al Fairness Engine v3 para obtener el cuidador con menor carga de trabajo
            const priorityResult = await window.scheduleService.getLeastBusyCaregiver(currentUser.familyId);

            if (priorityResult) {
                assignedInput.value = priorityResult.uid;
                assignedInput.className = "input-warning";
                // Mostramos una alerta informativa detallando la carga de trabajo efectiva (completados más pendientes) para evitar confusión al usuario
                if (window.showToast) showToast("Fairness Engine", `${priorityResult.name} is prioritized (Workload: ${priorityResult.effectiveWorkload} shifts - ${priorityResult.totalShiftsCompleted} completed, ${priorityResult.pendingShifts} pending).`, "default");
            } else {
                // En caso de que no haya otros cuidadores, se asigna por defecto al usuario actual
                if (currentUser) assignedInput.value = currentUser.uid;
                assignedInput.className = "input-auto";
                if (window.showToast) showToast("Notice", "No available caregivers found. Self-assigning.", "default");
            }
        }
    } catch (error) {
        console.error("Shift Check Error:", error);
        assignedInput.classList.remove("input-loading");
        if (currentUser) assignedInput.value = currentUser.uid;
        assignedInput.className = "input-auto";
    }
}

// ==========================================
// 2. LOAD & DISPLAY
// ==========================================
function loadAppointments(userRole) {
    const tableBody = document.getElementById("apptTableBody");

    window.appointmentService.listenUpcoming((allAppointments) => {
        tableBody.innerHTML = "";

        // RBAC: Elders only see their own appointments
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const appointments = userRole === 'elder'
            ? allAppointments.filter(a => a.elderId === currentUser.uid)
            : allAppointments;

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

            const safeAssignedName = escapeHTML(data.assignedToName);
            const elderDisplay = escapeHTML(data.elderName || '--');
            const assignedBadge = data.assignedToName
                ? `<span class="badge" style="background:#e0f2fe; color:#0369a1;">👤 ${safeAssignedName}</span>`
                : `<span class="text-muted">--</span>`;

            // Action Buttons
            let actionButtons = "";
            if (isCompleted) {
                actionButtons = `<span class="text-success text-xs font-bold">✔ Done</span>`;
            } else if (userRole === 'caregiver' || userRole === 'primary_caregiver') {
                const safeDataId = escapeHTML(data.id);
                actionButtons = `
                    <button onclick="completeAppt('${safeDataId}')" title="Mark Done" class="btn-icon text-success"><i class="fas fa-check-circle"></i></button>
                    <button onclick="openApptModal('${safeDataId}')" title="Edit" class="btn-icon text-muted"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteAppt('${safeDataId}')" title="Delete" class="btn-icon text-danger"><i class="fas fa-times"></i></button>
                `;
            } else {
                actionButtons = `<span class="text-muted text-xs">Locked</span>`;
            }

            const rowClass = isCompleted ? "row-completed" : "";
            const textClass = isCompleted ? "text-strike" : "";

            const safeReminderOffset = escapeHTML(data.reminderOffset);
            const reminderIcon = (data.reminderOffset && data.reminderOffset !== "none" && data.reminderOffset !== "0")
                ? `<i class="fas fa-bell text-warning animate__animated animate__swing animate__infinite" style="font-size:10px; margin-left:4px;" title="Alert set for ${safeReminderOffset}m before"></i>`
                : "";

            const safeTitle = escapeHTML(data.title);
            const safeDoctor = escapeHTML(data.doctor || "Not listed");
            const safeLocation = escapeHTML(data.location);

            tableBody.innerHTML += `
                <tr class="${rowClass}">
                    <td class="${textClass}">
                        <strong>${dateStr}</strong><br> 
                        <span class="text-xs text-muted">${timeStr}</span> ${reminderIcon}
                    </td>
                    <td class="${textClass}">${elderDisplay}</td>
                    <td class="${textClass}">${safeTitle}</td>
                    <td class="${textClass}">${safeDoctor}</td>
                    <td class="${textClass}">${assignedBadge}</td>
                    <td class="${textClass}">${safeLocation}</td>
                    <td>${actionButtons}</td>
                </tr>
            `;
        });
    });
}

function updateSummaryCard(data, dateStr, timeStr) {
    if (data) {
        // Reemplazamos innerHTML con la creación manual de nodos DOM para asegurar que no haya vectores de XSS
        const nextApptDateEl = document.getElementById("nextApptDate");
        nextApptDateEl.innerHTML = "";
        
        const dateSpan = document.createElement("span");
        dateSpan.className = "text-primary font-bold text-lg";
        dateSpan.textContent = dateStr;
        
        const timeSpan = document.createElement("span");
        timeSpan.className = "text-sm";
        timeSpan.textContent = ` at ${timeStr}`;
        
        nextApptDateEl.appendChild(dateSpan);
        nextApptDateEl.appendChild(timeSpan);

        document.getElementById("nextApptDetails").innerText = `${data.title} - ${data.doctor || ''} (${data.elderName || 'Unknown'})`;
    } else {
        document.getElementById("nextApptDate").innerText = "No upcoming visits";
        document.getElementById("nextApptDetails").innerText = "--";
    }
}

// ... (Load Elder Options, Open/Close Modal - Standard) ...
// Busca y selecciona una opción en un elemento select basándose en el texto que se muestra en lugar de su valor
function selectOptionByName(selectElement, name) {
    if (!name) return false;
    for (let i = 0; i < selectElement.options.length; i++) {
        if (selectElement.options[i].text.toLowerCase() === name.toLowerCase()) {
            selectElement.selectedIndex = i;
            return true;
        }
    }
    return false;
}

// Carga de forma dinámica los cuidadores de la familia activa para poblar el dropdown de asignación
async function loadCaregiverOptions() {
    const select = document.getElementById("apptAssigned");
    select.innerHTML = '<option value="">Loading caregivers...</option>';
    try {
        const caregivers = await window.elderService.getCaregivers();
        select.innerHTML = '<option value="">-- Select Caregiver --</option>';
        caregivers.forEach(c => {
            const op = document.createElement("option");
            op.value = c.id;
            op.text = c.name;
            select.appendChild(op);
        });
    } catch (e) {
        console.error("Error loading caregivers:", e);
        select.innerHTML = '<option value="">Failed to load caregivers</option>';
    }
}

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
    const role = localStorage.getItem('userRole');
    if (role !== 'caregiver' && role !== 'primary_caregiver') return;
    document.getElementById("apptModal").style.display = "flex";
    
    // Cargamos tanto los adultos mayores como los cuidadores en paralelo para evitar retrasos de red secuenciales
    await Promise.all([loadElderOptions(), loadCaregiverOptions()]);
    
    const assignedInput = document.getElementById("apptAssigned");
    
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
            
            // Asigna de forma segura el valor al select utilizando el ID del cuidador asignado, con respaldo al nombre
            if (d.assignedToId) {
                assignedInput.value = d.assignedToId;
            } else if (d.assignedToName) {
                const found = selectOptionByName(assignedInput, d.assignedToName);
                if (!found) {
                    assignedInput.value = "";
                }
            } else {
                assignedInput.value = "";
            }
            
            document.getElementById("apptElder").value = d.elderId;
            document.getElementById("apptReminder").value = d.reminderOffset || "0";
        }
    } else {
        document.getElementById("apptForm").reset();
        document.getElementById("apptId").value = "";
        if (datePickerInstance) datePickerInstance.clear();
        const u = JSON.parse(localStorage.getItem('currentUser'));
        if (u) {
            assignedInput.value = u.uid;
        }
        document.getElementById("apptReminder").value = "0";
    }
};

window.closeApptModal = function () { document.getElementById("apptModal").style.display = "none"; };

// --- Confirmation Modal Logic ---
window.showConfirmModal = function ({ title, message, iconClass, wrapperClass, btnText, btnClass, onConfirm }) {
    const modal = document.getElementById("confirmModal");
    document.getElementById("confirmTitle").innerText = title;
    document.getElementById("confirmMessage").innerText = message;

    // Evitamos el uso de innerHTML para prevenir cualquier inyección a través de clases de iconos dinámicas
    const iconWrapper = document.getElementById("confirmIconWrapper");
    iconWrapper.innerHTML = "";
    const iconEl = document.createElement("i");
    iconEl.className = iconClass;
    iconWrapper.appendChild(iconEl);

    iconWrapper.className = `confirm-icon-wrapper mb-6 ${wrapperClass}`;

    const actionBtn = document.getElementById("confirmActionBtn");
    actionBtn.innerText = btnText;
    actionBtn.className = `btn-primary w-full ${btnClass}`;

    actionBtn.onclick = () => {
        onConfirm();
        closeConfirmModal();
    };

    modal.style.display = "flex";
};

window.closeConfirmModal = function () {
    document.getElementById("confirmModal").style.display = "none";
};

// ... (Delete and Complete Logic - Refactored for Custom Modal) ...
window.deleteAppt = function (id) {
    const role = localStorage.getItem('userRole');
    if (role !== 'caregiver' && role !== 'primary_caregiver') return;

    showConfirmModal({
        title: "Delete Appointment?",
        message: "Are you sure you want to remove this schedule? This action cannot be reversed.",
        iconClass: "fas fa-trash-alt",
        wrapperClass: "danger",
        btnText: "Delete Permanently",
        btnClass: "bg-danger",
        onConfirm: () => {
            window.appointmentService.delete(id).then(() => {
                showToast("Success", "Appointment deleted", "success");
                loadAppointments('caregiver');
            });
        }
    });
};

window.completeAppt = function (id) {
    const role = localStorage.getItem('userRole');
    if (role !== 'caregiver' && role !== 'primary_caregiver') return;

    showConfirmModal({
        title: "Complete Visit?",
        message: "Mark this appointment as successfully completed? This will update the elder's timeline.",
        iconClass: "fas fa-check-circle",
        wrapperClass: "success",
        btnText: "Confirm Completion",
        btnClass: "bg-success",
        onConfirm: async () => {
            try {
                // Resolve assigned caregiver UID from appointment document
                const apptDoc = await firebase.firestore().collection('appointments').doc(id).get();
                const apptData = apptDoc.exists ? apptDoc.data() : null;
                const currentUser = JSON.parse(localStorage.getItem('currentUser'));

                // Use assigned UID if exists, otherwise use current user UID
                const caregiverUid = (apptData && apptData.assignedToId) ? apptData.assignedToId : currentUser.uid;

                await window.appointmentService.markShiftCompleted(id, caregiverUid);
                showToast("Success", "Appointment completed!", "success");
                loadAppointments('caregiver');
            } catch (error) {
                console.error('Complete appointment error:', error);
                showToast("Error", "Could not complete appointment.", "error");
            }
        }
    });
};

// Manejo del envío del formulario de citas para persistir de forma atómica los datos en Firestore
const apptForm = document.getElementById("apptForm");
if (apptForm) {
    apptForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const role = localStorage.getItem('userRole');
        if (role !== 'caregiver' && role !== 'primary_caregiver') return;
        const id = document.getElementById("apptId").value;
        const elderSelect = document.getElementById("apptElder");
        const assignedSelect = document.getElementById("apptAssigned");
        const title = document.getElementById("apptTitle").value;
        const currentUser = firebase.auth().currentUser;

        // Resolvemos de forma sincrónica el ID y el nombre del cuidador desde las opciones del elemento select
        const assignedToId = assignedSelect.value || null;
        const assignedToName = (assignedSelect.selectedIndex >= 0 && assignedSelect.value) ? assignedSelect.options.item(assignedSelect.selectedIndex).text : "";

        const apptData = {
            date: document.getElementById("apptDate").value,
            title: title,
            doctor: document.getElementById("apptDoctor").value,
            location: document.getElementById("apptLocation").value,
            notes: document.getElementById("apptNotes").value,
            assignedToName: assignedToName,
            assignedToId: assignedToId,
            elderId: elderSelect.value,
            // Usamos .item() para evitar la advertencia de notación de corchetes dinámicos
            elderName: elderSelect.selectedIndex >= 0 ? elderSelect.options.item(elderSelect.selectedIndex).text : "",
            loggedBy: currentUser.email,
            reminderOffset: document.getElementById("apptReminder").value
        };

        try {
            await window.appointmentService.save(apptData, id || null);
            if (assignedToId && assignedToId !== currentUser.uid) {
                await window.notificationService.save({
                    recipientId: assignedToId,
                    title: "New Appointment",
                    message: `You have been assigned to: ${title}`,
                    type: "urgent", isRead: false
                });
            }
            showToast("Success", "Appointment saved!", "success");
            closeApptModal();
            loadAppointments('caregiver');
        } catch (error) { showToast("Error", "Could not save", "error"); }
    });
}