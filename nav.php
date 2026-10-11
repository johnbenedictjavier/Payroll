<nav class="navbar navbar-expand-lg navbar-dark aura-navbar py-2 px-4">
    <div class="container-fluid">
        <a class="navbar-brand d-flex align-items-center" href="index.php">
            <span class="aura-logo"><img src="lcc.png" class="" alt="" style="width: 45px; margin-right: 5px;">LCC PORTAL</span>
            <span class="aura-tagline d-none d-md-inline">Admin Payroll System</span>
        </a>

        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav me-auto">
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle px-3" href="#" role="button" data-bs-toggle="dropdown">EMPLOYEE</a>
                    <ul class="dropdown-menu shadow">
                        <li><a class="dropdown-item" href="dep_and_pos.php"><i class="fas fa-university me-2"></i>Department and Positions</a></li>
                        <li><a class="dropdown-item" href="employee.php"><i class="fas fa-id-badge me-2"></i>Employee Information</a></li>
                    </ul>
                </li>
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle px-3" href="#" role="button" data-bs-toggle="dropdown">LOANS</a>
                    <ul class="dropdown-menu shadow">
                        <li><a class="dropdown-item">Sample Only</a></li>
                    </ul>
                </li>
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle px-3" href="#" role="button" data-bs-toggle="dropdown">PAYROLL</a>
                    <ul class="dropdown-menu shadow">
                        <li><a class="dropdown-item">Sample Only</a></li>
                    </ul>
                </li>
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle px-3" href="#" role="button" data-bs-toggle="dropdown">REPORTS</a>
                    <ul class="dropdown-menu shadow">
                        <li><a class="dropdown-item">Sample Only</a></li>
                    </ul>
                </li>
            </ul>

            <ul class="navbar-nav ms-auto">
                <li class="nav-item">
                    <a class="nav-link aura-logout" href="javascript:void(0)" onclick="confirmLogout()">
                        <i class="fas fa-sign-out-alt"></i>
                    </a>
                </li>
            </ul>
        </div>
    </div>
</nav>

<div class="modal fade" id="logoutModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content logout-modal-card">
            <div class="modal-body text-center p-5">
                <div class="mb-4">
                    <div class="logout-icon-wrapper">
                        <i class="fas fa-power-off text-danger"></i>
                    </div>
                </div>
                <h3 class="text-white fw-bold mb-3" style="letter-spacing: 4px;">LOG OUT?</h3>
                <p class="text-muted mb-4 px-3">You are about to initiate a secure system log out. All temporary session tokens and local cache will be purged.</p>
                
                <div class="d-grid gap-2 col-10 mx-auto">
                    <button type="button" class="btn btn-danger py-3 fw-bold shadow-sm" onclick="performLogout()">CONFIRM LOG OUT</button>
                    <button type="button" class="btn btn-link text-muted text-decoration-none mt-2" data-bs-dismiss="modal">RETURN TO DASHBOARD</button>
                </div>
            </div>
        </div>
    </div>
</div>

<div id="logoutOverlay" class="logout-overlay d-none">
    <div class="terminal-loader shadow-lg">
        <div class="terminal-header">
            <div class="d-flex align-items-center gap-2">
                <span class="status-dot"></span>
                <span>SECURE_LOGOUT_v2.0</span>
            </div>
            <span class="text-muted">ID: <?= $_SESSION['user_id'] ?? 'UNK' ?></span>
        </div>
        <div class="terminal-body">
            <div id="logoutStatus" class="mb-2 text-uppercase">INITIALIZING...</div>
            <div class="progress-container">
                <div id="logoutProgress" class="progress-bar-fill"></div>
            </div>
            <div class="terminal-logs mt-3" id="terminalLogs">
                <div>> PREPARING SYSTEM PURGE...</div>
            </div>
        </div>
    </div>
</div>

<style>
.logout-modal-card {
    background: rgba(15, 17, 26, 0.98) !important;
    backdrop-filter: blur(25px);
    border: 1px solid rgba(255, 68, 68, 0.4) !important;
    border-radius: 25px;
    box-shadow: 0 0 50px rgba(255, 0, 0, 0.15);
}

.logout-icon-wrapper {
    width: 90px;
    height: 90px;
    background: rgba(255, 68, 68, 0.1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    font-size: 2.5rem;
    box-shadow: 0 0 30px rgba(255, 68, 68, 0.2);
    animation: pulseRed 1.5s infinite;
}

@keyframes pulseRed {
    0% { transform: scale(1); box-shadow: 0 0 20px rgba(255, 68, 68, 0.2); }
    50% { transform: scale(1.1); box-shadow: 0 0 40px rgba(255, 68, 68, 0.5); }
    100% { transform: scale(1); box-shadow: 0 0 20px rgba(255, 68, 68, 0.2); }
}

.logout-overlay {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: #050608;
    z-index: 11000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.terminal-loader {
    width: 400px;
    background: #0f111a;
    border: 1px solid #333;
    font-family: 'Courier New', Courier, monospace;
    padding: 25px;
    border-radius: 10px;
}

.terminal-header {
    font-size: 11px;
    color: #00ffcc;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid #222;
    padding-bottom: 12px;
}

.status-dot {
    width: 8px; height: 8px; background: #ff4444; border-radius: 50%; display: inline-block;
    animation: blink 0.5s infinite;
}

#logoutStatus { color: #ff4444; font-size: 14px; font-weight: bold; letter-spacing: 1px; }

.progress-container { width: 100%; height: 6px; background: #1a1d2b; overflow: hidden; border-radius: 3px; }
.progress-bar-fill { width: 0%; height: 100%; background: #ff4444; box-shadow: 0 0 15px #ff4444; transition: width 0.2s linear; }

.terminal-logs { font-size: 11px; color: #555; line-height: 1.6; max-height: 100px; overflow: hidden; }

@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

.fade-out-page { filter: blur(15px) brightness(0.2); transition: all 1.2s ease; }
</style>

<script>
function confirmLogout() {
    var logoutModal = new bootstrap.Modal(document.getElementById('logoutModal'));
    logoutModal.show();
}

function performLogout() {
    const modalElement = document.getElementById('logoutModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) modalInstance.hide();
    
    setTimeout(() => {
        const overlay = document.getElementById('logoutOverlay');
        const progressBar = document.getElementById('logoutProgress');
        const statusText = document.getElementById('logoutStatus');
        const logBox = document.getElementById('terminalLogs');
        
        overlay.classList.remove('d-none');

        const logs = [
            "DE-AUTHORIZING_SESSION...",
            "PURGING_LOCAL_DATA_BUFFER...",
            "ENCRYPTING_ACCESS_LOGS...",
            "SHUTTING_DOWN_TERMINAL_CORE...",
            "LOGOUT_SUCCESSFUL."
        ];

        let progress = 0;
        let logIndex = 0;

        const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 7) + 2;
            if (progress > 100) progress = 100;
            
            progressBar.style.width = progress + "%";

            let currentLogIndex = Math.floor((progress / 100) * logs.length);
            if (currentLogIndex > logIndex && currentLogIndex < logs.length) {
                logIndex = currentLogIndex;
                statusText.innerText = logs[logIndex];
                
                const logEntry = document.createElement('div');
                logEntry.innerText = `> ${logs[logIndex-1]}`;
                logBox.prepend(logEntry);
            }

            if (progress === 100) {
                clearInterval(interval);
                statusText.innerText = "LOGOUT_SUCCESSFUL";
                statusText.style.color = "#00ffcc";
                
                setTimeout(() => {
                    window.location.href = "logout.php";
                }, 1000);
            }
        }, 120); 
    }, 300); 
}
</script>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>