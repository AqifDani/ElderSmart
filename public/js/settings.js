// js/settings.js - FIXED (Preserves Family ID)

// 1. Auth Check & Load Data
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        loadUserSettings(user);
    } else {
        window.location.href = "index.html";
    }
});

// 2. Load User Data from Firestore
function loadUserSettings(user) {
    const db = firebase.firestore();

    // Set basic email from Auth
    const emailField = document.getElementById("displayEmail");
    if (emailField) emailField.value = user.email;

    document.getElementById("settingsAvatar").innerText = user.email.charAt(0).toUpperCase();

    // Fetch detailed profile (Name, Role)
    db.collection("users").doc(user.uid).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const nameField = document.getElementById("displayName");
            const roleField = document.getElementById("displayRole");

            if (nameField) nameField.value = data.name || "";
            if (roleField) roleField.value = data.role || "Caregiver";

            // Update Avatar if name exists
            if (data.name) {
                const initial = data.name.charAt(0).toUpperCase();
                document.getElementById("settingsAvatar").innerText = initial;

                // Also update the sidebar avatar immediately if it exists
                const sidebarAvatar = document.getElementById("userAvatar");
                if (sidebarAvatar) sidebarAvatar.innerText = initial;
            }
        }
    }).catch(err => console.error(err));
}

// 3. Update Profile (Name)
const profileForm = document.getElementById("profileForm");
if (profileForm) {
    profileForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const user = firebase.auth().currentUser;
        const newName = document.getElementById("displayName").value;
        const roleVal = document.getElementById("displayRole").value.toLowerCase();
        const db = firebase.firestore();

        if (!user) return;

        // Update Firestore
        db.collection("users").doc(user.uid).set({
            name: newName,
            email: user.email,
            role: roleVal
        }, { merge: true })
            .then(() => {
                // ✅ FIX: Get existing data FIRST to preserve familyId
                const existingData = JSON.parse(localStorage.getItem('currentUser')) || {};

                const updatedUser = {
                    ...existingData, // Keep familyId and other hidden fields
                    name: newName,
                    email: user.email
                };

                localStorage.setItem('currentUser', JSON.stringify(updatedUser));

                // Update Sidebar Name immediately
                const nameDisplay = document.getElementById("userName");
                const avatarDisplay = document.getElementById("userAvatar");
                const settingsAvatar = document.getElementById("settingsAvatar");

                if (nameDisplay) nameDisplay.innerText = newName;
                if (avatarDisplay) avatarDisplay.innerText = newName.charAt(0).toUpperCase();
                if (settingsAvatar) settingsAvatar.innerText = newName.charAt(0).toUpperCase();

                showToast("Success", "Profile updated successfully", "success");
            })
            .catch((error) => {
                console.error(error);
                showToast("Error", error.message, "error");
            });
    });
}

// 4. Change Password
const passForm = document.getElementById("passwordForm");
if (passForm) {
    passForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const newPass = document.getElementById("newPassword").value;
        const confirmPass = document.getElementById("confirmPassword").value;
        const user = firebase.auth().currentUser;

        if (newPass !== confirmPass) {
            showToast("Error", "Passwords do not match", "error");
            return;
        }

        user.updatePassword(newPass).then(() => {
            showToast("Success", "Password changed. Please login again.", "success");
            document.getElementById("passwordForm").reset();

            // Optional: Force logout for security
            setTimeout(() => {
                firebase.auth().signOut().then(() => window.location.href = "index.html");
            }, 2000);
        }).catch((error) => {
            if (error.code === 'auth/requires-recent-login') {
                showToast("Security Alert", "Please log out and log back in to change password.", "error");
            } else {
                showToast("Error", error.message, "error");
            }
        });
    });
}