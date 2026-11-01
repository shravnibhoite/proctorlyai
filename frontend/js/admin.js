document.addEventListener('DOMContentLoaded', () => {
    // 1. Sidebar Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    const panels = document.querySelectorAll('.panel');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(n => n.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');

            // Load data when a specific tab is opened
            if(targetId === 'panel-home') loadDashboardStats();
            if(targetId === 'panel-exams') loadExams();
            if(targetId === 'panel-students') loadStudents();
            if(targetId === 'panel-reports') loadReports();
            if(targetId === 'panel-settings') loadSettings();
        });
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('proctorly_user');
        window.location.href = '/';
    });

    // 2. Fetch API Data
    async function loadDashboardStats() {
        try {
            const res = await fetch('/api/admin/stats');
            const data = await res.json();
            document.getElementById('stat-students').innerText = data.total_students || 0;
            document.getElementById('stat-exams').innerText = data.active_exams || 0;
            document.getElementById('stat-flagged').innerText = data.flagged_students || 0;
        } catch(e) { console.error("Error loading stats:", e); }
    }

    async function loadExams() {
        try {
            const res = await fetch('/api/exams');
            const exams = await res.json();
            const tbody = document.getElementById('exam-list');
            tbody.innerHTML = '';
            if(exams.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No exams found</td></tr>';
                return;
            }
            exams.forEach(ex => {
                tbody.innerHTML += `<tr>
                    <td style="font-weight:bold; color:var(--primary);">${ex.exam_code}</td>
                    <td>${ex.subject}</td>
                    <td>${ex.duration_minutes} mins</td>
                    <td><span class="badge badge-ongoing">${ex.status}</span></td>
                </tr>`;
            });
        } catch(e) { console.error("Error loading exams:", e); }
    }

    async function loadStudents() {
        try {
            const res = await fetch('/api/students');
            const students = await res.json();
            const tbody = document.getElementById('student-list');
            tbody.innerHTML = '';
            if(!students || students.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No students found</td></tr>';
                return;
            }
            students.forEach(st => {
                tbody.innerHTML += `<tr>
                    <td>#${st.id}</td>
                    <td>${st.username}</td>
                    <td>${st.full_name}</td>
                    <td><button class="btn" style="background:rgba(255,255,255,0.1); color:white; padding:6px 12px;">Reset Face ID</button></td>
                </tr>`;
            });
        } catch(e) { console.error("Error loading students:", e); }
    }

    async function loadReports() {
        try {
            const res = await fetch('/api/sessions'); // Reusing old sessions endpoint for now
            const sessions = await res.json();
            const tbody = document.getElementById('reports-list');
            tbody.innerHTML = '';
            if(!sessions || sessions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No reports found</td></tr>';
                return;
            }
            sessions.forEach(s => {
                let badge = s.status === 'ongoing' ? 'badge-ongoing' : (s.status === 'flagged' ? 'badge-flagged' : 'badge-completed');
                let action = s.status !== 'ongoing' ? `<a href="/api/sessions/${s.id}/report" target="_blank" style="color:var(--primary);">Download PDF</a>` : '-';
                tbody.innerHTML += `<tr>
                    <td>#${s.id}</td>
                    <td>${s.username}</td>
                    <td><span class="badge ${badge}">${s.status.toUpperCase()}</span></td>
                    <td style="color:${s.risk_score >= 75 ? '#ef4444' : '#4ade80'}; font-weight:bold;">${s.risk_score.toFixed(1)}</td>
                    <td>${action}</td>
                </tr>`;
            });
        } catch(e) { console.error("Error loading reports:", e); }
    }

    async function loadSettings() {
        try {
            const res = await fetch('/api/settings');
            const settings = await res.json();
            if(settings.warning_limit) document.getElementById('set-warning-limit').value = settings.warning_limit;
            if(settings.ai_sensitivity) document.getElementById('set-sensitivity').value = settings.ai_sensitivity;
        } catch(e) { console.error("Error loading settings:", e); }
    }

    // 3. Create Exam Action
    document.getElementById('btn-create-exam').addEventListener('click', async () => {
        const subject = document.getElementById('exam-subject').value;
        const duration = parseInt(document.getElementById('exam-duration').value);
        if(!subject || !duration) return alert("Fill subject and duration");

        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        try {
            const res = await fetch('/api/exams', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ subject, duration_minutes: duration, exam_code: code, questions_count: 0 })
            });
            if(res.ok) {
                document.getElementById('exam-code-display').innerText = `Exam Created! Code: ${code}`;
                setTimeout(() => loadExams(), 500);
            }
        } catch(e) { alert("Error creating exam"); }
    });

    // Save Settings
    document.getElementById('btn-save-settings').addEventListener('click', async () => {
        const warn = document.getElementById('set-warning-limit').value;
        const sens = document.getElementById('set-sensitivity').value;
        await fetch('/api/settings', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ key: 'warning_limit', value: warn }) });
        await fetch('/api/settings', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ key: 'ai_sensitivity', value: sens }) });
        alert("Settings Saved!");
    });

    // 4. WebSocket Live Monitoring & AI Alerts
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    let adminWs;
    
    function connectAdminWs() {
        adminWs = new WebSocket(`${wsProto}//${window.location.host}/ws/admin/monitor`);

        adminWs.onopen = () => {
            document.getElementById('live-connection-status').innerText = 'Connected';
            document.getElementById('live-connection-status').className = 'badge badge-completed';
        };

        adminWs.onclose = () => {
            document.getElementById('live-connection-status').innerText = 'Disconnected';
            document.getElementById('live-connection-status').className = 'badge badge-flagged';
            // Reconnect logic
            setTimeout(connectAdminWs, 5000);
        };

        adminWs.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'video_frame') {
                updateLiveGrid(data.user_id, data.username, data.frame, data.status);
            } else if (data.type === 'alert') {
                // Log to alert panel
                addAlertToPanel(data.username, data.alert, data.severity);
                // Highlight live grid feed
                if (data.frame) {
                    updateLiveGrid(data.user_id, data.username, data.frame, 'flagged');
                }
            } else if (data.type === 'disconnect') {
                removeLiveGrid(data.user_id);
            }
        };
    }
    connectAdminWs();

    function updateLiveGrid(userId, username, frameB64, status) {
        const grid = document.getElementById('live-grid');
        if (!grid) return;
        
        let feedBox = document.getElementById(`feed-${userId}`);
        
        if (!feedBox) {
            feedBox = document.createElement('div');
            feedBox.id = `feed-${userId}`;
            feedBox.className = 'student-feed';
            feedBox.innerHTML = `
                <img id="vid-${userId}" style="width:100%; height:100%; object-fit:cover;" />
                <div class="feed-overlay">
                    <span style="font-weight:600;">${username}</span>
                    <span class="badge badge-ongoing" id="status-${userId}">Live</span>
                </div>
            `;
            grid.appendChild(feedBox);
        }
        
        document.getElementById(`vid-${userId}`).src = frameB64;
        
        if (status === 'flagged') {
            feedBox.classList.add('flagged');
            setTimeout(() => {
                if (feedBox) feedBox.classList.remove('flagged');
            }, 3000); // Remove red border after 3 sec
        }
    }

    function removeLiveGrid(userId) {
        const feedBox = document.getElementById(`feed-${userId}`);
        if(feedBox) feedBox.remove();
    }

    function addAlertToPanel(username, alertMsg, severity) {
        const list = document.getElementById('ai-alerts-list');
        if (!list) return;
        
        const item = document.createElement('div');
        const sevClass = severity === 'high' ? 'severity-high' : 'severity-medium';
        const time = new Date().toLocaleTimeString();
        
        item.className = `alert-item ${sevClass}`;
        item.innerHTML = `
            <div>
                <strong>${username}</strong> 
                <span style="color:var(--text-muted); margin:0 8px;">|</span>
                ${alertMsg}
            </div>
            <span class="time">${time}</span>
        `;
        list.insertBefore(item, list.firstChild);
        
        // Keep only last 50 alerts
        if(list.children.length > 50) {
            list.lastChild.remove();
        }
    }

    // Initial load for Home Panel
    loadDashboardStats();
});
