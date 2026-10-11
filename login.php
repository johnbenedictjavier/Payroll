<?php
session_start();
require 'db.php';


$msg = "";
$error_trigger = false;

if (isset($_POST['login'])) {
    $emp_num = $_POST['employee_num'];
    $pass = $_POST['password'];

    $stmt = $conn->prepare("SELECT * FROM user WHERE employee_num = ? AND portal_pass = ?");
    $stmt->execute([$emp_num, $pass]);
    $user = $stmt->fetch();

    if ($user) {
        $_SESSION['user_id'] = $user['user_id'];
        $_SESSION['name'] = $user['full_name'];
        header("Location: index.php");
        exit();
    } else {
        $error_trigger = true; 
        $msg = "<div class='alert alert-danger py-2 mb-3' id='loginAlert'><i class='fas fa-exclamation-triangle me-2'></i>System Access Denied</div>";
    }
}

include 'head.php';
?>

<style>
    .login-card {
        opacity: 0;
        transform: translateY(20px);
        animation: fadeInUp 0.6s ease forwards;
        background: rgba(15, 17, 26, 0.95) !important;
        backdrop-filter: blur(15px);
        border: 1px solid rgba(0, 255, 204, 0.2);
        position: relative;
        overflow: hidden;
        box-shadow: 0 0 30px rgba(0,0,0,0.5);
    }

    @keyframes fadeInUp {
        to { opacity: 1; transform: translateY(0); }
    }

    .shake-err {
        animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        border-color: #ff4444 !important;
    }

    @keyframes shake {
        10%, 90% { transform: translate3d(-1px, 0, 0); }
        20%, 80% { transform: translate3d(2px, 0, 0); }
        30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
        40%, 60% { transform: translate3d(4px, 0, 0); }
    }

    .scanner-line {
        position: absolute;
        top: -5px;
        left: 0;
        width: 100%;
        height: 4px;
        background: #00ffcc;
        box-shadow: 0 0 20px #00ffcc, 0 0 40px #00ffcc;
        z-index: 100;
        display: none;
    }

    .is-scanning .scanner-line {
        display: block;
        animation: scanMove 1.5s ease-in-out infinite;
    }

    @keyframes scanMove {
        0% { top: 0%; }
        50% { top: 100%; }
        100% { top: 0%; }
    }

    .btn-aura-accent {
        transition: all 0.4s ease;
        letter-spacing: 2px;
    }

    .btn-aura-accent.loading {
        background: #000 !important;
        color: #00ffcc !important;
        border: 1px solid #00ffcc;
        box-shadow: inset 0 0 10px rgba(0,255,204,0.5);
    }

    #statusMsg {
        font-family: 'Courier New', Courier, monospace;
        font-size: 10px;
        color: #00ffcc;
        height: 15px;
    }
</style>

<div class="login-page d-flex align-items-center justify-content-center" style="height: 100vh; background: #050608;">
    <div class="col-11 col-sm-8 col-md-4">
        <div class="card login-card p-0" id="loginCard">
            <div class="scanner-line"></div>

            <div class="login-header p-4 text-center border-bottom border-secondary border-opacity-10">
                <div class="aura-logo" style="font-size:32px; font-weight: 900; letter-spacing: 5px;">LCC PAYROLL</div>
                <small class="text-muted text-uppercase" style="letter-spacing:3px; font-size: 9px;">Protocol: Secure Terminal v2.0</small>
            </div>

            <div class="p-4">
                <div id="msgContainer"><?php if ($msg) echo $msg; ?></div>

                <form method="POST" id="loginForm">
                    <div class="mb-3">
                        <label class="form-label small text-muted">EMPLOYEE_ID</label>
                        <input type="text" name="employee_num" id="empNum" class="form-control p-3 bg-dark text-white border-secondary border-opacity-50" placeholder="ID-XXXXX" required autocomplete="off">
                    </div>
                    <div class="mb-4">
                        <label class="form-label small text-muted">PASSWORD</label>
                        <input type="password" name="password" id="empPass" class="form-control p-3 bg-dark text-white border-secondary border-opacity-50" placeholder="••••••••" required>
                    </div>
                    
                    <div id="statusMsg" class="mb-2 text-center"></div>

                    <button type="submit" name="login" id="loginBtn" class="btn btn-aura-accent w-100 p-3 fw-bold">
                        <span id="btnText">INITIALIZE AUTHENTICATION</span>
                    </button>
                </form>
            </div>
        </div>
        <p class="text-center mt-3 text-muted" style="font-size: 8px; letter-spacing: 2px;">WARNING: UNAUTHORIZED ACCESS IS LOGGED AND PROSECUTED</p>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginCard = document.getElementById('loginCard');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = document.getElementById('btnText');
    const statusMsg = document.getElementById('statusMsg');

    <?php if ($error_trigger): ?>
        loginCard.classList.add('shake-err');
        setTimeout(() => loginCard.classList.remove('shake-err'), 500);
    <?php endif; ?>

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        loginCard.classList.add('is-scanning');
        loginBtn.classList.add('loading');
        loginBtn.disabled = true;

        const messages = [
            "CONNECTING TO SECURE SERVER...",
            "ANALYZING CREDENTIALS...",
            "PERFORMING BIOMETRIC SCAN...",
            "DECRYPTING ACCESS KEY...",
            "VERIFYING PERMISSIONS..."
        ];

        let i = 0;
        const msgInterval = setInterval(() => {
            if (i < messages.length) {
                statusMsg.innerText = messages[i];
                btnText.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> ${messages[i]}`;
                i++;
            } else {
                clearInterval(msgInterval);
            }
        }, 600);

        setTimeout(() => {
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = 'login';
            hiddenInput.value = 'true';
            loginForm.appendChild(hiddenInput);

            loginForm.submit();
        }, 2200); 
    });
});
</script>