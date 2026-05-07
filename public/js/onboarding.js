// js/onboarding.js - CLINICAL ONBOARDING LOGIC
let currentStep = 1;
let selectedRole = '';
let familyId = '';
let currentUser = null;
let isNewFamily = false;

// Initialize Firebase Auth
firebase.auth().onAuthStateChanged(user => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = user;
    loadInitialData();
});

async function loadInitialData() {
    try {
        const doc = await firebase.firestore().collection('users').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('userName').innerText = data.name.split(' ')[0];
        }
    } catch (e) {
        console.error("Error loading onboarding data:", e);
    }
}

window.selectRole = function(role) {
    const primaryRoleBtn = document.getElementById('primaryCaregiverRole');
    if (role === 'primary_caregiver' && primaryRoleBtn.classList.contains('disabled')) {
        if (window.showToast) showToast("Role Restricted", "A Primary Caregiver already exists in this family.", "warning");
        return;
    }
    
    selectedRole = role;
    updateRoleUI(role);
}

function updateRoleUI(role) {
    document.querySelectorAll('.role-option').forEach(opt => {
        opt.classList.remove('active');
        if (opt.getAttribute('data-role') === role) {
            opt.classList.add('active');
        }
    });
}

window.nextStep = function(step) {
    // Validation for Step 1
    if (step === 2 && !familyId) {
        if (window.showToast) showToast("Network Required", "Please join or create a family network first.", "warning");
        return;
    }

    // Validation for Step 2
    if (step === 3 && !selectedRole) {
        if (window.showToast) showToast("Role Required", "Please select your role within the network.", "warning");
        return;
    }

    // Hide all
    document.querySelectorAll('.onboarding-step-content').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));

    // Show target
    document.getElementById(`step${step}`).classList.add('active');
    
    // Update dots
    for(let i=1; i<=step; i++) {
        const dot = document.getElementById(`step${i}-dot`);
        if (dot) dot.classList.add('active');
    }
    
    // Update Progress Bar
    const progressMap = { 1: '33%', 2: '66%', 3: '100%' };
    document.getElementById('progressBar').style.width = progressMap[step];
    
    currentStep = step;

    // Logic when entering Step 2: Check for Primary Caregiver
    if (step === 2) {
        checkPrimaryCaregiverStatus();
    }
}

async function checkPrimaryCaregiverStatus() {
    if (isNewFamily) {
        document.getElementById('primaryCaregiverRole').classList.remove('disabled');
        document.querySelector('#primaryCaregiverRole .role-limit-badge').style.display = 'none';
        return;
    }

    try {
        const primaryBtn = document.getElementById('primaryCaregiverRole');
        const badge = document.querySelector('#primaryCaregiverRole .role-limit-badge');

        // Check 1: Families Collection (New Logic)
        const familyDoc = await firebase.firestore().collection('families').doc(familyId).get();
        let primaryExists = familyDoc.exists && familyDoc.data().primaryCaregiver;

        // Check 2: Users Collection Fallback (Legacy/Reliability)
        if (!primaryExists) {
            const querySnapshot = await firebase.firestore().collection('users')
                .where('familyId', '==', familyId)
                .where('role', '==', 'primary_caregiver')
                .get();
            primaryExists = !querySnapshot.empty;
        }

        if (primaryExists) {
            primaryBtn.classList.add('disabled');
            badge.style.display = 'block';
            if (selectedRole === 'primary_caregiver') {
                selectedRole = '';
                updateRoleUI('');
            }
        } else {
            primaryBtn.classList.remove('disabled');
            badge.style.display = 'none';
        }
    } catch (e) {
        console.error("Error checking primary status:", e);
    }
}

window.verifyAndJoinFamily = async function() {
    const codeInput = document.getElementById('inputFamilyCode');
    const code = codeInput.value.trim().toUpperCase();
    if (!code) return;

    try {
        const familyDoc = await firebase.firestore().collection('families').doc(code).get();
        if (!familyDoc.exists) {
            if (window.showToast) showToast("Invalid Code", "Please check for typos and try again.", "error");
            return;
        }

        familyId = code;
        isNewFamily = false;
        
        // --- NEW: Update User Doc Immediately to enable family-based security rules ---
        await firebase.firestore().collection('users').doc(currentUser.uid).update({
            familyId: familyId
        });

        // UI Feedback
        codeInput.style.borderColor = '#166534';
        document.getElementById('proceedToRoleBtn').disabled = false;
        document.getElementById('createNetworkBtn').style.display = 'none';
        
        if (window.showToast) showToast("Code Verified", "Network identified. Proceed to role selection.", "success");
    } catch (e) {
        console.error(e);
        if (window.showToast) showToast("Error", e.message, "error");
    }
}

window.generateNewFamily = function() {
    familyId = "FAM-" + Math.floor(10000 + Math.random() * 90000);
    isNewFamily = true;

    document.getElementById('displayFamilyCode').innerText = familyId;
    document.getElementById('newFamilyCodeDisplay').style.display = 'block';
    document.getElementById('createNetworkBtn').style.display = 'none';
    document.getElementById('joinFamilyBox').style.opacity = '0.5';
    document.getElementById('joinFamilyBox').style.pointerEvents = 'none';
    document.getElementById('proceedToRoleBtn').disabled = false;
    
    if (window.showToast) showToast("Network Generated", "New family code created.", "success");
}

window.finishOnboarding = async function() {
    const btn = document.getElementById('finishOnboardingBtn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;

    const phone = document.getElementById('onboardingPhone').value;
    const photoFile = document.getElementById('photoUpload').files[0];

    // --- Validation: File Size Check (5MB) ---
    if (photoFile && photoFile.size > 5 * 1024 * 1024) {
        if (window.showToast) showToast("File Too Large", "Profile photo must be under 5MB.", "error");
        btn.disabled = false;
        btn.innerHTML = `Complete Setup <i class="fas fa-check-circle ml-2"></i>`;
        return;
    }

    try {
        let photoUrl = null;
        
        // 1. Upload Photo to Storage if selected
        if (photoFile) {
            const storageRef = firebase.storage().ref(`profiles/${currentUser.uid}/${photoFile.name}`);
            const snapshot = await storageRef.put(photoFile);
            photoUrl = await snapshot.ref.getDownloadURL();
        }

        // 2. Create or Update Family Record
        if (isNewFamily) {
            await firebase.firestore().collection("families").doc(familyId).set({
                createdBy: currentUser.uid,
                primaryCaregiver: selectedRole === 'primary_caregiver' ? currentUser.uid : null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else if (selectedRole === 'primary_caregiver') {
            // If joining existing family as primary (if it was vacant)
            await firebase.firestore().collection("families").doc(familyId).update({
                primaryCaregiver: currentUser.uid
            });
        }

        // 3. Update Firestore
        const updateData = {
            phone: phone,
            role: selectedRole,
            familyId: familyId,
            onboardingComplete: true,
            onboardedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (photoUrl) updateData.photo = photoUrl;

        // 4. Sync to LocalStorage (CRITICAL for sidebar injection)
        const storedUser = JSON.parse(localStorage.getItem('currentUser')) || {};
        storedUser.role = selectedRole;
        storedUser.familyId = familyId;
        if (photoUrl) storedUser.photo = photoUrl;
        
        localStorage.setItem('currentUser', JSON.stringify(storedUser));
        localStorage.setItem('userRole', selectedRole);

        // 5. Final Redirect
        if (selectedRole === 'elder') {
            window.location.href = 'elder-dashboard.html';
        } else {
            window.location.href = 'caregiver-dashboard.html';
        }

    } catch (e) {
        console.error("Onboarding Error:", e);
        if (window.showToast) showToast("Setup Failed", e.message, "error");
        btn.disabled = false;
        btn.innerHTML = `Complete Setup <i class="fas fa-check-circle ml-2"></i>`;
    }
}
