// js/medications.js

let medTimePicker = null;
let historyPicker = null;
let currentViewDate = new Date().toISOString().split('T')[0];
let currentElderFilter = 'all';
let elderFilterDropdownPopulated = false;

(async () => {
    if (!window.medicationService || !window.elderService) return;
    const userRole = await window.checkUserRole();
    if (!userRole) return;

    if (userRole === 'caregiver' || userRole === 'primary_caregiver') {
        const btn = document.getElementById("addMedBtn");
        if (btn) btn.classList.remove("hidden");
    }

    initPickers();
    await populateElderFilterDropdown(userRole);
    initMedsListener();
    loadChecklist(currentViewDate);
})();

async function populateElderFilterDropdown(userRole) {
    if (elderFilterDropdownPopulated) return;
    const select = document.getElementById("elderFilterSelect");
    if (!select) return;

    const isCaregiver = userRole === 'caregiver' || userRole === 'primary_caregiver';
    if (!isCaregiver) {
        select.style.display = 'none';
        return;
    }

    try {
        const elders = await window.elderService.getAll();
        select.innerHTML = '<option value="all">All Elders</option>';
        elders.forEach(e => {
            const op = document.createElement("option");
            op.value = e.id;
            op.text = e.name;
            select.appendChild(op);
        });

        select.style.display = 'block';
        select.addEventListener("change", (e) => {
            currentElderFilter = e.target.value;
            renderInventory();
            renderChecklist(currentViewDate);
        });
        elderFilterDropdownPopulated = true;
    } catch (e) {
        console.error("Error populating elder filter dropdown:", e);
    }
}

function initPickers() {
    medTimePicker = flatpickr("#medTime", {
        enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: false,
        defaultHour: 8, defaultMinute: 0
    });

    historyPicker = flatpickr("#historyDate", {
        defaultDate: "today", dateFormat: "Y-m-d", altInput: true, altFormat: "F j, Y",
        maxDate: "today",
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
    renderInventory(userRole);
}

function renderInventory() {
    const list = document.getElementById("medsList");
    if (!list) return;

    const meds = currentElderFilter === 'all'
        ? currentMeds
        : currentMeds.filter(m => m.elderId === currentElderFilter);
    const isCaregiver = !document.getElementById("addMedBtn").classList.contains("hidden");

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayDow = new Date().getDay();
    let dueToday = 0, lowStock = 0;
    meds.forEach(med => {
        const isDaily = med.frequency !== 'specific';
        const isOnDay = med.frequency === 'specific' && med.days && med.days.includes(todayDow);
        if (isDaily || isOnDay) dueToday++;
        if (med.stock !== undefined && med.stock < 5) lowStock++;
    });
    const el = (id) => document.getElementById(id);
    if (el('statTotalMeds')) el('statTotalMeds').innerText = meds.length;
    if (el('statDueToday')) el('statDueToday').innerText = dueToday;
    if (el('statLowStock')) el('statLowStock').innerText = lowStock;
    if (el('medsCabinetCount')) el('medsCabinetCount').innerText = `${meds.length} medications`;
    if (el('statLowStockCard') && lowStock > 0) el('statLowStockCard').style.borderLeft = '4px solid var(--warning)';

    if (meds.length === 0) {
        list.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#9ca3af;">
            <i class="fas fa-pills" style="font-size:48px; margin-bottom:16px; opacity:0.3;"></i>
            <p style="font-size:15px; font-weight:600;">No medications in the cabinet yet.</p>
        </div>`;
        return;
    }

    const sortedMeds = [...meds].sort((a, b) => a.time.localeCompare(b.time));

    const pillColors = [
        { bg: '#e0f2fe', color: '#0369a1' },
        { bg: '#dcfce7', color: '#166534' },
        { bg: '#fef9c3', color: '#854d0e' },
        { bg: '#fce7f3', color: '#9d174d' },
        { bg: '#ede9fe', color: '#5b21b6' },
    ];

    let html = "";
    sortedMeds.forEach((med, i) => {
        const c = pillColors[i % pillColors.length];
        const freqDisplay = med.isPRN
            ? `<span class="badge" style="background:#fef3c7; color:#92400e;">AS NEEDED</span>`
            : (med.frequency === 'specific' ? `On: ${formatDays(med.days)}` : `Every Day`);

        const stockPercent = med.stock ? Math.min((med.stock / 30) * 100, 100) : 0;
        const isLow = med.stock !== undefined && med.stock < 5;
        const stockBarColor = isLow ? '#ef4444' : '#22c55e';

        const unitMap = { pill: 'pills', liquid: 'ml', inhaler: 'puffs', injection: 'ml/units', topical: 'apps', drops: 'drops' };
        const unit = unitMap[med.formType || 'pill'];
        const stockLabel = med.stock !== undefined ? `${med.stock} ${unit} remaining` : 'Stock not tracked';

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

        html += `
            <div style="
                background: white; border-radius: 20px; padding: 20px;
                border: 1.5px solid #f1f5f9;
                box-shadow: 0 4px 12px rgba(0,0,0,0.04);
                transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
                position: relative; overflow: hidden;
            " onmouseenter="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 12px 24px rgba(0,0,0,0.08)';"
               onmouseleave="this.style.transform=''; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.04)';">
                
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

                <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
                    <div style="width:24px; height:24px; border-radius:8px; background:${c.bg}; color:${c.color}; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800;">
                        ${med.elderName ? med.elderName[0].toUpperCase() : '?'}
                    </div>
                    <span style="font-size:13px; color:#4b5563; font-weight:600;">${med.elderName || 'Unknown Elder'}</span>
                    <span style="margin-left:auto; font-size:12px; color:#6b7280;">${med.formType === 'liquid' ? '💧' : '💊'} Take ${med.perDose || 1} ${unit}</span>
                </div>

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
    list.innerHTML = html;
}

// ==========================================
// 2. CHECKLIST (Table Rows)
// ==========================================
let unsubscribeLogs = null;
let currentMeds = [];
let currentLogs = {};

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
        return;
    }

    const meds = currentElderFilter === 'all'
        ? currentMeds
        : currentMeds.filter(m => m.elderId === currentElderFilter);
    const logs = currentLogs;

    const [y, m, d] = dateStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    const dayIndex = targetDate.getDay();
    const todayStr = new Date().toISOString().split('T')[0];
    const isFuture = dateStr > todayStr;

    const scheduledMeds = meds.filter(m => {
        if (m.startDate && dateStr < m.startDate) return false;
        if (m.frequency === 'daily') return true;
        if (m.frequency === 'specific' && m.days && m.days.includes(dayIndex)) return true;
        return false;
    });

    if (scheduledMeds.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='6' class='text-center p-4 text-muted'>No meds scheduled for this day.</td></tr>";
        return;
    }

    const sortedMeds = scheduledMeds.sort((a, b) => a.time.localeCompare(b.time));

    let html = "";
    sortedMeds.forEach(med => {
        const isTaken = logs[med.id];
        const qty = med.perDose || 1;

        const unitMap = { pill: 'pills', liquid: 'ml', inhaler: 'puffs', injection: 'ml/units', topical: 'apps', drops: 'drops' };
        const unit = unitMap[med.formType || 'pill'];

        let statusHtml, btnHtml, rowClass = "";

        if (isTaken) {
            statusHtml = `<span class="status-taken">✔ Taken</span>`;
            btnHtml = `<span class="text-xs text-muted">Completed</span>`;
            rowClass = "row-taken";
        } else {
            statusHtml = `<span class="status-missed">Pending</span>`;
            if (isFuture) {
                btnHtml = `<button class="btn-xs btn-locked" disabled>Locked</button>`;
            } else {
                btnHtml = `<button onclick="markTaken('${med.id}', '${med.name}', ${qty})" class="btn-xs btn-take">Take (${qty} ${unit})</button>`;
            }
        }

        const instrMap = { before: 'Before Food', after: 'After Food', with: 'With Food', empty: 'Empty Stomach' };
        const instruction = (med.instruction && med.instruction !== 'none')
            ? `<div style="font-size:10px; color:var(--primary); font-weight:700; margin-top:2px;">📍 ${instrMap[med.instruction]}</div>`
            : "";

        const reminderIcon = (med.reminderOffset && med.reminderOffset !== "none" && med.reminderOffset !== "0")
            ? `<i class="fas fa-bell text-warning animate__animated animate__swing animate__infinite" style="font-size:10px; margin-left:4px;" title="Alert: ${med.reminderOffset}m before"></i>`
            : "";

        html += `
                <tr class="${rowClass}">
                    <td>${statusHtml}</td>
                    <td>${formatTime(med.time)} ${reminderIcon}</td>
                    <td><span class="badge" style="background:#eee; color:#333;">${med.elderName}</span></td>
                    <td class="font-bold">
                        <div>${med.name}</div>
                        ${instruction}
                    </td>
                    <td>${med.dosage} <span class="text-xs text-muted">(${qty} ${unit})</span></td>
                    <td>${btnHtml}</td>
                </tr>`;
    });
    tableBody.innerHTML = html;
}

window.toggleDaysSelector = function (val) {
    const el = document.getElementById("daysSelector");
    if (val === 'specific' && !document.getElementById("isPRN").checked) el.classList.remove('hidden');
    else el.classList.add('hidden');
};

window.setDose = function (val) {
    document.getElementById("medPerDose").value = val;
};

window.updateMedUnits = function (form) {
    const unitMap = {
        pill: 'pills',
        liquid: 'ml',
        inhaler: 'puffs',
        injection: 'ml/units',
        topical: 'apps',
        drops: 'drops'
    };
    const unit = unitMap[form] || 'units';
    document.getElementById("doseUnitLabel").innerText = unit;
    document.getElementById("stockUnitLabel").innerText = unit;
};

window.toggleFrequency = function (isPRN) {
    const freqSelect = document.getElementById("medFrequency");
    const daysBox = document.getElementById("daysSelector");
    if (isPRN) {
        freqSelect.disabled = true;
        freqSelect.value = "prn";
        daysBox.classList.add('hidden');
    } else {
        freqSelect.disabled = false;
        freqSelect.value = "daily";
    }
};

window.markTaken = async function (id, name, qtyToTake) {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const todayStr = new Date().toISOString().split('T')[0];
    if (currentViewDate > todayStr) {
        if (window.showToast) showToast("Error", "Cannot log medication for a future date.", "error");
        return;
    }
    const parsedQty = parseFloat(qtyToTake) || 1;
    try {
        await window.medicationService.markAsTaken(id, name, user.name, currentViewDate);

        const medRef = firebase.firestore().collection("medications").doc(id);
        const doc = await medRef.get();
        if (doc.exists) {
            const data = doc.data();
            const currentStock = parseFloat(data.stock) || 0;
            const newStock = Math.max(0, currentStock - parsedQty);

            // Calculamos umbrales híbridos (el 10% del stock de referencia o un búfer mínimo de 5 unidades; y el 5% o 2 unidades como nivel crítico).
            const originalStock = parseFloat(data.originalStock) || currentStock;
            const tenPercentThreshold = Math.max(originalStock * 0.10, 5);
            const fivePercentThreshold = Math.max(originalStock * 0.05, 2);

            const updates = { stock: newStock };
            let notifyMsg = null;

            // Evaluamos primero el umbral crítico del 5% para notificar con alta prioridad si corresponde y evitar avisos obsoletos.
            if (newStock <= fivePercentThreshold) {
                if (!data.alertedFivePercent) {
                    updates.alertedFivePercent = true;
                    updates.alertedTenPercent = true; // Si cae directamente al 5%, marcamos el 10% como alertado para no duplicar en el futuro.
                    notifyMsg = `🔴 Medication Stock Alert: ${name} is critically low (${newStock.toFixed(1)} remaining, <= 5% of original stock / 2 doses buffer).`;
                }
            } else if (newStock <= tenPercentThreshold) {
                if (!data.alertedTenPercent) {
                    updates.alertedTenPercent = true;
                    notifyMsg = `⚠️ Medication Stock Alert: ${name} is running low (${newStock.toFixed(1)} remaining, <= 10% of original stock / 5 doses buffer).`;
                }
            }

            await medRef.update(updates);

            // Generamos la notificación en Firestore para alertar a todo el círculo de cuidadores.
            if (notifyMsg) {
                await window.notificationService.save({
                    recipientId: null, // Difusión a todos los cuidadores de la familia
                    title: "Medication Low Stock",
                    message: notifyMsg,
                    type: "alert",
                    isRead: false,
                    read: false
                });
            }

            if (newStock < 5 && window.showToast) {
                showToast("Low Stock", `Only ${newStock.toFixed(1)} left of ${name}!`, "error");
            }
        }
        loadChecklist(currentViewDate);
        loadInventory('caregiver');
    } catch (e) { console.error(e); }
};

window.openMedModal = async function (id = null) {
    const role = localStorage.getItem('userRole');
    if (role !== 'caregiver' && role !== 'primary_caregiver') return;

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
            document.getElementById("medFormType").value = data.formType || "pill";
            updateMedUnits(data.formType || "pill");
            document.getElementById("medInstruction").value = data.instruction || "none";
            document.getElementById("isPRN").checked = data.isPRN || false;

            if (medTimePicker && data.time) medTimePicker.setDate(data.time);

            const freqSelect = document.getElementById("medFrequency");
            freqSelect.disabled = data.isPRN || false;
            freqSelect.value = data.isPRN ? "prn" : (data.frequency || 'daily');

            document.getElementById("medReminder").value = data.reminderOffset || "0";

            document.querySelectorAll('input[name="weekDay"]').forEach(cb => cb.checked = false);
            if (data.frequency === 'specific' && !data.isPRN) {
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
        document.getElementById("medFormType").value = "pill";
        updateMedUnits("pill");
        document.getElementById("isPRN").checked = false;
        document.getElementById("medFrequency").disabled = false;
        document.getElementById("daysSelector").classList.add('hidden');
        if (medTimePicker) { medTimePicker.clear(); medTimePicker.setDate("08:00"); }
        document.getElementById("medReminder").value = "0";
    }
};

window.closeMedModal = function () { document.getElementById("medModal").style.display = "none"; };

const medForm = document.getElementById("medForm");
if (medForm) {
    medForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const role = localStorage.getItem('userRole');
        if (role !== 'caregiver' && role !== 'primary_caregiver') return;

        const nameVal = document.getElementById("medName").value.trim();
        const dosageVal = document.getElementById("medDosage").value.trim();
        const timeVal = document.getElementById("medTime").value;
        const id = document.getElementById("medId").value;
        const elderSelect = document.getElementById("medElder");
        const freq = document.getElementById("medFrequency").value;
        const isPRN = document.getElementById("isPRN").checked;

        let selectedDays = [];
        if (freq === 'specific' && !isPRN) {
            document.querySelectorAll('input[name="weekDay"]:checked').forEach(cb => selectedDays.push(parseInt(cb.value)));
            if (selectedDays.length === 0) { alert("Select at least one day."); return; }
        }

        const data = {
            name: nameVal, dosage: dosageVal, time: timeVal,
            frequency: isPRN ? 'prn' : freq,
            isPRN: isPRN,
            formType: document.getElementById("medFormType").value,
            instruction: document.getElementById("medInstruction").value,
            days: (freq === 'specific' && !isPRN) ? selectedDays : null,
            stock: parseFloat(document.getElementById("medStock").value) || 0,
            perDose: parseFloat(document.getElementById("medPerDose").value) || 1,
            notes: document.getElementById("medNotes").value.trim(),
            elderId: elderSelect.value,
            elderName: elderSelect.options[elderSelect.selectedIndex].text,
            reminderOffset: document.getElementById("medReminder").value
        };

        if (!id) {
            data.startDate = new Date().toISOString().split('T')[0];
        }

        try {
            await window.medicationService.save(data, id || null);

            // Informamos a todos los miembros del círculo familiar para mantenerlos al tanto de los cambios en el régimen médico.
            const user = JSON.parse(localStorage.getItem('currentUser'));
            await window.notificationService.save({
                recipientId: null, // Difusión a todos los cuidadores de la familia
                title: id ? "Medication Updated" : "New Medication Added",
                message: id 
                    ? `💊 ${user.name} updated medication details for ${nameVal} (${data.elderName}).`
                    : `💊 ${user.name} added a new medication: ${nameVal} for ${data.elderName}.`,
                type: "medication",
                isRead: false,
                read: false
            });

            if (window.showToast) showToast("Success", "Medication Saved", "success");
            closeMedModal();
            loadInventory('caregiver');
            loadChecklist(currentViewDate);
        } catch (e) { alert(e.message); }
    });
}
let medIdToDelete = null;

window.deleteMed = function (id) {
    const role = localStorage.getItem('userRole');
    if (role !== 'caregiver' && role !== 'primary_caregiver') return;
    medIdToDelete = id;
    const deleteModal = document.getElementById("deleteConfirmModal");
    if (deleteModal) {
        deleteModal.classList.add("active");
    }
};

window.closeDeleteModal = function () {
    medIdToDelete = null;
    const deleteModal = document.getElementById("deleteConfirmModal");
    if (deleteModal) {
        deleteModal.classList.remove("active");
    }
};

// Bind confirm delete action
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async function () {
        if (medIdToDelete) {
            try {
                await window.medicationService.delete(medIdToDelete);
                if (window.showToast) showToast("Success", "Medication prescription deleted", "success");
                loadInventory('caregiver');
                loadChecklist(currentViewDate);
            } catch (e) {
                console.error(e);
            }
            closeDeleteModal();
        }
    });
}

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