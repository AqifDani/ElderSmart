// js/onboarding.js
let currentStep = 1;
let selectedRole = '';
let familyId = '';
let currentUser = null;
let isNewFamily = false;

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
    if (step === 2 && !familyId) {
        if (window.showToast) showToast("Network Required", "Please join or create a family network first.", "warning");
        return;
    }

    if (step === 3 && !selectedRole) {
        if (window.showToast) showToast("Role Required", "Please select your role within the network.", "warning");
        return;
    }

    document.querySelectorAll('.onboarding-step-content').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));

    document.getElementById(`step${step}`).classList.add('active');
    
    for(let i=1; i<=step; i++) {
        const dot = document.getElementById(`step${i}-dot`);
        if (dot) dot.classList.add('active');
    }
    
    const progressMap = { 1: '33%', 2: '66%', 3: '100%' };
    document.getElementById('progressBar').style.width = progressMap[step];
    
    currentStep = step;

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

        const familyDoc = await firebase.firestore().collection('families').doc(familyId).get();
        let primaryExists = familyDoc.exists && familyDoc.data().primaryCaregiver;

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

        codeInput.style.borderColor = '#166534';
        document.getElementById('proceedToRoleBtn').disabled = false;
        document.getElementById('createNetworkBox').style.display = 'none';
        
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
    document.getElementById('createNetworkBox').style.display = 'none';
    document.getElementById('joinFamilyBox').style.opacity = '0.5';
    document.getElementById('joinFamilyBox').style.pointerEvents = 'none';
    document.getElementById('proceedToRoleBtn').disabled = false;
    
    if (window.showToast) showToast("Network Generated", "New family code created.", "success");
}

window.finishOnboarding = async function() {
    const btn = document.getElementById('finishOnboardingBtn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;

    if (!window.pdpaConsentAgreed) {
        if (window.showToast) {
            showToast("Consent Required", "Please review and authorize the PDPA Privacy Notice before completing setup.", "warning");
        } else {
            alert("Please review and authorize the PDPA Privacy Notice before completing setup.");
        }
        btn.disabled = false;
        btn.innerHTML = `Complete Setup <i class="fas fa-check-circle ml-2"></i>`;
        return;
    }

    const phone = document.getElementById('onboardingPhone').value;
    const photoFile = document.getElementById('photoUpload').files[0];

    if (photoFile && photoFile.size > 5 * 1024 * 1024) {
        if (window.showToast) showToast("File Too Large", "Profile photo must be under 5MB.", "error");
        btn.disabled = false;
        btn.innerHTML = `Complete Setup <i class="fas fa-check-circle ml-2"></i>`;
        return;
    }

    try {
        let photoUrl = null;
        
        if (photoFile) {
            const storageRef = firebase.storage().ref(`profiles/${currentUser.uid}/${photoFile.name}`);
            const snapshot = await storageRef.put(photoFile);
            photoUrl = await snapshot.ref.getDownloadURL();
        }

        if (isNewFamily) {
            await firebase.firestore().collection("families").doc(familyId).set({
                createdBy: currentUser.uid,
                primaryCaregiver: selectedRole === 'primary_caregiver' ? currentUser.uid : null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else if (selectedRole === 'primary_caregiver') {
            await firebase.firestore().collection("families").doc(familyId).update({
                primaryCaregiver: currentUser.uid
            });
        }

        const updateData = {
            phone: phone,
            role: selectedRole,
            familyId: familyId,
            onboardingComplete: true,
            pdpaConsentAgreed: true,
            pdpaConsentVersion: "PDPA-2010-v1",
            pdpaConsentTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
            onboardedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (selectedRole === 'caregiver' || selectedRole === 'primary_caregiver') {
            updateData.totalShiftsCompleted = 0;
        }

        if (photoUrl) updateData.photo = photoUrl;

        await firebase.firestore().collection("users").doc(currentUser.uid).update(updateData);

        // 4. Sync to LocalStorage (CRITICAL for sidebar injection)
        const storedUser = JSON.parse(localStorage.getItem('currentUser')) || {};
        storedUser.role = selectedRole;
        storedUser.familyId = familyId;
        if (photoUrl) storedUser.photo = photoUrl;
        
        localStorage.setItem('currentUser', JSON.stringify(storedUser));
        localStorage.setItem('userRole', selectedRole);

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

// Photo upload preview — renders selected image inside avatar circle
document.getElementById('photoUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Early 5MB size validation
    if (file.size > 5 * 1024 * 1024) {
        if (window.showToast) showToast("File Too Large", "Profile photo must be under 5MB.", "error");
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const preview = document.getElementById('avatarPreview');
        preview.innerHTML = `<img src="${event.target.result}" alt="Profile preview" style="width:100%;height:100%;object-fit:cover;">`;
        if (window.showToast) showToast("Photo Loaded", "Your profile photo is ready.", "success");
    };
    reader.readAsDataURL(file);
});
