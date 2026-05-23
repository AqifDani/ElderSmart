// js/report.js - Reporting and Summary Module

let bpChartInstance = null;
let adherenceChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    // 1. Wrap the entire report generation in onAuthStateChanged
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
            opt.value = `${d.getFullYear()}-${d.getMonth()}`; // "YYYY-M"
            opt.textContent = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            monthSelect.appendChild(opt);
        }

        // 4. Function to show skeleton loading state
        function showSkeletons() {
            ['metricAppointments', 'metricAlerts', 'metricHealthLogs', 'metricAdherence'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = '--';
                    el.classList.add('skeleton', 'skeleton-text-short');
                }
            });
            document.getElementById('totalAppointmentsLabel').textContent = 'out of -- total';
            document.getElementById('reportMonthLabel').textContent = 'Loading...';
            
            document.getElementById('reportIncidentsBody').innerHTML = `<tr><td colspan="3" class="p-6 text-center text-muted">Loading...</td></tr>`;
            document.getElementById('reportMissedAppointmentsBody').innerHTML = `<tr><td colspan="3" class="p-6 text-center text-muted">Loading...</td></tr>`;
            document.getElementById('reportLeaderboardBody').innerHTML = `<tr><td colspan="3" class="p-6 text-center text-muted">Loading...</td></tr>`;
        }

        // 5. Render Charts
        function renderCharts(summary) {
            // BP Trends Chart
            const bpCtx = document.getElementById('healthTrendsChart');
            if (bpCtx) {
                if (bpChartInstance) bpChartInstance.destroy();
                
                const labels = summary.bpReadings.map(r => r.date);
                const sysData = summary.bpReadings.map(r => r.sys);
                const diaData = summary.bpReadings.map(r => r.dia);

                bpChartInstance = new Chart(bpCtx, {
                    type: 'line',
                    data: {
                        labels: labels.length ? labels : ['No Data'],
                        datasets: [
                            {
                                label: 'Systolic BP',
                                data: sysData.length ? sysData : [0],
                                borderColor: '#dc3545',
                                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                                tension: 0.3,
                                fill: true
                            },
                            {
                                label: 'Diastolic BP',
                                data: diaData.length ? diaData : [0],
                                borderColor: '#0d6efd',
                                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                                tension: 0.3,
                                fill: true
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' }
                        },
                        scales: {
                            y: { beginAtZero: false, suggestedMin: 50, suggestedMax: 160 }
                        }
                    }
                });
            }

            // Adherence Chart
            const adCtx = document.getElementById('adherenceChart');
            if (adCtx) {
                if (adherenceChartInstance) adherenceChartInstance.destroy();
                
                adherenceChartInstance = new Chart(adCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Taken', 'Missed/Pending'],
                        datasets: [{
                            data: [summary.medicalAdherence, Math.max(0, 100 - summary.medicalAdherence)],
                            backgroundColor: ['#137333', '#f1f5f9'],
                            borderWidth: 0,
                            cutout: '75%'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                });
            }
        }

        // 6. Function to fetch and render report data
        async function loadReportForMonth(year, month) {
            showSkeletons();
            document.getElementById('reportMonthLabel').textContent = `${monthNames[month]} ${year}`;

            try {
                if (!window.reportService) {
                    throw new Error("ReportService not initialized.");
                }
                
                const summary = await window.reportService.getComprehensiveMonthlySummary(year, month);
                
                if (!summary) throw new Error("Failed to load summary data.");

                // Render Top Metric Cards
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

                const metricAdherence = document.getElementById('metricAdherence');
                metricAdherence.classList.remove('skeleton', 'skeleton-text-short');
                metricAdherence.textContent = `${summary.medicalAdherence}%`;

                // Render Charts
                renderCharts(summary);

                // Render Incidents Table
                const incidentsBody = document.getElementById('reportIncidentsBody');
                incidentsBody.innerHTML = '';
                if (summary.criticalIncidents.length === 0) {
                    incidentsBody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-success font-bold"><i class="fas fa-check-circle mr-2"></i>No critical incidents recorded.</td></tr>`;
                } else {
                    summary.criticalIncidents.forEach(inc => {
                        incidentsBody.innerHTML += `
                            <tr>
                                <td style="padding: 16px; border-bottom: 1px solid var(--border);">${inc.date}</td>
                                <td style="padding: 16px; border-bottom: 1px solid var(--border);"><span class="badge bg-danger text-white">${inc.reading}</span></td>
                                <td style="padding: 16px; border-bottom: 1px solid var(--border);">${inc.logger}</td>
                            </tr>
                        `;
                    });
                }

                // Render Missed Appointments Table
                const missedBody = document.getElementById('reportMissedAppointmentsBody');
                missedBody.innerHTML = '';
                if (summary.missedAppointments.length === 0) {
                    missedBody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-success font-bold"><i class="fas fa-check-circle mr-2"></i>Perfect attendance.</td></tr>`;
                } else {
                    summary.missedAppointments.forEach(appt => {
                        const dateObj = new Date(appt.date);
                        const displayDate = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        missedBody.innerHTML += `
                            <tr>
                                <td style="padding: 16px; border-bottom: 1px solid var(--border);">${displayDate}</td>
                                <td style="padding: 16px; border-bottom: 1px solid var(--border);">${appt.title || 'Visit'}</td>
                                <td style="padding: 16px; border-bottom: 1px solid var(--border);">${appt.assignedToName || 'Unassigned'}</td>
                            </tr>
                        `;
                    });
                }

                // Render Leaderboard Table
                const leaderboardBody = document.getElementById('reportLeaderboardBody');
                leaderboardBody.innerHTML = '';
                if (summary.caregivers.length === 0) {
                    leaderboardBody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-muted">No caregivers found in this family network.</td></tr>`;
                } else {
                    summary.caregivers.forEach(cg => {
                        leaderboardBody.innerHTML += `
                            <tr>
                                <td class="font-bold text-main" style="padding: 16px; border-bottom: 1px solid var(--border);">${cg.name}</td>
                                <td class="text-center font-bold" style="padding: 16px; border-bottom: 1px solid var(--border);">${cg.shiftsThisMonth}</td>
                                <td class="text-right" style="padding: 16px; border-bottom: 1px solid var(--border);">
                                    <span style="background: var(--primary-light); color: var(--primary); padding: 6px 14px; border-radius: 12px; font-weight: 800; font-size: 14px;">
                                        ${cg.lifetimeShifts} Shifts
                                    </span>
                                </td>
                            </tr>
                        `;
                    });
                }
                
            } catch (error) {
                console.error("Report Generation Error:", error);
                
                // Show clean error status
                ['metricAppointments', 'metricAlerts', 'metricHealthLogs', 'metricAdherence'].forEach(id => {
                    const el = document.getElementById(id);
                    if(el) {
                        el.classList.remove('skeleton', 'skeleton-text-short');
                        el.textContent = "Err";
                    }
                });
                
                const errRow = `<tr><td colspan="3" class="p-6 text-center text-danger">Error loading report data. Check console for details.</td></tr>`;
                document.getElementById('reportIncidentsBody').innerHTML = errRow;
                document.getElementById('reportMissedAppointmentsBody').innerHTML = errRow;
                document.getElementById('reportLeaderboardBody').innerHTML = errRow;
            }
        }

        // 7. Bind dropdown change listener
        monthSelect.addEventListener('change', (e) => {
            const [year, month] = e.target.value.split('-').map(Number);
            loadReportForMonth(year, month);
        });

        // 8. Load default first option (current month)
        const [defaultYear, defaultMonth] = monthSelect.value.split('-').map(Number);
        loadReportForMonth(defaultYear, defaultMonth);
    });
});
