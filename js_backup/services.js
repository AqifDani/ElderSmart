// js/services.js - COMPLETE & FINAL

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
    constructor() { super("users"); }

    async getAll() {
        const fid = this.getFamilyId();
        if (!fid) return [];

        try {
            // Fetch users who are specifically ELDERS in this family
            const snap = await this.collection
                .where("familyId", "==", fid)
                .where("role", "==", "elder")
                .get();
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching elders:", error);
            return [];
        }
    }

    async getCaregivers() {
        const fid = this.getFamilyId();
        if (!fid) return [];

        try {
            const snap = await this.collection
                .where("familyId", "==", fid)
                .where("role", "==", "caregiver")
                .get();
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching caregivers:", error);
            return [];
        }
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

        const now = new Date().toISOString();
        const snap = await this.collection
            .where("familyId", "==", fid)
            .where("date", ">=", now)
            .orderBy("date", "asc")
            .get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

        const snap = await this.collection.where("familyId", "==", fid).get();
        let meds = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return meds.sort((a, b) => (a.time > b.time) ? 1 : -1);
    }

    async getLogsByDate(dateStr) {
        const fid = this.getFamilyId();

        const snap = await this.logsCollection
            .where("familyId", "==", fid)
            .where("date", "==", dateStr)
            .get();

        const logs = {};
        snap.forEach(doc => { logs[doc.data().medId] = true; });
        return logs;
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
            const isTaken = logs[med.id];
            
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
    constructor() { super("shifts"); }

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

// ---------------------------------------------------------
// INITIALIZE ALL SERVICES
// ---------------------------------------------------------
window.elderService = new ElderService();
window.appointmentService = new AppointmentService();
window.healthService = new HealthService();
window.medicationService = new MedicationService();
window.scheduleService = new ScheduleService();
window.notificationService = new NotificationService();