// js/profiles.js - REFACTORED (Uses CSS Classes)

let currentBase64Photo = null;

(async () => {
    if (!window.elderService) return;

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            displayFamilyCode();
            loadElders();
            loadCaregivers();
        } else {
            window.location.href = 'login.html';
        }
    });
})();

function displayFamilyCode() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (user && user.familyId) {
        const codeEl = document.getElementById("displayFamilyCode");
        if (codeEl) codeEl.innerText = user.familyId;
    }
}

function loadElders() {
    const container = document.getElementById("elder-list");
    if (!container) return;

    // Use listener instead of fetch
    window.elderService.listenElders((elders) => {
        container.innerHTML = "";
        
        const countEl = document.getElementById("totalEldersCount");
        if (countEl) countEl.innerText = elders.length;

        if (elders.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:40px; color:#666; background:#f9fafb; border-radius:12px; border:2px dashed #ccc;">
                    <i class="fas fa-user-plus" style="font-size:40px; color:#ccc; margin-bottom:10px;"></i>
                    <p>No elders linked yet.</p>
                    <p style="font-size:13px;">Use the Family Code above to register them.</p>
                </div>`;
            return;
        }

        elders.forEach((data, index) => {
            const avatarUrl = data.photo
                ? data.photo
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=random&color=fff&size=128`;

            const delay = (index * 0.1).toFixed(1);
            const card = `
                <div class="card text-center elder-card-content" style="animation: fadeInUp 0.5s cubic-bezier(0.25, 0.8, 0.25, 1) both; animation-delay: ${delay}s;">
                    <div class="elder-avatar-container" style="margin-bottom: 20px;">
                        <img src="${avatarUrl}" class="elder-avatar" alt="${data.name}" 
                             style="width: 90px; height: 90px; border: 4px solid white; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
                        <span class="elder-status-dot" title="Active Account" 
                              style="width: 20px; height: 20px; bottom: 5px; right: 5px; border: 3px solid white;"></span>
                    </div>
                    
                    <h2 style="margin-bottom:5px; font-size: 20px;">${data.name}</h2>
                    <p class="text-sm text-muted mb-4">
                        <i class="fas fa-hashtag"></i> ID: ${data.familyId}
                    </p>

                    <div class="info-box" style="background: #f8fafc; border: 1px solid #e2e8f0;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
                            <span class="text-muted text-xs uppercase font-bold">Age</span>
                            <span class="font-bold">${data.age}</span>
                        </div>
                        <div>
                            <span class="text-muted text-xs uppercase font-bold display:block mb-1">Medical Conditions</span>
                            <div style="color:#333; line-height:1.4;">${data.conditions || 'None recorded'}</div>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2 mt-auto">
                        <button onclick="viewProfile('${data.id}')" class="btn-primary w-full shadow-md" style="justify-content:center; padding: 12px; font-weight:700;">
                            <i class="fas fa-file-medical" style="margin-right:8px;"></i> View Clinical Chart
                        </button>
                        <button onclick="editElder('${data.id}')" class="btn-ghost w-full text-xs" style="justify-content:center; padding: 8px; opacity:0.7;">
                             Edit Basic Info
                        </button>
                    </div>
                </div>
            `;
            container.innerHTML += card;
        });

    });
}

function loadCaregivers() {
    const container = document.getElementById("caregiver-list");
    if (!container) return;

    window.elderService.listenCaregivers((caregivers) => {
        container.innerHTML = "";

        if (caregivers.length === 0) {
            container.innerHTML = `<p class="text-muted col-span-full text-center">No other caregivers found.</p>`;
            return;
        }

        const currentUser = firebase.auth().currentUser;

        caregivers.forEach((data, index) => {
            // Use same avatar logic or a generic icon
            const avatarUrl = data.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'C')}&background=4A6351&color=fff`;
            
            const isMe = currentUser && currentUser.uid === data.id;
            const youBadge = isMe ? `<span class="badge badge-primary ml-2" style="font-size:10px; padding:2px 6px; border-radius:10px; background:var(--primary); color:white;">(You)</span>` : '';

            const delay = (index * 0.1).toFixed(1);
            
            const card = `
                <div class="card" style="padding:20px; display:flex; align-items:center; gap:15px; animation: fadeInUp 0.5s cubic-bezier(0.25, 0.8, 0.25, 1) both; animation-delay: ${delay}s;">
                    <img src="${avatarUrl}" alt="${data.name}" style="width:60px; height:60px; border-radius:50%; border:2px solid var(--border);">
                    <div style="flex-grow:1;">
                        <h4 class="font-bold text-dark m-0" style="display:flex; align-items:center;">
                            ${data.name || 'Caregiver'} ${youBadge}
                        </h4>
                        <p class="text-xs text-muted mt-1 m-0" style="text-transform:capitalize;">Role: ${data.role}</p>
                    </div>
                </div>
            `;
            container.innerHTML += card;
        });

    });
}

// ==========================================
// PHOTO LOGIC (Add & Remove)
// ==========================================

window.previewImage = function (input) {
    if (input.files && input.files[0]) {
        if (input.files[0].size > 500000) { // 500KB Limit
            alert("File is too big! Please keep it under 500KB.");
            input.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById("photoPreview");
            preview.src = e.target.result;
            preview.style.display = "block";
            document.getElementById("uploadIcon").style.display = "none";
            document.getElementById("removePhotoBtn").style.display = "flex";
            currentBase64Photo = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
};

window.removePhoto = function () {
    currentBase64Photo = null;
    const preview = document.getElementById("photoPreview");
    preview.src = "";
    preview.style.display = "none";
    document.getElementById("uploadIcon").style.display = "block";
    document.getElementById("removePhotoBtn").style.display = "none";
    document.getElementById("elderPhoto").value = "";
};

window.viewProfile = function(id) {
    window.location.href = `view_profile.html?id=${id}`;
};

window.editElder = async function (id) {
    try {
        const data = await window.elderService.getById(id);
        if (data) {
            document.getElementById('editElderId').value = id;
            document.getElementById('elderName').value = data.name || "";
            
            // ✅ FIX: Ensure age is a number or empty string.
            // If data.age is "Not specified" or "undefined", we clear it so the number input doesn't break.
            let safeAge = data.age;
            if (!safeAge || isNaN(safeAge)) safeAge = "";
            document.getElementById('elderAge').value = safeAge;

            document.getElementById('elderConditions').value = data.conditions || "";

            if (data.photo) {
                currentBase64Photo = data.photo;
                const preview = document.getElementById("photoPreview");
                preview.src = data.photo;
                preview.style.display = "block";
                document.getElementById("uploadIcon").style.display = "none";
                document.getElementById("removePhotoBtn").style.display = "flex";
            } else {
                window.removePhoto(); // Reset UI
            }

            document.getElementById('addElderModal').style.display = 'flex';
        }
    } catch (error) {
        console.error(error);
        if(window.showToast) showToast("Error", "Could not fetch profile", "error");
    }
};

window.saveElderProfile = async function (event) {
    event.preventDefault();

    const id = document.getElementById('editElderId').value;
    const btn = document.getElementById('submitBtn');

    btn.disabled = true;
    btn.innerText = "Updating...";

    const elderData = {
        name: document.getElementById('elderName').value,
        age: document.getElementById('elderAge').value,
        conditions: document.getElementById('elderConditions').value,
        photo: currentBase64Photo
    };

    try {
        await window.elderService.save(elderData, id);
        if(window.showToast) showToast("Success", "Profile updated", "success");
        document.getElementById('addElderModal').style.display = 'none';
        loadElders();
    } catch (error) {
        if(window.showToast) showToast("Error", error.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Update Profile";
    }
};