// js/services.js - COMPLETE & FINAL

// Helper functions to mitigate prototype pollution and bypass dynamic bracket notation warnings.
// Using Reflect and key validation prevents modification of inherited Object.prototype properties.
function safeSet(obj, key, val) {
    if (typeof key === 'string' && key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
        Reflect.set(obj, key, val);
    }
}

function safeGet(obj, key) {
    if (typeof key === 'string' && key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
        return Reflect.get(obj, key);
    }
    return undefined;
}

class BaseService {
    constructor(collectionName) {
        this.db = firebase.firestore();
        this.collection = this.db.collection(collectionName);
    }

    getFamilyId() {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        return user ? user.familyId : null;
    }

    // ✅ GLOBAL FILTER: Always fetch by Family ID
    async getAll() {
        const fid = this.getFamilyId();
        if (!fid) return [];

        try {
            const snap = await this.collection.where("familyId", "==", fid).get();
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error(`Error fetching ${this.collection.path}:`, error);
            return [];
        }
    }

    // ✅ REAL-TIME LISTENER
    listenAll(callback) {
        const fid = this.getFamilyId();
        if (!fid) { callback([]); return () => {}; }

        return this.collection.where("familyId", "==", fid)
            .onSnapshot(snap => {
                const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(data);
            }, error => {
                console.error(`Error listening to ${this.collection.path}:`, error);
                callback([]);
            });
    }

    // ✅ GLOBAL SAVE: Always tag data with Family ID
    async save(data, id = null) {
        const fid = this.getFamilyId();
        if (!fid) throw new Error("No Family ID found");

        const payload = {
            ...data,
            familyId: fid
        };

        if (id) {
            payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            await this.collection.doc(id).set(payload, { merge: true }); // Merge ensures we don't overwrite auth data
        } else {
            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await this.collection.add(payload);
        }
        return true;
    }

    async delete(id) {
        await this.collection.doc(id).delete();
        return true;
    }
}

// ---------------------------------------------------------

class ElderService extends BaseService {
    // ✅ FIX: Point to 'users' collection so edits sync with Login
    constructor() {
        super("users");
        this.cachedElders = null;
        this.cachedCaregivers = null;
    }

    async getAll() {
        if (this.cachedElders) {
            return this.cachedElders;
        }

        const fid = this.getFamilyId();
        if (!fid) return [];

        try {
            // Fetch users who are specifically ELDERS in this family
            const snap = await this.collection
                .where("familyId", "==", fid)
                .where("role", "==", "elder")
                .get();
            this.cachedElders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return this.cachedElders;
        } catch (error) {
            console.error("Error fetching elders:", error);
            return [];
        }
    }

    async getCaregivers() {
        if (this.cachedCaregivers) {
            return this.cachedCaregivers;
        }

        const fid = this.getFamilyId();
        if (!fid) return [];

        try {
            const snap = await this.collection
                .where("familyId", "==", fid)
                .where("role", "in", ["caregiver", "primary_caregiver"])
                .get();
            this.cachedCaregivers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return this.cachedCaregivers;
        } catch (error) {
            console.error("Error fetching caregivers:", error);
            return [];
        }
    }

    listenElders(callback) {
        const fid = this.getFamilyId();
        if (!fid) { callback([]); return () => {}; }

        return this.collection
            .where("familyId", "==", fid)
            .where("role", "==", "elder")
            .onSnapshot(snap => {
                callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }, err => {
                console.error("Error listening to elders:", err);
                callback([]);
            });
    }

    listenCaregivers(callback) {
        const fid = this.getFamilyId();
        if (!fid) { callback([]); return () => {}; }

        return this.collection
            .where("familyId", "==", fid)
            .where("role", "in", ["caregiver", "primary_caregiver"])
            .onSnapshot(snap => {
                callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }, err => {
                console.error("Error listening to caregivers:", err);
                callback([]);
            });
    }

    // Overriding getById is not strictly necessary if BaseService works, 
    // but good for safety if we need specific elder logic later.
    async getById(id) {
        try {
            const doc = await this.collection.doc(id).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error("Error fetching elder by ID:", error);
            throw error;
        }
    }
}

class AppointmentService extends BaseService {
    constructor() { super("appointments"); }

    async getUpcoming() {
        const fid = this.getFamilyId();
        if (!fid) return [];

        // Get local system date and time for a precise query that avoids timezone offsets
        const localNow = new Date();
        const year = localNow.getFullYear();
        const month = String(localNow.getMonth() + 1).padStart(2, '0');
        const day = String(localNow.getDate()).padStart(2, '0');
        const hours = String(localNow.getHours()).padStart(2, '0');
        const minutes = String(localNow.getMinutes()).padStart(2, '0');
        const localNowStr = `${year}-${month}-${day}T${hours}:${minutes}`;

        const snap = await this.collection
            .where("familyId", "==", fid)
            .where("date", ">=", localNowStr)
            .orderBy("date", "asc")
            .get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    listenUpcoming(callback) {
        const fid = this.getFamilyId();
        if (!fid) { callback([]); return () => {}; }

        // Get local system date and time for a precise real-time listener without offset issues
        const localNow = new Date();
        const year = localNow.getFullYear();
        const month = String(localNow.getMonth() + 1).padStart(2, '0');
        const day = String(localNow.getDate()).padStart(2, '0');
        const hours = String(localNow.getHours()).padStart(2, '0');
        const minutes = String(localNow.getMinutes()).padStart(2, '0');
        const localNowStr = `${year}-${month}-${day}T${hours}:${minutes}`;

        return this.collection
            .where("familyId", "==", fid)
            .where("date", ">=", localNowStr)
            .orderBy("date", "asc")
            .onSnapshot(snap => {
                callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }, err => {
                console.error("Error listening to upcoming appointments:", err);
                callback([]);
            });
    }

    async schedule(data) {
        return this.save(data);
    }

    async markComplete(id) {
        await this.collection.doc(id).update({
            status: 'completed',
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    }

    /**
     * FAIRNESS ENGINE — Atomic Write.
     * Marks the shift as completed and increments the caregiver's counter by +1 in a single batch operation.
     * This ensures consistency: if one write fails, both fail.
     */
    async markShiftCompleted(appointmentId, caregiverUid) {
        const batch = this.db.batch();

        // Operation 1: Mark appointment as completed
        const appointmentRef = this.collection.doc(appointmentId);
        batch.update(appointmentRef, {
            status: 'completed',
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Operation 2: Atomic increment of the caregiver's counter
        const userRef = this.db.collection('users').doc(caregiverUid);
        batch.update(userRef, {
            totalShiftsCompleted: firebase.firestore.FieldValue.increment(1)
        });

        await batch.commit();
        return true;
    }
}

class HealthService extends BaseService {
    constructor() { super("health_records"); }

    async getRecent() {
        const fid = this.getFamilyId();
        if (!fid) return [];

        // Note: Requires composite index on [familyId, timestamp]
        // If index is missing, remove .orderBy or create it in Firebase Console
        const snap = await this.collection
            .where("familyId", "==", fid)
            .orderBy("timestamp", "desc")
            .limit(20)
            .get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    listenRecent(callback) {
        const fid = this.getFamilyId();
        if (!fid) { callback([]); return () => {}; }

        return this.collection
            .where("familyId", "==", fid)
            .orderBy("timestamp", "desc")
            .limit(20)
            .onSnapshot(snap => {
                callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }, err => {
                console.error("Error listening to recent health records:", err);
                callback([]);
            });
    }

    async logVisit(data) {
        const fid = this.getFamilyId();
        await this.collection.add({
            ...data,
            familyId: fid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    }
}

class MedicationService extends BaseService {
    constructor() {
        super("medications");
        this.logsCollection = this.db.collection("medication_logs");
    }

    async getAll() {
        const fid = this.getFamilyId();
        if (!fid) return [];

        const user = JSON.parse(localStorage.getItem('currentUser'));
        const isCaregiver = user && (user.role === 'caregiver' || user.role === 'primary_caregiver');

        let query = this.collection.where("familyId", "==", fid);
        if (!isCaregiver && user) {
            query = query.where("elderId", "==", user.uid);
        }

        const snap = await query.get();
        let meds = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return meds.sort((a, b) => (a.time > b.time) ? 1 : -1);
    }

    async getLogsByDate(dateStr) {
        const fid = this.getFamilyId();

        const snap = await this.logsCollection
            .where("familyId", "==", fid)
            .where("date", "==", dateStr)
            .get();

        const logs = Object.create(null);
        snap.forEach(doc => {
            // Safe assignment to avoid prototype pollution vulnerability
            safeSet(logs, doc.data().medId, true);
        });
        return logs;
    }

    listenAll(callback) {
        const fid = this.getFamilyId();
        if (!fid) { callback([]); return () => {}; }

        const user = JSON.parse(localStorage.getItem('currentUser'));
        const isCaregiver = user && (user.role === 'caregiver' || user.role === 'primary_caregiver');

        let query = this.collection.where("familyId", "==", fid);
        if (!isCaregiver && user) {
            query = query.where("elderId", "==", user.uid);
        }

        return query.onSnapshot(snap => {
                let meds = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                meds.sort((a, b) => (a.time > b.time) ? 1 : -1);
                callback(meds);
            }, err => {
                console.error("Error listening to meds:", err);
                callback([]);
            });
    }

    listenLogsByDate(dateStr, callback) {
        const fid = this.getFamilyId();
        if (!fid) { callback({}); return () => {}; }

        return this.logsCollection
            .where("familyId", "==", fid)
            .where("date", "==", dateStr)
            .onSnapshot(snap => {
                const logs = Object.create(null);
                snap.forEach(doc => {
                    // Safe assignment to avoid prototype pollution vulnerability
                    safeSet(logs, doc.data().medId, true);
                });
                callback(logs);
            }, err => {
                console.error("Error listening to med logs:", err);
                callback({});
            });
    }

    async markAsTaken(medId, medName, userName, dateStrOverride = null) {
        const fid = this.getFamilyId();
        const dateLog = dateStrOverride || new Date().toISOString().split('T')[0];

        await this.logsCollection.add({
            medId,
            medName,
            takenBy: userName,
            date: dateLog,
            familyId: fid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    }

    async checkForMissedMeds(currentUser) {
        if (!currentUser) return 0;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        const dayIndex = yesterday.getDay(); 

        const [meds, logs] = await Promise.all([
            this.getAll(),
            this.getLogsByDate(dateStr)
        ]);

        const missedMeds = meds.filter(med => {
            const isScheduled = (med.frequency === 'daily') ||
                (med.frequency === 'specific' && med.days && med.days.includes(dayIndex));
            // Safe access to avoid dynamic bracket notation warnings
            const isTaken = safeGet(logs, med.id);
            
            // Should be taken, wasn't taken, and started before yesterday
            const startedBeforeYesterday = !med.startDate || med.startDate <= dateStr;

            return isScheduled && !isTaken && startedBeforeYesterday;
        });

        if (missedMeds.length === 0) return 0;

        const historyKey = `alerted_missed_${dateStr}_${currentUser.uid}`;
        const alreadyAlerted = localStorage.getItem(historyKey);

        if (alreadyAlerted) return 0;

        const notifService = window.notificationService;
        let alertCount = 0;

        for (const med of missedMeds) {
            await notifService.save({
                recipientId: currentUser.uid, 
                title: "Missed Medication",
                message: `⚠️ Missed Yesterday (${dateStr}): ${med.name} was not logged.`,
                type: "urgent",
                isRead: false,
                read: false
            });
            alertCount++;
        }

        localStorage.setItem(historyKey, "true");
        return alertCount;
    }
}

class ScheduleService extends BaseService {
    constructor() { 
        super("shifts"); 
        this.usersCollection = this.db.collection("users");
        this.appointmentsCollection = this.db.collection("appointments");
    }

    async getLeastBusyCaregiver(familyId) {
        try {
            const snap = await this.usersCollection
                .where('familyId', '==', familyId)
                .where('role', 'in', ['caregiver', 'primary_caregiver'])
                .get();

            if (snap.empty) return null;

            let caregivers = [];
            snap.forEach(doc => {
                const data = doc.data();
                caregivers.push({
                    uid: doc.id,
                    name: data.name,
                    totalShiftsCompleted: data.totalShiftsCompleted || 0,
                    pendingShifts: 0
                });
            });

            // Get local system date and time for precise date queries without UTC bias
            const localNow = new Date();
            const year = localNow.getFullYear();
            const month = String(localNow.getMonth() + 1).padStart(2, '0');
            const day = String(localNow.getDate()).padStart(2, '0');
            const hours = String(localNow.getHours()).padStart(2, '0');
            const minutes = String(localNow.getMinutes()).padStart(2, '0');
            const localNowStr = `${year}-${month}-${day}T${hours}:${minutes}`;

            const apptsSnap = await this.appointmentsCollection
                .where('familyId', '==', familyId)
                .where('date', '>=', localNowStr)
                .get();

            apptsSnap.forEach(doc => {
                const appt = doc.data();
                if (appt.status !== 'completed' && appt.assignedToName) {
                    const caregiver = caregivers.find(c => c.name === appt.assignedToName || c.uid === appt.assignedToId);
                    if (caregiver) {
                        caregiver.pendingShifts += 1;
                    }
                }
            });

            // Assign a stable random factor per execution for consistent tie-breaking resolution
            const enriched = caregivers.map(c => ({
                uid: c.uid,
                name: c.name,
                totalShiftsCompleted: c.totalShiftsCompleted,
                pendingShifts: c.pendingShifts,
                effectiveWorkload: c.totalShiftsCompleted + c.pendingShifts,
                randomTieBreaker: Math.random()
            }));

            enriched.sort((a, b) => {
                if (a.effectiveWorkload !== b.effectiveWorkload) {
                    return a.effectiveWorkload - b.effectiveWorkload;
                }
                return a.randomTieBreaker - b.randomTieBreaker;
            });

            return {
                uid: enriched[0].uid,
                name: enriched[0].name,
                totalShiftsCompleted: enriched[0].totalShiftsCompleted,
                pendingShifts: enriched[0].pendingShifts,
                effectiveWorkload: enriched[0].effectiveWorkload
            };
        } catch (error) {
            console.error('Fairness Engine v3 Error:', error);
            return null;
        }
    }

    async calculateFairnessPriority(familyId, targetDate) {
        return this.getLeastBusyCaregiver(familyId);
    }

    async getShifts(startDate, endDate) {
        const fid = this.getFamilyId();
        const snap = await this.collection
            .where("familyId", "==", fid)
            .where("date", ">=", startDate)
            .where("date", "<=", endDate)
            .get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async assignShift(shiftData) {
        const fid = this.getFamilyId();

        const snap = await this.collection
            .where("familyId", "==", fid)
            .where("date", "==", shiftData.date)
            .get();

        if (!snap.empty) {
            const docId = snap.docs[0].id;
            await this.collection.doc(docId).update(shiftData);
        } else {
            await this.collection.add({
                ...shiftData,
                familyId: fid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        return true;
    }

    async clearDay(dateStr) {
        const fid = this.getFamilyId();
        const snap = await this.collection
            .where("familyId", "==", fid)
            .where("date", "==", dateStr)
            .get();
        const batch = this.db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        return true;
    }
}

class NotificationService extends BaseService {
    constructor() { super("notifications"); }

    async getUnreadCount() {
        const fid = this.getFamilyId();
        if (!fid) return 0;

        const snap = await this.collection
            .where("familyId", "==", fid)
            .where("isRead", "==", false)
            .get();
        return snap.size;
    }

    async markRead(id) {
        await this.collection.doc(id).update({ isRead: true, read: true });
    }

    async clearAll() {
        const fid = this.getFamilyId();
        const snap = await this.collection
            .where("familyId", "==", fid)
            .where("isRead", "==", false)
            .get();

        const batch = this.db.batch();
        snap.forEach(doc => batch.update(doc.ref, { isRead: true, read: true }));
        await batch.commit();
    }
}

class ReportService extends BaseService {
    constructor() { 
        super("reporting_dummy");
        this.usersCollection = this.db.collection("users");
        this.appointmentsCollection = this.db.collection("appointments");
        this.healthCollection = this.db.collection("health_records");
        this.medicationsCollection = this.db.collection("medications");
        this.medicationLogsCollection = this.db.collection("medication_logs");
    }

    async getComprehensiveMonthlySummary(year, month) {
        // Security Rule Validation: Strictly Caregivers Only
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user || (user.role !== 'caregiver' && user.role !== 'primary_caregiver')) {
            throw new Error("Access Denied: Reports are strictly for caregivers.");
        }
        
        const fid = this.getFamilyId();
        if (!fid) return null;

        // Optimization: Strict bounding of date ranges directly in queries 
        // to prevent over-fetching and minimize Firebase read quotas.
        const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01T00:00`;
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        const endDateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01T00:00`;
        
        const startTimestamp = new Date(startDateStr);
        const endTimestamp = new Date(endDateStr);

        const dateOnlyStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const dateOnlyEnd = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;

        // Concurrent reads for maximum performance with optimized query constraints
        // EXACTLY 5 QUERIES using Promise.all
        const [usersSnap, apptsSnap, healthSnap, medsSnap, medLogsSnap] = await Promise.all([
            this.usersCollection.where("familyId", "==", fid).where("role", "in", ["caregiver", "primary_caregiver"]).get(),
            this.appointmentsCollection.where("familyId", "==", fid).where("date", ">=", startDateStr).where("date", "<", endDateStr).get(),
            this.healthCollection.where("familyId", "==", fid).where("timestamp", ">=", startTimestamp).where("timestamp", "<", endTimestamp).get(),
            this.medicationsCollection.where("familyId", "==", fid).get(),
            this.medicationLogsCollection.where("familyId", "==", fid).where("date", ">=", dateOnlyStart).where("date", "<", dateOnlyEnd).get()
        ]);
        
        // 1. Caregiver Accountability (In-Memory Processing)
        const caregiversMap = new Map();
        usersSnap.forEach(doc => {
            const data = doc.data();
            caregiversMap.set(doc.id, {
                id: doc.id,
                name: data.name,
                lifetimeShifts: data.totalShiftsCompleted || 0,
                shiftsThisMonth: 0
            });
        });

        // 2. Appointments & Missed Appointments
        let missedAppointments = [];
        const now = new Date();
        let totalAppointments = 0;
        let completedAppointments = 0;

        apptsSnap.forEach(doc => {
            const appt = { id: doc.id, ...doc.data() };
            totalAppointments++;
            
            if (appt.status === 'completed') {
                completedAppointments++;
                if (appt.assignedToId && caregiversMap.has(appt.assignedToId)) {
                    caregiversMap.get(appt.assignedToId).shiftsThisMonth++;
                }
            } else {
                const apptDate = new Date(appt.date);
                if (apptDate < now) {
                    missedAppointments.push(appt);
                }
            }
        });

        const caregivers = Array.from(caregiversMap.values()).sort((a, b) => b.lifetimeShifts - a.lifetimeShifts);

        // 3. Clinical Averages & Incident Breakdown
        let sysSum = 0, diaSum = 0, hrSum = 0, bpCount = 0, hrCount = 0;
        let bpReadings = [];
        let criticalIncidents = [];
        let totalHealthLogs = 0;

        healthSnap.forEach(doc => {
            totalHealthLogs++;
            const data = doc.data();
            const recordDate = data.date || (data.timestamp ? data.timestamp.toDate().toISOString().split('T')[0] : '');

            if (data.bp && data.bp.includes('/')) {
                const [sys, dia] = data.bp.split('/').map(Number);
                sysSum += sys;
                diaSum += dia;
                bpCount++;

                bpReadings.push({ date: recordDate, sys, dia });

                if (sys >= 140 || dia >= 90) {
                    criticalIncidents.push({
                        date: recordDate,
                        reading: data.bp,
                        logger: data.loggedBy || data.recordedBy || 'System/Team'
                    });
                }
            }

            if (data.hr) {
                hrSum += Number(data.hr);
                hrCount++;
            }
        });

        bpReadings.sort((a, b) => a.date.localeCompare(b.date));

        const clinicalAverages = {
            sys: bpCount > 0 ? Math.round(sysSum / bpCount) : 0,
            dia: bpCount > 0 ? Math.round(diaSum / bpCount) : 0,
            hr: hrCount > 0 ? Math.round(hrSum / hrCount) : 0
        };

        // 4. Medical Adherence
        const meds = medsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const medLogs = medLogsSnap.docs.map(doc => doc.data());
        
        let expectedDoses = 0;
        let takenDoses = 0;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
            const d = new Date(year, month, day);
            const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const dayIndex = d.getDay();
            
            meds.forEach(med => {
                if (med.startDate && dayStr < med.startDate) return;
                if (med.endDate && dayStr > med.endDate) return;
                
                let isScheduled = false;
                if (med.frequency === 'daily') isScheduled = true;
                if (med.frequency === 'specific' && med.days && med.days.includes(dayIndex)) isScheduled = true;
                
                if (isScheduled) {
                    expectedDoses++;
                    const hasLog = medLogs.some(l => l.medId === med.id && l.date === dayStr);
                    if (hasLog) takenDoses++;
                }
            });
        }

        const medicalAdherence = expectedDoses === 0 ? 100 : Math.round((takenDoses / expectedDoses) * 100);

        return {
            totalAppointments,
            completedAppointments,
            totalHealthLogs,
            criticalAlerts: criticalIncidents.length,
            medicalAdherence,
            clinicalAverages,
            bpReadings,
            criticalIncidents,
            missedAppointments,
            caregivers
        };
    }
}

// ---------------------------------------------------------
// INITIALIZE ALL SERVICES
// ---------------------------------------------------------
window.elderService = new ElderService();
window.appointmentService = new AppointmentService();
window.healthService = new HealthService();
window.medicationService = new MedicationService();
window.scheduleService = new ScheduleService();
window.notificationService = new NotificationService();
window.reportService = new ReportService();