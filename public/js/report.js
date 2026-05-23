// js/report.js - Reporting and Summary Module

document.addEventListener("DOMContentLoaded", () => {
    // 1. Wrap the entire report generation in onAuthStateChanged to prevent race conditions 
    // where queries execute before the Firebase auth session is asynchronously attached.
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // 2. Authentication Guard (Caregiver Strictly)
        const userStr = localStorage.getItem('currentUser');
        if (!userStr) {
            window.location.href = 'login.html';
            return;
        }
        
        const currentUser = JSON.parse(userStr);
        if (currentUser.role !== 'caregiver' && currentUser.role !== 'primary_caregiver') {
            alert("Unauthorized Access. This page is strictly for caregivers.");
            window.location.href = 'login.html';
            return;
        }

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthSelect = document.getElementById('reportMonthSelect');

        // 3. Dynamically populate the selector with the last 12 calendar months
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const opt = document.createElement('option');
            opt.value = `${d.getFullYear()}-${d.getMonth()}`; // value holds "YYYY-M" (e.g., "2026-4")
            opt.textContent = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            monthSelect.appendChild(opt);
        }

        // 4. Function to show skeleton loading state
        function showSkeletons() {
            ['metricAppointments', 'metricAlerts', 'metricHealthLogs'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = '--';
                    el.classList.add('skeleton', 'skeleton-text-short');
                }
            });
            document.getElementById('totalAppointmentsLabel').textContent = 'out of -- total scheduled';
            document.getElementById('reportMonthLabel').textContent = 'Loading...';
            document.getElementById('reportLeaderboardBody').innerHTML = `
                <tr><td colspan="2" class="p-6 text-center text-muted">Loading report data...</td></tr>
            `;
        }

        // 5. Function to fetch and render report data
        async function loadReportForMonth(year, month) {
            showSkeletons();
            document.getElementById('reportMonthLabel').textContent = `${monthNames[month]} ${year}`;

            try {
                if (!window.reportService) {
                    throw new Error("ReportService not initialized. Check services.js.");
                }
                
                const summary = await window.reportService.getMonthlySummary(year, month);
                
                if (!summary) {
                    throw new Error("Failed to load summary data.");
                }

                // Render metrics
                const metricAppts = document.getElementById('metricAppointments');
                metricAppts.classList.remove('skeleton', 'skeleton-text-short');
                metricAppts.textContent = summary.completedAppointments;
                
                document.getElementById('totalAppointmentsLabel').textContent = `out of ${summary.totalAppointments} total scheduled`;

                const metricAlerts = document.getElementById('metricAlerts');
                metricAlerts.classList.remove('skeleton', 'skeleton-text-short');
                metricAlerts.textContent = summary.criticalAlerts;

                const metricHealth = document.getElementById('metricHealthLogs');
                metricHealth.classList.remove('skeleton', 'skeleton-text-short');
                metricHealth.textContent = summary.totalHealthLogs;

                // Render leaderboard
                const leaderboardBody = document.getElementById('reportLeaderboardBody');
                leaderboardBody.innerHTML = '';

                if (summary.caregivers.length === 0) {
                    leaderboardBody.innerHTML = `<tr><td colspan="2" class="p-6 text-center text-muted">No caregivers found in this family network.</td></tr>`;
                } else {
                    summary.caregivers.forEach(cg => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td class="font-bold text-main" style="padding: 16px; border-bottom: 1px solid var(--border);">${cg.name}</td>
                            <td class="text-right" style="padding: 16px; border-bottom: 1px solid var(--border);">
                                <span style="background: var(--primary-light); color: var(--primary); padding: 6px 14px; border-radius: 12px; font-weight: 800; font-size: 14px;">
                                    ${cg.totalShiftsCompleted} Shifts
                                </span>
                            </td>
                        `;
                        leaderboardBody.appendChild(tr);
                    });
                }
                
            } catch (error) {
                console.error("Report Generation Error:", error);
                
                // Show clean error status
                ['metricAppointments', 'metricAlerts', 'metricHealthLogs'].forEach(id => {
                    const el = document.getElementById(id);
                    if(el) {
                        el.classList.remove('skeleton', 'skeleton-text-short');
                        el.textContent = "Err";
                    }
                });
                document.getElementById('reportLeaderboardBody').innerHTML = `<tr><td colspan="2" class="p-6 text-center text-danger">Error loading report data. Check console for details.</td></tr>`;
            }
        }

        // 6. Bind dropdown change listener
        monthSelect.addEventListener('change', (e) => {
            const [year, month] = e.target.value.split('-').map(Number);
            loadReportForMonth(year, month);
        });

        // 7. Load default first option (current month)
        const [defaultYear, defaultMonth] = monthSelect.value.split('-').map(Number);
        loadReportForMonth(defaultYear, defaultMonth);
    });
});
