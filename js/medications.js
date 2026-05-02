// js/medications.js - REFACTORED (Clean CSS Classes)

let medTimePicker = null;
let historyPicker = null;
let currentViewDate = new Date().toISOString().split('T')[0];

(async () => {
    if (!window.medicationService || !window.elderService) return;
    const userRole = await window.checkUserRole();
    if (!userRole) return;

    if (userRole === 'caregiver') {
        const btn = document.getElementById("addMedBtn");
        if (btn) btn.classList.remove("hidden"); // Use class toggle
    }

    initPickers();
    initMedsListener();
    loadChecklist(currentViewDate);
})();

function initPickers() {
    medTimePicker = flatpickr("#medTime", {
        enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: false,
        defaultHour: 8, defaultMinute: 0
    });

    historyPicker = flatpickr("#historyDate", {
        defaultDate: "today", dateFormat: "Y-m-d", altInput: true, altFormat: "F j, Y",
        maxDate: new Date().fp_incr(30),
        onChange: function (selectedDates, dateStr) {
            currentViewDate = dateStr;
            updateScheduleTitle(selectedDates[0]);
            loadChecklist(dateStr);
        }
    });
}

function updateScheduleTitle(dateObj) {
    const title = document.getElementById("scheduleTitle");
    const todayStr = new Date().toDateString();
    title.innerText = (dateObj.toDateString() === todayStr) 
        ? "Today's Schedule" 
        : `Schedule for ${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function loadInventory(userRole) {
    // Inventory relies on the global meds listener
    // We just render it here
    renderInventory(userRole);
}

function renderInventory() {
    const list = document.getElementById("medsList");
    if (!list) return;

    const meds = currentMeds;
    
    list.innerHTML = "";

    if (meds.length === 0) {
        list.innerHTML = "<p class='text-muted'>No medications found.</p>";
        return;
    }

    // Clone array before sorting to avoid mutating global state constantly
    const sortedMeds = [...meds].sort((a, b) => a.time.localeCompare(b.time));

    sortedMeds.forEach(med => {
        // Find user role from DOM or global if needed, but since it's a global view we can check the Add Med btn
        const isCaregiver = !document.getElementById("addMedBtn").classList.contains("hidden");
        let actions = "";
        if (isCaregiver) {
                actions = `
                    <div style="margin-top:15px; padding-top:10px; border-top:1px solid #eee; display:flex; gap:10px;">
                        <button onclick="openMedModal('${med.id}')" class="text-link text-sm w-full">Edit</button>
                        <button onclick="deleteMed('${med.id}')" class="text-danger text-sm w-full">Delete</button>
                    </div>`;
            }

            let stockHtml = "";
            if (med.stock !== undefined) {
                if (med.stock < 5) stockHtml = `<span class="badge badge-stock-low">⚠ Low: ${med.stock}</span>`;
                else stockHtml = `<span class="badge badge-stock-ok">Stock: ${med.stock}</span>`;
            }

            const freqDisplay = med.frequency === 'specific'
                ? `<span class="text-xs text-muted">On: ${formatDays(med.days)}</span>`
                : `<span class="text-xs text-muted">Every Day</span>`;

            // ✅ CLEANER HTML STRUCTURE using new CSS classes
            list.innerHTML += `
                <div class="card card-primary">
                    <div class="flex justify-between items-center mb-2">
                        <h3 style="margin:0;">${med.name} <span class="text-sm text-muted">(${med.dosage})</span></h3>
                        <div class="text-right">
                            <div class="text-primary font-bold">${formatTime(med.time)}</div>
                            ${stockHtml}
                        </div>
                    </div>
                    <div class="text-sm text-muted">
                        👤 ${med.elderName} • 💊 Take ${med.perDose || 1}<br>
                        ${freqDisplay}
                    </div>
                    ${actions}
                </div>`;
    });
}

// ==========================================
// 2. CHECKLIST (Table Rows)
// ==========================================
let unsubscribeLogs = null;
let currentMeds = [];
let currentLogs = {};

// We attach one listener for meds that feeds both inventory and checklist
function initMedsListener() {
    window.medicationService.listenAll((meds) => {
        currentMeds = meds;
        renderInventory();
        if (currentViewDate) renderChecklist(currentViewDate);
    });
}

function loadChecklist(dateStr) {
    if (unsubscribeLogs) unsubscribeLogs();
    
    unsubscribeLogs = window.medicationService.listenLogsByDate(dateStr, (logs) => {
        currentLogs = logs;
        renderChecklist(dateStr);
    });
}

function renderChecklist(dateStr) {
    const tableBody = document.getElementById("checklistBody");
    if (!tableBody) return;
    
    if (currentMeds.length === 0 && Object.keys(currentLogs).length === 0) {
        tableBody.innerHTML = "<tr><td colspan='6' class='text-center p-4 text-muted'>Loading...</td></tr>";
        // Wait for listeners to fire
        return;
    }

    const meds = currentMeds;
    const logs = currentLogs;

        const [y, m, d] = dateStr.split('-').map(Number);
        const targetDate = new Date(y, m - 1, d);
        const dayIndex = targetDate.getDay();
        const todayStr = new Date().toISOString().split('T')[0];
        const isFuture = dateStr > todayStr;

        tableBody.innerHTML = "";

        const scheduledMeds = meds.filter(m => {
            // FIX: Check if date is before start date
            if (m.startDate && dateStr < m.startDate) return false;

            if (m.frequency === 'daily') return true;
            if (m.frequency === 'specific' && m.days && m.days.includes(dayIndex)) return true;
            return false;
        });

        if (scheduledMeds.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='6' class='text-center p-4 text-muted'>No meds scheduled for this day.</td></tr>";
            return;
        }

        scheduledMeds.sort((a, b) => a.time.localeCompare(b.time));

        scheduledMeds.forEach(med => {
            const isTaken = logs[med.id]; 
            const qty = med.perDose || 1;

            let statusHtml, btnHtml, rowClass = "";

            if (isTaken) {
                statusHtml = `<span class="status-taken">✔ Taken</span>`;
                btnHtml = `<span class="text-xs text-muted">Completed</span>`;
                rowClass = "row-taken"; // CSS class for green background
            } else {
                statusHtml = `<span class="status-missed">Pending</span>`;
                if (isFuture) {
                    btnHtml = `<button class="btn-xs btn-locked" disabled>Locked</button>`;
                } else {
                    btnHtml = `<button onclick="markTaken('${med.id}', '${med.name}', ${qty})" class="btn-xs btn-take">Take (${qty})</button>`;
                }
            }

            tableBody.innerHTML += `
                <tr class="${rowClass}">
                    <td>${statusHtml}</td>
                    <td>${formatTime(med.time)}</td>
                    <td><span class="badge" style="background:#eee; color:#333;">${med.elderName}</span></td>
                    <td class="font-bold">${med.name}</td>
                    <td>${med.dosage} <span class="text-xs text-muted">(x${qty})</span></td>
                    <td>${btnHtml}</td>
                </tr>`;
        });
}

// ... (Helpers: formatTime, formatDays remain the same) ...

window.toggleDaysSelector = function (val) {
    const el = document.getElementById("daysSelector");
    if (val === 'specific') el.classList.remove('hidden');
    else el.classList.add('hidden');
};

window.markTaken = async function (id, name, qtyToTake) {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    try {
        await window.medicationService.markAsTaken(id, name, user.name, currentViewDate);

        // Update Stock Logic
        const medRef = firebase.firestore().collection("medications").doc(id);
        const doc = await medRef.get();
        if (doc.exists) {
            const currentStock = doc.data().stock || 0;
            const newStock = Math.max(0, currentStock - qtyToTake);
            await medRef.update({ stock: newStock });
            
            if (newStock < 5 && window.showToast) {
                showToast("Low Stock", `Only ${newStock} left of ${name}!`, "error");
            }
        }
        loadChecklist(currentViewDate);
        loadInventory('caregiver');
    } catch (e) { console.error(e); }
};

window.openMedModal = async function (id = null) {
    const modal = document.getElementById("medModal");
    const saveBtn = document.getElementById("saveMedBtn");
    const title = document.getElementById("medModalTitle");
    const select = document.getElementById("medElder");

    select.innerHTML = "<option>Loading...</option>";
    const elders = await window.elderService.getAll();
    select.innerHTML = "";
    elders.forEach(e => { select.innerHTML += `<option value="${e.id}">${e.name}</option>`; });

    modal.style.display = "flex";

    if (id) {
        title.innerText = "Edit Medication";
        saveBtn.innerText = "Update Changes";
        document.getElementById("medId").value = id;
        const doc = await firebase.firestore().collection("medications").doc(id).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById("medName").value = data.name;
            document.getElementById("medDosage").value = data.dosage;
            document.getElementById("medNotes").value = data.notes || "";
            document.getElementById("medElder").value = data.elderId;
            document.getElementById("medStock").value = data.stock || "";
            document.getElementById("medPerDose").value = data.perDose || 1;
            if (medTimePicker && data.time) medTimePicker.setDate(data.time);
            document.getElementById("medFrequency").value = data.frequency || 'daily';
            
            // Handle Days Checkboxes
            document.querySelectorAll('input[name="weekDay"]').forEach(cb => cb.checked = false);
            if (data.frequency === 'specific') {
                document.getElementById("daysSelector").classList.remove('hidden');
                if (data.days) data.days.forEach(d => {
                    const cb = document.querySelector(`input[name="weekDay"][value="${d}"]`);
                    if (cb) cb.checked = true;
                });
            } else {
                document.getElementById("daysSelector").classList.add('hidden');
            }
        }
    } else {
        title.innerText = "Add New Medication";
        saveBtn.innerText = "Save Medication";
        document.getElementById("medForm").reset();
        document.getElementById("medId").value = "";
        document.getElementById("medPerDose").value = "1";
        document.getElementById("daysSelector").classList.add('hidden');
        if (medTimePicker) { medTimePicker.clear(); medTimePicker.setDate("08:00"); }
    }
};

window.closeMedModal = function () { document.getElementById("medModal").style.display = "none"; };

// Re-attach listener if form exists
const medForm = document.getElementById("medForm");
if (medForm) {
    medForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        
        const nameVal = document.getElementById("medName").value.trim();
        const dosageVal = document.getElementById("medDosage").value.trim();
        const timeVal = document.getElementById("medTime").value;
        const id = document.getElementById("medId").value;
        const elderSelect = document.getElementById("medElder");
        const freq = document.getElementById("medFrequency").value;

        let selectedDays = [];
        if (freq === 'specific') {
            document.querySelectorAll('input[name="weekDay"]:checked').forEach(cb => selectedDays.push(parseInt(cb.value)));
            if (selectedDays.length === 0) { alert("Select at least one day."); return; }
        }

        const data = {
            name: nameVal, dosage: dosageVal, time: timeVal, frequency: freq,
            days: (freq === 'specific') ? selectedDays : null,
            stock: parseInt(document.getElementById("medStock").value) || 0,
            perDose: parseInt(document.getElementById("medPerDose").value) || 1,
            notes: document.getElementById("medNotes").value.trim(),
            elderId: elderSelect.value,
            elderName: elderSelect.options[elderSelect.selectedIndex].text
        };

        // FIX: Add startDate for new meds so they don't appear in history
        if (!id) {
            data.startDate = new Date().toISOString().split('T')[0];
        }

        try {
            await window.medicationService.save(data, id || null);
            if(window.showToast) showToast("Success", "Medication Saved", "success");
            closeMedModal();
            loadInventory('caregiver');
            loadChecklist(currentViewDate);
        } catch(e) { alert(e.message); }
    });
}
window.deleteMed = function (id) {
    if (confirm("Delete this medication?")) {
        window.medicationService.delete(id).then(() => {
            loadInventory('caregiver');
            loadChecklist(currentViewDate);
        });
    }
};

function formatTime(t) {
    if (!t) return "--:--";
    const [h, m] = t.split(":");
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m} ${ampm}`;
}

function formatDays(daysArray) {
    if (!daysArray) return "";
    const map = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return daysArray.map(d => map[d]).join(", ");
}