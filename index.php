<?php
session_start();
if (!isset($_SESSION['user_id'])) { die("Access Denied. <br><a href='login.php'>Back to Log In</a>"); }

include 'head.php';
include 'nav.php';
?>

<style>
    .dashboard-wrapper {
        position: relative;
        height: 82vh;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .bg-logo-left {
        position: absolute; left: -50px; top: 50%; transform: translateY(-50%);
        opacity: 0.06; width: 580px; z-index: 0; pointer-events: none;
        animation: slideInLeft 1.5s ease-out forwards;
    }
    .bg-logo-right {
        position: absolute; right: -30px; top: 50%; transform: translateY(-50%);
        opacity: 0.06; width: 500px; z-index: 0; pointer-events: none;
        animation: slideInRight 1.5s ease-out forwards;
    }
    .welcome-card {
        position: relative; z-index: 10; padding: 50px; border-radius: 30px;
        border: 1px solid var(--aura-border); background: var(--aura-card);
        animation: fadeInUp 1s ease-out;
    }
    .logo-footer {
        margin-top: 30px; display: flex; justify-content: center; align-items: center;
        gap: 20px; animation: fadeInUp 1.8s ease-out;
    }
    #lcc { height: 130px; width: auto; filter: grayscale(20%) brightness(1.3); transition: transform 0.3s ease; }
    .logo-small { height: 100px; width: auto; filter: grayscale(20%) brightness(1.3); transition: transform 0.3s ease; }
    .logo-small:hover { transform: scale(1.1); filter: grayscale(0%); }
    .divider { width: 1px; height: 40px; background: var(--aura-border); }

    @keyframes slideInLeft { from { opacity: 0; transform: translateY(-50%) translateX(-100px); } to { opacity: 0.06; transform: translateY(-50%) translateX(0); } }
    @keyframes slideInRight { from { opacity: 0; transform: translateY(-50%) translateX(100px); } to { opacity: 0.06; transform: translateY(-50%) translateX(0); } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
</style>

<div class="container">
    <div class="dashboard-wrapper">
        <img src="lcc.png" class="bg-logo-left" alt="">
        <img src="ccte.png" class="bg-logo-right" alt="">

        <div class="col-md-9 text-center">
            <div class="welcome-card">
                <h1 class="display-3 fw-bold mb-3">
                    Admin <span style="color: var(--aura-accent);"><?php echo htmlspecialchars($_SESSION['name']); ?></span>
                </h1>
                <p class="lead fs-4" style="color: var(--aura-text-dim);">Welcome to the Payroll Management System Dashboard</p>

                <div class="logo-footer">
                    <img src="lcc.png" class="logo-small" id="lcc" alt="LCC">
                    <img src="ccte.png" class="logo-small" alt="CCTE">
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    body {

        overflow-x: hidden;
        font-family: 'Inter', sans-serif;
    }

    .dashboard-wrapper {
        position: relative;
        height: 80vh;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .bg-logo-left {
        position: absolute;
        left: -50px; 
        top: 50%;
        transform: translateY(-50%);
        opacity: 0.08; 
        width: 580px;
        z-index: 0;
        pointer-events: none;
        animation: slideInLeft 1.5s ease-out forwards;
    }

    .bg-logo-right {
        position: absolute;
        right: -30px; 
        top: 50%;
        transform: translateY(-50%);
        opacity: 0.08;
        width: 500px;
        z-index: 0;
        pointer-events: none;
        animation: slideInRight 1.5s ease-out forwards;
    }

    .welcome-card {
        position: relative;
        z-index: 10; 
        padding: 0px;
        /* border-radius: 30px; */
        /* border: 1px solid rgba(255,255,255,0.4); */
        border: none;
        background-color: transparent;
        animation: fadeInUp 1s ease-out;
    }

    .logo-footer {
        margin-top: 30px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 20px;
        animation: fadeInUp 1.8s ease-out;
    }

    #lcc {
        height: 165px;
        width: auto;
        filter: grayscale(20%) brightness(1.1);
        transition: transform 0.3s ease;
    }

    .logo-small {
        height: 130px;
        width: auto;
        filter: grayscale(20%) brightness(1.1);
        transition: transform 0.3s ease;
    }
    
    .logo-small:hover {
        transform: scale(1.1);
        filter: grayscale(0%);
    }

    .divider {
        width: 1px;
        height: 40px;
        background: #dee2e6;
    }

    @keyframes slideInLeft {
        from { opacity: 0; transform: translateY(-50%) translateX(-100px); }
        to { opacity: 0.08; transform: translateY(-50%) translateX(0); }
    }

    @keyframes slideInRight {
        from { opacity: 0; transform: translateY(-50%) translateX(100px); }
        to { opacity: 0.08; transform: translateY(-50%) translateX(0); }
    }

    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(40px); }
        to { opacity: 1; transform: translateY(0); }
    }
</style>

<!-- <div class="container">
    <div class="dashboard-wrapper">
        
        <img src="lcc.png" class="bg-logo-left" alt="">
        <img src="ccte.png" class="bg-logo-right" alt="">

        <div class="col-md-9 text-center">
            <div class="welcome-card">
                <h1 class="display-3 fw-bold text-dark mb-3">
                    Admin <span class="text-primary"></span>
                </h1>
                <p class="lead text-muted fs-4">Welcome to the Payroll Management System Dashboard</p>
                
                <div class="logo-footer">
                    <img src="lcc.png" class="logo-small" id="lcc" alt="LCC">
                    <img src="ccte.png" class="logo-small" alt="CCTE">
                </div>
            </div>
        </div>

    </div>
</div> -->