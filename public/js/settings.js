// js/settings.js - PREMIUM CLINICAL SETTINGS
let currentUserData = null;

// 1. Auth Check & Initialization
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        loadUserSettings(user);
    } else {
        window.location.href = "login.html";
    }
});

// 2. Load User Data
async function loadUserSettings(user) {
    try {
        const doc = await firebase.firestore().collection("users").doc(user.uid).get();
        if (!doc.exists) return;

        currentUserData = doc.data();
        
        // Fill Fields
        document.getElementById("displayName").value = currentUserData.name || "";
        document.getElementById("displayEmail").value = user.email;
        document.getElementById("displayPhone").value = currentUserData.phone || "";
        document.getElementById("displayFamilyId").innerText = currentUserData.familyId || "---";
        
        const roleBadge = document.getElementById("displayRoleBadge");
        roleBadge.innerText = currentUserData.role ? currentUserData.role.replace('_', ' ').toUpperCase() : "CAREGIVER";

        // Update Avatar Preview
        updateAvatarUI(currentUserData.photo, currentUserData.name);

    } catch (e) {
        console.error("Error loading settings:", e);
        if (window.showToast) showToast("Error", "Could not load profile data.", "error");
    }
}

function updateAvatarUI(photoUrl, name) {
    const preview = document.getElementById("settingsAvatarPreview");
    if (photoUrl) {
        preview.innerHTML = `<img src="${photoUrl}" alt="Profile" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
        const initial = (name || "U").charAt(0).toUpperCase();
        preview.innerHTML = `<span style="font-size: 40px; font-weight: 800; color: #cbd5e1;">${initial}</span>`;
    }
}

// 3. Handle Photo Upload
document.getElementById("settingsPhotoUpload").addEventListener("change", async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validation: 5MB
    if (file.size > 5 * 1024 * 1024) {
        if (window.showToast) showToast("File Too Large", "Photo must be under 5MB.", "error");
        return;
    }

    const user = firebase.auth().currentUser;
    const preview = document.getElementById("settingsAvatarPreview");
    const originalContent = preview.innerHTML;
    
    // Show loading state in avatar
    preview.innerHTML = `<i class="fas fa-spinner fa-spin" style="font-size: 30px; color: var(--primary);"></i>`;

    try {
        const storageRef = firebase.storage().ref(`profiles/${user.uid}/${file.name}`);
        const snapshot = await storageRef.put(file);
        const photoUrl = await snapshot.ref.getDownloadURL();

        // Update Firestore
        await firebase.firestore().collection("users").doc(user.uid).update({ photo: photoUrl });

        // Update Local State & UI
        updateAvatarUI(photoUrl, currentUserData.name);
        syncLocalStorage({ photo: photoUrl });
        
        // Update Sidebar immediately if it exists
        const sidebarAvatar = document.getElementById("userAvatar");
        if (sidebarAvatar) {
            sidebarAvatar.innerHTML = `<img src="${photoUrl}" alt="U" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }

        if (window.showToast) showToast("Success", "Profile photo updated.", "success");
    } catch (error) {
        console.error(error);
        preview.innerHTML = originalContent;
        if (window.showToast) showToast("Upload Failed", error.message, "error");
    }
});

// 4. Update Profile Form
document.getElementById("profileForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    const btn = document.getElementById("saveProfileBtn");
    const originalText = btn.innerHTML;
    
    const newName = document.getElementById("displayName").value.trim();
    const newPhone = document.getElementById("displayPhone").value.trim();

    if (!newName) return showToast("Required", "Display name is required.", "warning");

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;

    try {
        const user = firebase.auth().currentUser;
        await firebase.firestore().collection("users").doc(user.uid).update({
            name: newName,
            phone: newPhone
        });

        // Sync and Update UI
        syncLocalStorage({ name: newName });
        
        const nameDisplay = document.getElementById("userName");
        if (nameDisplay) nameDisplay.innerText = newName;
        
        if (window.showToast) showToast("Success", "Profile details saved.", "success");
    } catch (error) {
        console.error(error);
        if (window.showToast) showToast("Save Failed", error.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
});

// 5. Password Change
document.getElementById("passwordForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    const newPass = document.getElementById("newPassword").value;
    const confirmPass = document.getElementById("confirmPassword").value;

    if (newPass.length < 6) return showToast("Security", "Password must be at least 6 characters.", "warning");
    if (newPass !== confirmPass) return showToast("Error", "Passwords do not match.", "error");

    try {
        await firebase.auth().currentUser.updatePassword(newPass);
        showToast("Success", "Password updated successfully.", "success");
        e.target.reset();
    } catch (error) {
        if (error.code === 'auth/requires-recent-login') {
            showToast("Security Re-auth", "Please logout and login again to change password.", "error");
        } else {
            showToast("Error", error.message, "error");
        }
    }
});

// Helper: Sync LocalStorage
function syncLocalStorage(newData) {
    const stored = JSON.parse(localStorage.getItem('currentUser')) || {};
    const updated = { ...stored, ...newData };
    localStorage.setItem('currentUser', JSON.stringify(updated));
}

// Global: Copy Code (exposed for onclick)
window.copyFamilyCode = function() {
    const code = document.getElementById("displayFamilyId").innerText;
    if (code === "---") return;
    navigator.clipboard.writeText(code);
    if (window.showToast) showToast("Copied", "Family code copied to clipboard.", "success");
};

// Placeholder for Delete Account
window.confirmDeleteAccount = function() {
    if (window.showToast) showToast("System Alert", "Account deletion requires clinical authorization. Contact support.", "warning");
};