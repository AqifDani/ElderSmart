// js/view_profile.js - THE CLINICAL COMMAND CENTER BRAIN

(async () => {
    if (!window.elderService || !window.healthService || !window.medicationService) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const elderId = urlParams.get('id');
    
    if (!elderId) {
        window.location.href = 'elder_profiles.html';
        return;
    }

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            loadElderChart(elderId);
        } else {
            window.location.href = 'login.html';
        }
    });
})();

let currentElder = null;

async function loadElderChart(id) {
    try {
        currentElder = await window.elderService.getById(id);
        if (!currentElder) {
            showToast("Error", "Elder not found", "error");
            setTimeout(() => window.location.href = 'elder_profiles.html', 2000);
            return;
        }

        // 1. Render Basic Profile
        renderProfileSummary(currentElder);
        
        // 2. Fetch Module Data (Health & Meds)
        const [healthRecords, medications] = await Promise.all([
            window.healthService.getAll(),
            window.medicationService.getAll()
        ]);

        // Filter by ID (Primary) and Name (Robust Fallback)
        const targetId = id;
        const targetName = currentElder.name.toLowerCase().trim();
        
        console.log("DEBUG: Filtering for ID:", targetId, "Name:", targetName);

        const filteredHealth = healthRecords
            .filter(r => {
                // Try ID first, then fallback to name matching
                if (r.elderId === targetId) return true;
                const recordName = (r.elderName || r.visitElder || "").toLowerCase().trim();
                return recordName && (recordName === targetName || targetName.includes(recordName) || recordName.includes(targetName));
            })
            .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        
        const filteredMeds = medications
            .filter(m => {
                if (m.elderId === targetId) return true;
                const medName = (m.elderName || m.medElder || "").toLowerCase().trim();
                return medName && (medName === targetName || targetName.includes(medName) || medName.includes(targetName));
            });

        console.log("DEBUG: Found Health Records:", filteredHealth.length);
        console.log("DEBUG: Found Medications:", filteredMeds.length);

        // 3. Render Modules
        renderVitalsPulse(filteredHealth);
        renderHealthLogs(filteredHealth);
        renderPharmacy(filteredMeds);

    } catch (error) {
        console.error("Clinical Chart Error:", error);
        showToast("Error", "Failed to load medical data", "error");
    }
}

function renderProfileSummary(elder) {
    document.getElementById("elderName").innerText = elder.name;
    document.getElementById("elderMeta").innerText = `${elder.age || '--'} Years Old • Family ID: ${elder.familyId}`;
    
    // Render Conditions as Tags
    const tagsContainer = document.getElementById("elderConditions");
    const conditions = elder.conditions ? elder.conditions.split(',').map(c => c.trim()) : [];
    
    if (conditions.length > 0) {
        tagsContainer.innerHTML = conditions.map(c => `<span class="clinical-tag">${c}</span>`).join('');
    } else {
        tagsContainer.innerHTML = `<span class="text-xs text-muted italic">No chronic conditions recorded.</span>`;
    }
    
    const avatar = document.getElementById("elderAvatar");
    if (elder.photo) {
        avatar.src = elder.photo;
    } else {
        avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(elder.name)}&background=4A6351&color=fff&size=128`;
    }
}

function renderVitalsPulse(records) {
    if (records.length === 0) return;

    const latest = records[0];
    document.getElementById("sideBP").innerText = latest.bp || "--/--";
    document.getElementById("sideHR").innerText = (latest.hr ? `${latest.hr} bpm` : "-- bpm");

    // Chart.js BP Trend
    const ctxBP = document.getElementById('bpChart').getContext('2d');
    const last10 = [...records].reverse().slice(-10);
    
    const labels = last10.map(r => r.date ? r.date.split('-').slice(1).join('/') : '--');
    const systolic = last10.map(r => r.bp ? parseInt(r.bp.split('/')[0]) : null);
    const diastolic = last10.map(r => r.bp ? parseInt(r.bp.split('/')[1]) : null);

    new Chart(ctxBP, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Systolic', data: systolic, borderColor: '#4A6351', tension: 0.4, fill: false },
                { label: 'Diastolic', data: diastolic, borderColor: '#9e8635', tension: 0.4, fill: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: false, grid: { display: false } }, x: { grid: { display: false } } }
        }
    });

    // Chart.js Weight Trend
    const ctxW = document.getElementById('weightChart').getContext('2d');
    const weights = last10.map(r => r.weight ? parseFloat(r.weight) : null);

    new Chart(ctxW, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Weight (kg)', data: weights, backgroundColor: 'rgba(74, 99, 81, 0.2)', borderRadius: 8 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: false }, x: { grid: { display: false } } }
        }
    });
}

function renderHealthLogs(records) {
    const list = document.getElementById("healthLogsList");
    if (records.length === 0) {
        list.innerHTML = `<div class="text-center p-12 text-muted">No medical visits recorded for this elder.</div>`;
        return;
    }

    list.innerHTML = records.map(r => `
        <div class="card p-5 animate__animated animate__fadeIn">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-bold text-dark text-lg">${r.location || 'Clinic Visit'}</h4>
                    <p class="text-xs text-muted font-bold uppercase"><i class="fas fa-calendar-alt mr-1"></i> ${r.date || '--'}</p>
                </div>
                <div class="badge badge-primary" style="padding: 6px 12px; font-size:12px;">Logged by Team</div>
            </div>
            <div class="grid grid-3 gap-4 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div class="text-center">
                    <p class="text-[10px] text-muted uppercase font-bold">Blood Pressure</p>
                    <p class="font-bold text-primary">${r.bp || '--'}</p>
                </div>
                <div class="text-center">
                    <p class="text-[10px] text-muted uppercase font-bold">Heart Rate</p>
                    <p class="font-bold text-secondary">${r.hr || '--'} bpm</p>
                </div>
                <div class="text-center">
                    <p class="text-[10px] text-muted uppercase font-bold">Weight</p>
                    <p class="font-bold text-dark">${r.weight || '--'} kg</p>
                </div>
            </div>
            <p class="text-sm text-dark italic opacity-80" style="border-left: 3px solid var(--primary); padding-left: 12px;">
                "${r.notes || 'No specific doctor notes recorded.'}"
            </p>
        </div>
    `).join('');
}

function renderPharmacy(meds) {
    const grid = document.getElementById("medicationGrid");
    if (meds.length === 0) {
        grid.innerHTML = `<div class="text-center p-12 text-muted col-span-full">No active medications found in cabinet.</div>`;
        return;
    }

    grid.innerHTML = meds.map(m => `
        <div class="card flex items-center gap-4 animate__animated animate__fadeIn">
            <div class="icon-square bg-primary/10 text-primary">
                <i class="fas fa-pills"></i>
            </div>
            <div style="flex:1;">
                <h4 class="font-bold text-dark">${m.name}</h4>
                <p class="text-xs text-muted">${m.dosage} • ${m.time}</p>
            </div>
            <div class="text-right">
                <div class="text-xs font-bold text-muted uppercase">Stock</div>
                <div class="text-sm font-bold ${m.stock < 5 ? 'text-danger' : 'text-success'}">${m.stock || '0'} left</div>
            </div>
        </div>
    `).join('');
}

window.switchTab = function(tabName) {
    // Buttons
    document.querySelectorAll('.clinical-tab').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Panes
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById(`content-${tabName}`).classList.add('active');
};

window.printChart = function() {
    window.print();
};

window.shareChart = async function() {
    const name = document.getElementById("elderName").innerText;
    const shareData = {
        title: `Clinical Chart - ${name}`,
        text: `Viewing medical records and vitals for ${name} on ElderSmart.`,
        url: window.location.href
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(window.location.href);
            showToast("Copied", "Link copied to clipboard for sharing", "success");
        }
    } catch (err) {
        console.error("Share failed:", err);
    }
};
