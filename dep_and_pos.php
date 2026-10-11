<?php
session_start();
if (!isset($_SESSION['user_id'])) { die("Access Denied. <br><a href='login.php'>Back to Log In</a>"); }
require 'db.php';
include 'head.php';

$depts = $conn->query("
    SELECT d.*, 
    (SELECT COUNT(*) FROM employee_position ep WHERE ep.department = d.dept_name) AS staff_count
    FROM department d
    ORDER BY d.dept_name ASC
")->fetchAll();

$positions = $conn->query("
    SELECT p.*, 
    (SELECT COUNT(*) FROM employee_position ep WHERE ep.position = p.pos_name) AS staff_count
    FROM position p
    ORDER BY p.pos_name ASC
")->fetchAll();

$staff_list = $conn->query("
    SELECT ep.department, ep.position, e.employee_num, e.fn, e.ln, e.mn 
    FROM employee_position ep
    JOIN employee_info e ON ep.employee_num = e.employee_num
")->fetchAll();
?>

<style>
    :root {
        --dark-main: #13151a; 
        --dark-card: #1c1f26;
        --dark-item: #252a34;
        --aura-blue: #4e73df;
        --aura-green: #1cc88a;
        --text-muted: #858796;
        --text-light: #e1e1e1;
    }

    body, .main-wrapper { 
        background-color: var(--dark-main) !important; 
        color: var(--text-light);
    }

    .catalog-card {
        border: none;
        border-radius: 16px;
        height: 600px; 
        display: flex;
        flex-direction: column;
        background: var(--dark-card);
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        margin-bottom: 20px;
    }

    .catalog-header {
        padding: 1.25rem;
        background: rgba(255,255,255,0.02);
        border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .fancy-title {
        font-size: 0.75rem;
        letter-spacing: 2px;
        text-transform: uppercase;
        font-weight: 800;
        margin-bottom: 15px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .search-container {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .search-box {
        background: var(--dark-item);
        border: 1px solid #3d4455;
        border-radius: 8px;
        padding: 8px 12px;
        color: white;
        font-size: 0.85rem;
        flex-grow: 1;
        outline: none;
    }

    .sort-select {
        background: var(--dark-item);
        border: 1px solid #3d4455;
        border-radius: 8px;
        padding: 8px;
        color: white;
        font-size: 0.8rem;
        width: 100px;
        outline: none;
        cursor: pointer;
    }

    .btn-add-inline {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: 0.3s;
        color: white;
    }
    .dept-theme .btn-add-inline { background: var(--aura-blue); }
    .pos-theme .btn-add-inline { background: var(--aura-green); }

    .catalog-body {
        flex-grow: 1;
        overflow-y: auto;
        padding: 1rem;
        -webkit-overflow-scrolling: touch;
    }

    .item-entry {
        display: flex;
        align-items: center;
        padding: 12px;
        margin-bottom: 8px;
        border-radius: 10px;
        background: var(--dark-item);
        border: 1px solid transparent;
        transition: 0.2s;
    }

    .item-icon {
        width: 35px; height: 35px; border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
        margin-right: 12px; font-size: 0.9rem;
    }

    .dept-theme .item-icon { background: rgba(78, 115, 223, 0.1); color: var(--aura-blue); }
    .pos-theme .item-icon { background: rgba(28, 200, 138, 0.1); color: var(--aura-green); }

    .item-title { font-weight: 600; font-size: 0.85rem; color: #fff; margin: 0; }
    .item-subtitle { font-size: 0.7rem; color: var(--text-muted); }

    .catalog-footer {
        padding: 10px 1.25rem;
        background: rgba(0,0,0,0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid rgba(255,255,255,0.05);
    }

    .pagination-info { font-size: 0.75rem; color: var(--text-muted); }
    .btn-nav {
        background: var(--dark-item);
        border: 1px solid #3d4455;
        color: white;
        padding: 4px 12px;
        border-radius: 5px;
        font-size: 0.75rem;
    }
    .btn-nav:disabled { opacity: 0.3; cursor: not-allowed; }

    .action-group { display: flex; gap: 5px; }
    .btn-circle {
        width: 28px; height: 28px; border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
        border: none; font-size: 0.7rem;
    }
    .btn-edit { background: #3d4455; color: #fff; }
    .btn-delete { background: #442b2b; color: #ff6b6b; }

    @media (max-width: 768px) {
        .catalog-card { height: 500px; }
    }
    
    .toast-container { position: fixed; top: 20px; right: 20px; z-index: 9999; }
    .custom-toast {
        background-color: var(--success-bg) !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
    .toast-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
    }
    .toast-btn-close {
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.7);
        font-size: 1.2rem;
        line-height: 1;
        cursor: pointer;
    }
    .toast-btn-close:hover { color: white; }

</style>

<div class="toast-container">
    <div id="liveToast" class="toast align-items-center text-white border-0" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
            <div class="toast-body" id="toastMessage"></div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    </div>
</div>

<div class="main-wrapper">
    <?php include 'nav.php'; ?>

    <div class="container-fluid py-4">
        <div class="row g-4">
            <div class="col-lg-6">
                <div class="card catalog-card dept-theme">
                    <div class="catalog-header">
                        <div class="fancy-title">
                            <span class="text-primary"><i class="fas fa-layer-group me-2"></i>DEPARTMENTS</span>
                            <span class="badge bg-primary opacity-75"><?= count($depts) ?> Total</span>
                        </div>
                        <div class="search-container">
                            <input type="text" id="deptSearch" class="search-box" placeholder="Search..." onkeyup="filterItems('dept')">
                            <select id="deptSort" class="sort-select" onchange="sortItems('dept')">
                                <option value="alpha">A-Z</option>
                                <option value="count_desc">Headcount</option>
                                <option value="oldest">Oldest</option>
                                <option value="newest">Newest</option>
                            </select>
                            <button class="btn-add-inline" onclick="openDeptModal()" title="Add Department">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="catalog-body" id="deptList">
                        <?php foreach ($depts as $d): ?>
                            <div class="item-entry dept-row" 
                                 data-name="<?= strtolower($d['dept_name']) ?>" 
                                 data-count="<?= $d['staff_count'] ?>" 
                                 data-id="<?= $d['dept_id'] ?>">
                                <div class="item-icon"><i class="fas fa-building"></i></div>
                                <div class="item-details flex-grow-1">
                                    <div class="item-title"><?= htmlspecialchars($d['dept_name']) ?></div>
                                    <div class="item-subtitle"><?= $d['staff_count'] ?> Members</div>
                                </div>
                                <div class="action-group">
                                    <button class="btn-circle btn-edit" onclick="editDept(<?= $d['dept_id'] ?>, '<?= addslashes($d['dept_name']) ?>')"><i class="fas fa-pen"></i></button>
                                    <button class="btn-circle btn-delete" onclick="DepconfirmDelete('<?= $d['dept_id'] ?>')"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>

                    <div class="catalog-footer">
                        <button class="btn-nav" id="prevDept" onclick="changePage('dept', -1)"><i class="fas fa-chevron-left"></i></button>
                        <span class="pagination-info" id="infoDept">Page 1 of 1</span>
                        <button class="btn-nav" id="nextDept" onclick="changePage('dept', 1)"><i class="fas fa-chevron-right"></i></button>
                    </div>
                </div>
            </div>

            <div class="col-lg-6">
                <div class="card catalog-card pos-theme">
                    <div class="catalog-header">
                        <div class="fancy-title">
                            <span class="text-success"><i class="fas fa-user-tie me-2"></i>POSITIONS</span>
                            <span class="badge bg-success opacity-75"><?= count($positions) ?> Total</span>
                        </div>
                        <div class="search-container">
                            <input type="text" id="posSearch" class="search-box" placeholder="Search..." onkeyup="filterItems('pos')">
                            <select id="posSort" class="sort-select" onchange="sortItems('pos')">
                                <option value="alpha">Sort (A-Z)</option>
                                <option value="count_desc">Highest Headcount</option>
                                <option value="oldest">Oldest to Newest</option>
                                <option value="newest">Newest to Oldest</option>
                            </select>
                            <button class="btn-add-inline" onclick="openPosModal()" title="Add Position">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>

                    <div class="catalog-body" id="posList">
                        <?php foreach ($positions as $p): ?>
                            <div class="item-entry pos-row" 
                                 data-name="<?= strtolower($p['pos_name']) ?>" 
                                 data-count="<?= $p['staff_count'] ?>" 
                                 data-id="<?= $p['pos_id'] ?>">
                                <div class="item-icon"><i class="fas fa-id-card"></i></div>
                                <div class="item-details flex-grow-1">
                                    <div class="item-title"><?= htmlspecialchars($p['pos_name']) ?></div>
                                    <div class="item-subtitle"><?= $p['staff_count'] ?> Headcount</div>
                                </div>
                                <div class="action-group">
                                    <button class="btn-circle btn-edit" onclick="editPos(<?= $p['pos_id'] ?>, '<?= addslashes($p['pos_name']) ?>')"><i class="fas fa-pen"></i></button>
                                    <button class="btn-circle btn-delete" onclick="PosconfirmDelete('<?= $p['pos_id'] ?>')"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>

                    <div class="catalog-footer">
                        <button class="btn-nav" id="prevPos" onclick="changePage('pos', -1)"><i class="fas fa-chevron-left"></i></button>
                        <span class="pagination-info" id="infoPos">Page 1 of 1</span>
                        <button class="btn-nav" id="nextPos" onclick="changePage('pos', 1)"><i class="fas fa-chevron-right"></i></button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="deptModal" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
        <form action="save_logic.php" method="POST" class="modal-content" style="background: var(--dark-card); border: 1px solid #3d4455;">
            <div class="modal-header border-secondary">
                <h6 class="modal-title text-white">Manage Department</h6>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
                <input type="hidden" name="dept_id" id="m_dept_id">
                <label class="form-label small fw-bold text-muted">DEPARTMENT NAME</label>
                <input type="text" name="dept_name" id="m_dept_name" class="form-control bg-dark text-white border-secondary shadow-none" required>
            </div>
            <div class="modal-footer border-0">
                <button type="submit" name="save_dept" onclick="showToast('Added succesfully.')" class="btn btn-primary w-100">SAVE CHANGES</button>
            </div>
        </form>
    </div>
</div>

<div class="modal fade" id="posModal" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
        <form action="save_logic.php" method="POST" class="modal-content" style="background: var(--dark-card); border: 1px solid #3d4455;">
            <div class="modal-header border-secondary">
                <h6 class="modal-title text-white">Manage Position</h6>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
                <input type="hidden" name="pos_id" id="m_pos_id">
                <label class="form-label small fw-bold text-muted">POSITION NAME</label>
                <input type="text" name="pos_name" id="m_pos_name" class="form-control bg-dark text-white border-secondary shadow-none" required>
            </div>
            <div class="modal-footer border-0">
                <button type="submit" name="save_pos" class="btn btn-success w-100">SAVE CHANGES</button>
            </div>
        </form>
    </div>
</div>

<div class="modal fade" id="PosdelconfirmModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-sm"><div class="modal-content bg-dark text-center"><div class="modal-body p-4"><i class="fas fa-exclamation-triangle text-warning mb-3" style="font-size: 2rem;"></i><h5>Delete Position?</h5><div class="d-flex gap-2 justify-content-center mt-4"><button type="button" class="btn btn-light btn-sm" data-bs-dismiss="modal">Cancel</button><a href="#" id="PosdelconfirmActionBtn" class="btn btn-danger btn-sm">Delete</a></div></div></div></div></div>
<div class="modal fade" id="DepdelconfirmModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-sm"><div class="modal-content bg-dark text-center"><div class="modal-body p-4"><i class="fas fa-exclamation-triangle text-warning mb-3" style="font-size: 2rem;"></i><h5>Delete Department?</h5><div class="d-flex gap-2 justify-content-center mt-4"><button type="button" class="btn btn-light btn-sm" data-bs-dismiss="modal">Cancel</button><a href="#" id="DepdelconfirmActionBtn" class="btn btn-danger btn-sm">Delete</a></div></div></div></div></div>

<script>
let currentPage = { dept: 0, pos: 0 };
const itemsPerPage = 6;

function showToast(msg, type = 'success') {
    const toastEl = document.getElementById('liveToast');
    const toastBody = document.getElementById('toastMessage');
    
    toastBody.innerText = msg;
    
    toastEl.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'bg-info');
    toastEl.classList.add('bg-' + type);
    
    const bsToast = new bootstrap.Toast(toastEl, { delay: 3000 });
    bsToast.show();
}

function sortItems(type) {
    const criteria = document.getElementById(`${type}Sort`).value;
    const container = document.getElementById(`${type}List`);
    const rows = Array.from(container.querySelectorAll(`.${type}-row`));

    rows.sort((a, b) => {
        if (criteria === 'alpha') {
            return a.dataset.name.localeCompare(b.dataset.name);
        } else if (criteria === 'count_desc') {
            return parseInt(b.dataset.count) - parseInt(a.dataset.count);
        } else if (criteria === 'oldest') {
            return parseInt(a.dataset.id) - parseInt(b.dataset.id);
        } else if (criteria === 'newest') {
            return parseInt(b.dataset.id) - parseInt(a.dataset.id);
        }
        return 0;
    });

    rows.forEach(row => container.appendChild(row));
    currentPage[type] = 0;
    updatePagination(type);
}

function updatePagination(type) {
    const rows = document.querySelectorAll(`.${type}-row`);
    const visibleRows = Array.from(rows).filter(row => row.getAttribute('data-search-match') !== 'false');
    const totalPages = Math.ceil(visibleRows.length / itemsPerPage) || 1;
    
    if (currentPage[type] >= totalPages) currentPage[type] = totalPages - 1;
    if (currentPage[type] < 0) currentPage[type] = 0;

    const start = currentPage[type] * itemsPerPage;
    const end = start + itemsPerPage;

    visibleRows.forEach((row, index) => {
        if (index >= start && index < end) { row.classList.remove('d-none'); } 
        else { row.classList.add('d-none'); }
    });

    document.getElementById(`info${type.charAt(0).toUpperCase() + type.slice(1)}`).innerText = `Page ${currentPage[type] + 1} of ${totalPages}`;
    document.getElementById(`prev${type.charAt(0).toUpperCase() + type.slice(1)}`).disabled = (currentPage[type] === 0);
    document.getElementById(`next${type.charAt(0).toUpperCase() + type.slice(1)}`).disabled = (currentPage[type] >= totalPages - 1);
}

function changePage(type, direction) {
    currentPage[type] += direction;
    updatePagination(type);
}

function filterItems(type) {
    const query = document.getElementById(`${type}Search`).value.toLowerCase();
    const rows = document.querySelectorAll(`.${type}-row`);
    rows.forEach(row => {
        const text = row.getAttribute('data-name');
        if (text.includes(query)) {
            row.setAttribute('data-search-match', 'true');
        } else {
            row.setAttribute('data-search-match', 'false');
            row.classList.add('d-none');
        }
    });
    currentPage[type] = 0;
    updatePagination(type);
}

function openDeptModal() { 
    document.getElementById('m_dept_id').value = ''; 
    document.getElementById('m_dept_name').value = ''; 
    document.querySelector('#deptModal .modal-title').innerText = "Add Department";
    new bootstrap.Modal(document.getElementById('deptModal')).show(); 
}

function editDept(id, name) { 
    document.getElementById('m_dept_id').value = id; 
    document.getElementById('m_dept_name').value = name; 
    document.querySelector('#deptModal .modal-title').innerText = "Update Department";
    new bootstrap.Modal(document.getElementById('deptModal')).show(); 
}

function openPosModal() { 
    document.getElementById('m_pos_id').value = ''; 
    document.getElementById('m_pos_name').value = ''; 
    document.querySelector('#posModal .modal-title').innerText = "Add Position";
    new bootstrap.Modal(document.getElementById('posModal')).show(); 
}

function editPos(id, name) { 
    document.getElementById('m_pos_id').value = id; 
    document.getElementById('m_pos_name').value = name; 
    document.querySelector('#posModal .modal-title').innerText = "Update Position";
    new bootstrap.Modal(document.getElementById('posModal')).show(); 
}

function PosconfirmDelete(num) {
    document.getElementById('PosdelconfirmActionBtn').href = "save_logic.php?delete_pos=" + num;
    new bootstrap.Modal(document.getElementById('PosdelconfirmModal')).show();
}

function DepconfirmDelete(num) {
    document.getElementById('DepdelconfirmActionBtn').href = "save_logic.php?delete_dept=" + num;
    new bootstrap.Modal(document.getElementById('DepdelconfirmModal')).show();
}

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('msg')) {
        const msgType = urlParams.get('type') || 'success';
        const msgText = urlParams.get('msg');
        showToast(decodeURIComponent(msgText), msgType);
        
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});
</script>