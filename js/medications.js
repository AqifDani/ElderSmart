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
    const isCaregiver = !document.getElementById("addMedBtn").classList.contains("hidden");

    // --- Update Stats Row ---
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayDow = new Date().getDay();
    let dueToday = 0, lowStock = 0;
    meds.forEach(med => {
        const isDaily = med.frequency !== 'specific';
        const isOnDay = med.frequency === 'specific' && med.days && med.days.includes(String(todayDow));
        if (isDaily || isOnDay) dueToday++;
        if (med.stock !== undefined && med.stock < 5) lowStock++;
    });
    const el = (id) => document.getElementById(id);
    if (el('statTotalMeds')) el('statTotalMeds').innerText = meds.length;
    if (el('statDueToday'))  el('statDueToday').innerText  = dueToday;
    if (el('statLowStock'))  el('statLowStock').innerText  = lowStock;
    if (el('medsCabinetCount')) el('medsCabinetCount').innerText = `${meds.length} medications`;
    if (el('statLowStockCard') && lowStock > 0) el('statLowStockCard').style.borderLeft = '4px solid var(--warning)';

    // --- Render Cards ---
    list.innerHTML = "";
    if (meds.length === 0) {
        list.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#9ca3af;">
            <i class="fas fa-pills" style="font-size:48px; margin-bottom:16px; opacity:0.3;"></i>
            <p style="font-size:15px; font-weight:600;">No medications in the cabinet yet.</p>
        </div>`;
        return;
    }

    const sortedMeds = [...meds].sort((a, b) => a.time.localeCompare(b.time));

    // Pill icon colors cycle
    const pillColors = [
        { bg: '#e0f2fe', color: '#0369a1' },
        { bg: '#dcfce7', color: '#166534' },
        { bg: '#fef9c3', color: '#854d0e' },
        { bg: '#fce7f3', color: '#9d174d' },
        { bg: '#ede9fe', color: '#5b21b6' },
    ];

    sortedMeds.forEach((med, i) => {
        const c = pillColors[i % pillColors.length];
        const freqDisplay = med.frequency === 'specific'
            ? `On: ${formatDays(med.days)}`
            : `Every Day`;

        const stockPercent = med.stock ? Math.min((med.stock / 30) * 100, 100) : 0;
        const isLow = med.stock !== undefined && med.stock < 5;
        const stockBarColor = isLow ? '#ef4444' : '#22c55e';
        const stockLabel = med.stock !== undefined ? `${med.stock} pills remaining` : 'Stock not tracked';

        const actionsHtml = isCaregiver ? `
            <div style="display:flex; gap:8px; margin-top:14px; padding-top:14px; border-top: 1px solid #f1f5f9;">
                <button onclick="openMedModal('${med.id}')" style="
                    flex:1; padding:8px; border-radius:10px; font-size:12px; font-weight:700;
                    border: 1.5px solid #d1d5db; background: white; color: #374151; cursor:pointer;
                    transition: all 0.2s;
                " onmouseenter="this.style.background='#f9fafb'" onmouseleave="this.style.background='white'">
                    <i class="fas fa-edit" style="margin-right:4px;"></i> Edit
                </button>
                <button onclick="deleteMed('${med.id}')" style="
                    flex:1; padding:8px; border-radius:10px; font-size:12px; font-weight:700;
                    border: 1.5px solid #fecaca; background: #fff1f2; color: #dc2626; cursor:pointer;
                    transition: all 0.2s;
                " onmouseenter="this.style.background='#fee2e2'" onmouseleave="this.style.background='#fff1f2'">
                    <i class="fas fa-trash" style="margin-right:4px;"></i> Remove
                </button>
            </div>` : '';

        list.innerHTML += `
            <div style="
                background: white; border-radius: 20px; padding: 20px;
                border: 1.5px solid #f1f5f9;
                box-shadow: 0 4px 12px rgba(0,0,0,0.04);
                transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
                position: relative; overflow: hidden;
            " onmouseenter="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 12px 24px rgba(0,0,0,0.08)';"
               onmouseleave="this.style.transform=''; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.04)';">
                
                <!-- Pill Icon + Name Row -->
                <div style="display:flex; align-items:center; gap:14px; margin-bottom:14px;">
                    <div style="
                        width:48px; height:48px; flex-shrink:0;
                        background:${c.bg}; color:${c.color};
                        border-radius:14px; display:flex; align-items:center; justify-content:center;
                        font-size:22px;
                    "><i class="fas fa-capsules"></i></div>
                    <div style="flex:1;">
                        <h3 style="font-weight:800; font-size:15px; color:#1f2937; margin:0 0 2px;">${med.name}</h3>
                        <span style="font-size:12px; font-weight:600; color:${c.color}; background:${c.bg}; padding:2px 8px; border-radius:20px;">${med.dosage}</span>
                    </div>
                    <div style="text-align:right; flex-shrink:0;">
                        <div style="font-size:15px; font-weight:800; color:#1f2937;">${formatTime(med.time)}</div>
                        <div style="font-size:11px; color:#9ca3af; font-weight:600;">${freqDisplay}</div>
                    </div>
                </div>

                <!-- Elder -->
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
                    <div style="width:24px; height:24px; border-radius:8px; background:${c.bg}; color:${c.color}; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800;">
                        ${med.elderName ? med.elderName[0].toUpperCase() : '?'}
                    </div>
                    <span style="font-size:13px; color:#4b5563; font-weight:600;">${med.elderName || 'Unknown Elder'}</span>
                    <span style="margin-left:auto; font-size:12px; color:#6b7280;">💊 Take ${med.perDose || 1}</span>
                </div>

                <!-- Stock Bar -->
                ${med.stock !== undefined ? `
                <div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span style="font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.3px;">Stock Level</span>
                        <span style="font-size:11px; font-weight:800; color:${isLow ? '#ef4444' : '#166534'};">${stockLabel}</span>
                    </div>
                    <div style="background:#f1f5f9; height:6px; border-radius:10px; overflow:hidden;">
                        <div style="height:100%; width:${stockPercent}%; background:${stockBarColor}; border-radius:10px; transition:width 0.8s ease;"></div>
                    </div>
                </div>` : ''}

                ${actionsHtml}
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
    if (localStorage.getItem('userRole') !== 'caregiver') return;
    
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
        if (localStorage.getItem('userRole') !== 'caregiver') return;
        
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
    if (localStorage.getItem('userRole') !== 'caregiver') return;
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