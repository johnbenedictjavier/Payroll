<?php
session_start();
if (!isset($_SESSION["user_id"])) { die("Access Denied. <br><a href='login.php'>Back to Log In</a>"); }

require 'db.php';

$year = date('y');
$query = $conn->query("SELECT employee_num FROM employee_info ORDER BY employee_id DESC LIMIT 1");
$last_emp = $query->fetch();
$next_id = ($last_emp) ? $year . '-' . str_pad((int)explode('-', $last_emp['employee_num'])[1] + 1, 5, '0', STR_PAD_LEFT) : $year . '-00001';

$departments = $conn->query("SELECT * FROM department ORDER BY dept_name ASC")->fetchAll();
$positions = $conn->query("SELECT * FROM position ORDER BY pos_name ASC")->fetchAll();

$all_records = [];
$all = $conn->query("SELECT * FROM employee_info ORDER BY ln ASC")->fetchAll();
foreach($all as $emp): 
    $num = $emp['employee_num'];
    $data = $emp;
    $u = $conn->query("SELECT portal_pass FROM user WHERE employee_num='$num'")->fetch();
    $data['portal_pass'] = $u ? $u['portal_pass'] : '';
    $data['emergency'] = $conn->query("SELECT * FROM e_contact WHERE employee_num='$num'")->fetchAll();
    $data['dependent'] = $conn->query("SELECT * FROM dependent WHERE employee_num='$num'")->fetchAll();
    $data['education'] = $conn->query("SELECT * FROM educ_bg WHERE employee_num='$num'")->fetchAll();
    $data['reference'] = $conn->query("SELECT * FROM charac_ref WHERE employee_num='$num'")->fetchAll();
    $data['position'] = $conn->query("SELECT * FROM employee_position WHERE employee_num='$num'")->fetchAll();
    $data['v_ids'] = $conn->query("SELECT * FROM valid_id WHERE employee_num='$num'")->fetchAll();
    $all_records[] = $data;
endforeach;

include 'head.php'; 
?>

<style>
    .is-invalid { border: 2px solid #dc3545 !important; }
    .photo-upload-box { width: 120px; height: 120px; border: 1px solid #dee2e6; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; background: #fff; overflow: hidden; position: relative; }
    .photo-upload-box img { width: 100%; height: 100%; object-fit: cover; }
    .dynamic-row-wrapper { position: relative; border-bottom: 1px dashed #ccc; padding-bottom: 15px; margin-bottom: 15px; }
    .remove-row-btn { 
        width: 24px; height: 24px; background: #dc3545; color: #fff; 
        border-radius: 50%; display: flex; align-items: center; justify-content: center;
        cursor: pointer; position: absolute; right: -5px; top: -10px; z-index: 5; border: 2px solid #fff;
    }
    .record-card { border: 1px solid #dee2e6; background: #dedede; padding: 12px; border-radius: 6px; margin-bottom: 8px; transition: 0.2s; cursor: pointer; }
    .record-card:hover { border-color: #0d6efd; background-color: #f8fbff; }
    .toast-container { position: fixed; top: 20px; right: 20px; z-index: 10000; }
    #recordsListBody { background: #49416e; }

    @media (max-width: 768px) {
        .emp-shell { flex-direction: column; }
        .emp-sidebar { 
            width: 100% !important; 
            flex-direction: row !important; 
            overflow-x: auto; 
            display: flex; 
            white-space: nowrap;
            border-right: none !important;
            border-bottom: 1px solid #dee2e6;
            margin-bottom: 15px;
        }
        .emp-tab-btn { border-left: none !important; border-bottom: 3px solid transparent; }
        .emp-tab-btn.active { border-bottom: 3px solid #0d6efd !important; background: #f8f9fa; }
    }

    .fixed-modal-height { height: 70vh; overflow-y: auto; }
</style>

<div class="toast-container">
    <div id="liveToast" class="toast align-items-center text-white border-0" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
            <div class="toast-body" id="toastMessage"></div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    </div>
</div>

<div class="modal fade" id="confirmModal" tabindex="-1" style="z-index: 1060;">
    <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content text-center shadow-lg">
            <div class="modal-body p-4">
                <i class="fas fa-exclamation-triangle text-warning mb-3" style="font-size: 3rem;"></i>
                <h5 id="confirmTitle">Confirm Action</h5>
                <p class="text-muted small" id="confirmText">Are you sure you want to proceed?</p>
                <div class="d-flex gap-2 justify-content-center mt-4">
                    <button type="button" class="btn btn-light btn-sm px-3" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" id="confirmActionBtn" class="btn btn-primary btn-sm px-3">Confirm</button>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="main-wrapper">
    <?php include 'nav.php'; ?>

    <div class="page-header">
        <div class="title-group"><i class="fas fa-id-badge text-primary"></i> Employee Information</div>
        <div class="header-toolbar">
            <button type="button" class="btn-toolbar-icon danger" onclick="clearForm()"><i class="fas fa-times-circle"></i> CANCEL</button>
            <button type="button" class="btn-toolbar-icon" data-bs-toggle="modal" data-bs-target="#empListModal"><i class="fas fa-eye"></i> VIEW RECORDS</button>
            <button type="button" onclick="validateAndSave()" class="btn-toolbar-icon primary"><i class="fas fa-save"></i> SAVE</button>
        </div>
    </div>

    <div class="content-area">
        <form id="empForm" method="POST" action="emp_logic.php" enctype="multipart/form-data">
            <input type="hidden" name="employee_id" id="e_id">
            <input type="hidden" id="original_pass">
            <button type="submit" name="save_employee" id="submitBtn" class="d-none"></button>

            <div class="emp-shell">
                <div class="emp-sidebar">
                    <button type="button" class="emp-tab-btn active" data-tab="personal">Personal Information</button>
                    <button type="button" class="emp-tab-btn" data-tab="emergency">Emergency Contact</button>
                    <button type="button" class="emp-tab-btn" data-tab="dependent">Dependent</button>
                    <button type="button" class="emp-tab-btn" data-tab="education">Educational Background</button>
                    <button type="button" class="emp-tab-btn" data-tab="reference">Character Reference</button>
                    <button type="button" class="emp-tab-btn" data-tab="position">Position &amp; Assignment</button>
                </div>

                <div class="emp-content">
                    <div class="emp-pane" data-pane="personal">
                        <div class="tab-section-title">Personal Information</div>
                        <div class="row g-3">
                            <div class="col-md-2">
                                <label class="form-label">Photo</label>
                                <div class="photo-upload-box" id="photoBox" onclick="document.getElementById('photoInput').click()">
                                    <div id="photoPreview"><i class="fas fa-camera text-muted"></i></div>
                                    <input type="file" name="photo" id="photoInput" accept="image/*" class="d-none" onchange="previewPhoto(this)">
                                </div>
                            </div>
                            <div class="col-md-10">
                                <div class="row g-3">
                                    <div class="col-md-3"><label class="form-label">Employee #</label><input type="text" name="employee_num" id="e_num" class="form-control form-control-sm" value="<?= $next_id ?>" readonly></div>
                                    <div class="col-md-3"><label class="form-label">Password</label><input type="password" name="password" id="e_pass" class="form-control form-control-sm" required></div>
                                    <div class="col-md-2"><label class="form-label">Last Name</label><input type="text" name="ln" id="e_ln" class="form-control form-control-sm" required></div>
                                    <div class="col-md-2"><label class="form-label">First Name</label><input type="text" name="fn" id="e_fn" class="form-control form-control-sm" required></div>
                                    <div class="col-md-2"><label class="form-label">Middle Name</label><input type="text" name="mn" id="e_mn" class="form-control form-control-sm"></div>
                                    <div class="col-md-2"><label class="form-label">Gender</label><select name="gender" id="e_gender" class="form-select form-select-sm" required><option value="">Select</option><option>Male</option><option>Female</option></select></div>
                                    <div class="col-md-3"><label class="form-label">Email</label><input type="email" name="email" id="e_email" class="form-control form-control-sm" required></div>
                                    <div class="col-md-2"><label class="form-label">Contact</label><input type="text" name="contact" id="e_contact" class="form-control form-control-sm" required></div>
                                    <div class="col-md-2"><label class="form-label">Civil Status</label><input type="text" name="civil" id="e_civil" class="form-control form-control-sm" required></div>
                                    <div class="col-md-3"><label class="form-label">Birth Date</label><input type="date" name="bdate" id="e_bdate" class="form-control form-control-sm" required></div>
                                </div>
                            </div>
                            <div class="col-md-6"><label class="form-label">Permanent Address</label><input type="text" name="perm_add" id="e_perm" class="form-control form-control-sm" required></div>
                            <div class="col-md-6"><label class="form-label">Present Address</label><input type="text" name="pres_add" id="e_pres" class="form-control form-control-sm" required></div>
                            <div class="col-md-3"><label class="form-label">Nationality</label><input type="text" name="nationality" id="e_nat" class="form-control form-control-sm" required></div>
                            <div class="col-md-3"><label class="form-label">Religion</label><input type="text" name="religion" id="e_rel" class="form-control form-control-sm" required></div>
                            <hr>
                            <div class="col-md-2"><label class="form-label text-primary">SSS No.</label><input type="text" name="val_sss" id="e_sss" class="form-control form-control-sm" placeholder="N/A"></div>
                            <div class="col-md-2"><label class="form-label text-primary">Philhealth No.</label><input type="text" name="val_phil" id="e_phil" class="form-control form-control-sm" placeholder="N/A"></div>
                            <div class="col-md-2"><label class="form-label text-primary">Pag-ibig No.</label><input type="text" name="val_pag" id="e_pag" class="form-control form-control-sm" placeholder="N/A"></div>
                            <div class="col-md-3"><label class="form-label text-primary">ATM No.</label><input type="text" name="val_atm" id="e_atm" class="form-control form-control-sm" placeholder="N/A"></div>
                            <div class="col-md-3"><label class="form-label text-primary">TIN</label><input type="text" name="val_tin" id="e_tin" class="form-control form-control-sm" placeholder="N/A"></div>
                        </div>
                    </div>

                    <div class="emp-pane d-none" data-pane="emergency">
                        <div class="d-flex justify-content-between mb-3"><div class="tab-section-title">Emergency Contact</div><button type="button" class="btn btn-primary btn-sm" onclick="addRow('emergency')">Add Row</button></div>
                        <div id="container-emergency"></div>
                    </div>

                    <div class="emp-pane d-none" data-pane="dependent">
                        <div class="d-flex justify-content-between mb-3"><div class="tab-section-title">Dependent</div><button type="button" class="btn btn-primary btn-sm" onclick="addRow('dependent')">Add Row</button></div>
                        <div id="container-dependent"></div>
                    </div>

                    <div class="emp-pane d-none" data-pane="education">
                        <div class="d-flex justify-content-between mb-3"><div class="tab-section-title">Educational Background</div><button type="button" class="btn btn-primary btn-sm" onclick="addRow('education')">Add Row</button></div>
                        <div id="container-education"></div>
                    </div>

                    <div class="emp-pane d-none" data-pane="reference">
                        <div class="d-flex justify-content-between mb-3"><div class="tab-section-title">Character Reference</div><button type="button" class="btn btn-primary btn-sm" onclick="addRow('reference')">Add Row</button></div>
                        <div id="container-reference"></div>
                    </div>

                    <div class="emp-pane d-none" data-pane="position">
                        <div class="d-flex justify-content-between mb-3"><div class="tab-section-title">Position &amp; Assignment</div><button type="button" class="btn btn-primary btn-sm" onclick="addRow('position')">Add Row</button></div>
                        <div id="container-position"></div>
                    </div>
                </div>
            </div>
        </form>
    </div>
</div>

<div class="modal fade" id="empListModal" tabindex="-1">
    <div class="modal-dialog modal-xl modal-dialog-centered">
        <div class="modal-content border-0">
            <div class="modal-header bg-dark text-white p-3">
                <div class="row w-100 g-2 align-items-center">
                    <div class="col-md-2"><h6 class="modal-title">EMPLOYEE LIST</h6></div>
                    <div class="col-md-3">
                        <input type="text" id="recordSearch" class="form-control form-control-sm" placeholder="Search name or ID..." onkeyup="applyFilters()">
                    </div>
                    <div class="col-md-2">
                        <select id="sortFilter" class="form-select form-select-sm" onchange="applyFilters()">
                            <option value="az">Sort: A-Z</option>
                            <option value="za">Sort: Z-A</option>
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <select id="deptFilter" class="form-select form-select-sm" onchange="applyFilters()">
                            <option value="all">All Departments</option>
                            <?php foreach($departments as $d): ?><option><?= $d['dept_name'] ?></option><?php endforeach; ?>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <select id="posFilter" class="form-select form-select-sm" onchange="applyFilters()">
                            <option value="all">All Positions</option>
                            <?php foreach($positions as $p): ?><option><?= $p['pos_name'] ?></option><?php endforeach; ?>
                        </select>
                    </div>
                    <div class="col-md-1 text-end">
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                </div>
            </div>
            <div class="modal-body fixed-modal-height p-4" id="recordsListBody"></div>
            <div class="modal-footer bg-white d-flex justify-content-between p-2">
                <span class="text-muted small ps-2" id="pageInfo">Page 1 of 1</span>
                <div class="btn-group">
                    <button class="btn btn-outline-secondary btn-sm" onclick="changePage(-1)">Prev</button>
                    <button class="btn btn-outline-secondary btn-sm" onclick="changePage(1)">Next</button>
                </div>
            </div>
        </div>
    </div>
</div>

<div id="rowTemplates" class="d-none">
    <div class="emergency-row dynamic-row-wrapper row g-3">
        <div class="col-md-3"><label class="form-label">Name</label><input type="text" name="ec_name[]" class="form-control form-control-sm" required></div>
        <div class="col-md-2"><label class="form-label">Relationship</label><input type="text" name="ec_rel[]" class="form-control form-control-sm" required></div>
        <div class="col-md-2"><label class="form-label">Contact #</label><input type="text" name="ec_contact[]" class="form-control form-control-sm" required></div>
        <div class="col-md-5"><label class="form-label">Address</label><input type="text" name="ec_add[]" class="form-control form-control-sm" required></div>
    </div>
    <div class="dependent-row dynamic-row-wrapper row g-3">
        <div class="col-md-5"><label class="form-label">Full Name</label><input type="text" name="dep_name[]" class="form-control form-control-sm" required></div>
        <div class="col-md-3"><label class="form-label">Relationship</label><input type="text" name="dep_rel[]" class="form-control form-control-sm" required></div>
        <div class="col-md-4"><label class="form-label">Birth Date</label><input type="date" name="dep_bdate[]" class="form-control form-control-sm" required></div>
    </div>
    <div class="education-row dynamic-row-wrapper row g-3">
        <div class="col-md-3"><label class="form-label">Level</label><select name="ed_level[]" class="form-select form-select-sm" required><option value="">Select</option><option>Primary</option><option>Secondary</option><option>Tertiary</option></select></div>
        <div class="col-md-3"><label class="form-label">School Name</label><input type="text" name="ed_school[]" class="form-control form-control-sm" required></div>
        <div class="col-md-4"><label class="form-label">Address</label><input type="text" name="ed_add[]" class="form-control form-control-sm" required></div>
        <div class="col-md-2"><label class="form-label">Year</label><input type="text" name="ed_sy[]" class="form-control form-control-sm" required></div>
    </div>
    <div class="reference-row dynamic-row-wrapper row g-3">
        <div class="col-md-3"><label class="form-label">Name</label><input type="text" name="ref_name[]" class="form-control form-control-sm" required></div>
        <div class="col-md-3"><label class="form-label">Occupation</label><input type="text" name="ref_occ[]" class="form-control form-control-sm" required></div>
        <div class="col-md-2"><label class="form-label">Contact</label><input type="text" name="ref_contact[]" class="form-control form-control-sm" required></div>
        <div class="col-md-4"><label class="form-label">Address</label><input type="text" name="ref_add[]" class="form-control form-control-sm" required></div>
    </div>
    <div class="position-row dynamic-row-wrapper row g-3">
        <div class="col-md-3"><label class="form-label">Department</label><select name="pos_dept[]" class="form-select form-select-sm" required><option value="">Select</option><?php foreach($departments as $d): ?><option><?= $d['dept_name'] ?></option><?php endforeach; ?></select></div>
        <div class="col-md-3"><label class="form-label">Position</label><select name="pos_name[]" class="form-select form-select-sm" required><option value="">Select</option><?php foreach($positions as $p): ?><option><?= $p['pos_name'] ?></option><?php endforeach; ?></select></div>
        <div class="col-md-2"><label class="form-label">Monthly</label><input type="number" step="0.01" name="pos_m[]" class="form-control form-control-sm monthly-input" required oninput="calcSalary(this)"></div>
        <div class="col-md-2"><label class="form-label">Daily</label><input type="text" name="pos_d[]" class="form-control form-control-sm daily-input" readonly></div>
        <div class="col-md-2"><label class="form-label">Hourly</label><input type="text" name="pos_h[]" class="form-control form-control-sm hourly-input" readonly></div>
        <div class="col-md-3"><label class="form-label">Start Date</label><input type="date" name="pos_start[]" class="form-control form-control-sm" required></div>
        <div class="col-md-3"><label class="form-label">End Date</label><input type="date" name="pos_end[]" class="form-control form-control-sm"></div>
    </div>
</div>

<script>
const allRecords = <?= json_encode($all_records) ?>;
let filteredRecords = [...allRecords];
let currentPage = 1;
const recordsPerPage = 10;

const MAPS = {
    emergency: { name: 'ec_name', relationship: 'ec_rel', contact: 'ec_contact', address: 'ec_add' },
    dependent: { name: 'dep_name', relationship: 'dep_rel', bdate: 'dep_bdate' },
    education: { level: 'ed_level', school: 'ed_school', address: 'ed_add', sy: 'ed_sy' },
    reference: { name: 'ref_name', occupation: 'ref_occ', contact: 'ref_contact', address: 'ref_add' },
    position:  { department: 'pos_dept', position: 'pos_name', monthly: 'pos_m', daily: 'pos_d', hourly: 'pos_h', start_date: 'pos_start', end_date: 'pos_end' }
};

function showToast(msg, type = 'success') {
    const toastEl = document.getElementById('liveToast');
    document.getElementById('toastMessage').innerText = msg;
    toastEl.className = `toast align-items-center text-white border-0 bg-${type === 'success' ? 'success' : 'danger'}`;
    new bootstrap.Toast(toastEl).show();
}

window.onload = () => {
    const params = new URLSearchParams(window.location.search);
    if(params.has('msg')) showToast(params.get('msg') === 'saved' ? 'Record saved!' : 'Record deleted!');

    Object.keys(MAPS).forEach(tab => addRow(tab));
    renderRecords();
};

function applyFilters() {
    const term = document.getElementById('recordSearch').value.toLowerCase();
    const sort = document.getElementById('sortFilter').value;
    const dept = document.getElementById('deptFilter').value;
    const pos = document.getElementById('posFilter').value;

    filteredRecords = allRecords.filter(r => {
        const matchesSearch = r.ln.toLowerCase().includes(term) || r.fn.toLowerCase().includes(term) || r.employee_num.toLowerCase().includes(term);
        
        const matchesDept = dept === 'all' || (r.position && r.position.some(p => p.department === dept));
        
        const matchesPos = pos === 'all' || (r.position && r.position.some(p => p.position === pos));

        return matchesSearch && matchesDept && matchesPos;
    });

    if (sort === 'az') filteredRecords.sort((a, b) => a.ln.localeCompare(b.ln));
    else if (sort === 'za') filteredRecords.sort((a, b) => b.ln.localeCompare(a.ln));
    else if (sort === 'newest') filteredRecords.sort((a, b) => b.employee_id - a.employee_id);
    else if (sort === 'oldest') filteredRecords.sort((a, b) => a.employee_id - b.employee_id);

    currentPage = 1;
    renderRecords();
}

function renderRecords() {
    const container = document.getElementById('recordsListBody');
    container.innerHTML = '';
    const start = (currentPage - 1) * recordsPerPage;
    const paginated = filteredRecords.slice(start, start + recordsPerPage);

    if(paginated.length === 0) {
        container.innerHTML = '<div class="text-center p-5 text-white opacity-50">No records found.</div>';
    }

    paginated.forEach(data => {
        const div = document.createElement('div');
        div.className = 'record-card shadow-sm';
        div.onclick = () => populateForm(data);
        div.innerHTML = `
            <div class="row g-3 align-items-center">
                <div class="col-md-1 text-center"><div class="bg-primary text-white rounded-circle p-2 d-inline-block" style="width:35px;height:35px; line-height:20px;">${data.fn[0].toUpperCase()}${data.ln[0].toUpperCase()}</div></div>
                <div class="col-md-2"><small class="text-muted d-block text-uppercase" style="font-size:9px">Emp #</small><span class="fw-bold text-dark">${data.employee_num}</span></div>
                <div class="col-md-4"><small class="text-muted d-block text-uppercase" style="font-size:9px">Name</small><span class="fw-bold text-dark">${data.ln}, ${data.fn}</span></div>
                <div class="col-md-3"><small class="text-muted d-block text-uppercase" style="font-size:9px">Contact</small><span class="fw-bold text-dark">${data.contact}</span></div>
                <div class="col-md-2 text-end">
                    <button class="btn btn-sm btn-danger rounded-pill px-3" onclick="confirmDelete(event, '${data.employee_num}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    const maxPage = Math.max(1, Math.ceil(filteredRecords.length / recordsPerPage));
    document.getElementById('pageInfo').innerText = `Page ${currentPage} of ${maxPage} (${filteredRecords.length} records)`;
}

function changePage(dir) {
    const maxPage = Math.ceil(filteredRecords.length / recordsPerPage);
    const next = currentPage + dir;
    if(next >= 1 && next <= maxPage) {
        currentPage = next;
        renderRecords();
    }
}

function populateForm(data) {
    const modal = bootstrap.Modal.getInstance(document.getElementById('empListModal'));
    if(modal) modal.hide();
    
    clearForm(false); 

    document.getElementById('e_pass').value = data.portal_pass;
    document.getElementById('original_pass').value = data.portal_pass;
    document.getElementById('e_id').value = data.employee_id;
    document.getElementById('e_num').value = data.employee_num;
    document.getElementById('e_ln').value = data.ln;
    document.getElementById('e_fn').value = data.fn;
    document.getElementById('e_mn').value = data.mn || "";
    document.getElementById('e_gender').value = data.gender;
    document.getElementById('e_email').value = data.email;
    document.getElementById('e_contact').value = data.contact;
    document.getElementById('e_civil').value = data.civil;
    document.getElementById('e_bdate').value = data.bdate;
    document.getElementById('e_perm').value = data.perm_add;
    document.getElementById('e_pres').value = data.pres_add;
    document.getElementById('e_nat').value = data.nationality;
    document.getElementById('e_rel').value = data.religion;

    if (data.photo) previewPhoto(null, data.photo);

    const idFields = { 'SSS': 'e_sss', 'PhilHealth': 'e_phil', 'Pag-IBIG': 'e_pag', 'ATM': 'e_atm', 'TIN': 'e_tin' };
    if(data.v_ids) data.v_ids.forEach(idRow => { if(idFields[idRow.type]) document.getElementById(idFields[idRow.type]).value = idRow.id_info; });

    Object.keys(MAPS).forEach(tabKey => {
        const container = document.getElementById(`container-${tabKey}`);
        container.innerHTML = ''; 
        if(data[tabKey] && data[tabKey].length > 0) data[tabKey].forEach(rowData => addRow(tabKey, rowData));
        else addRow(tabKey);
    });

    document.querySelector('.emp-tab-btn[data-tab="personal"]').click();
    showToast("Data loaded.");
}

function clearForm(notify = true) {
    const form = document.getElementById('empForm');
    form.reset();
    
    document.getElementById('e_id').value = "";
    document.getElementById('original_pass').value = "";
    document.getElementById('e_num').value = "<?= $next_id ?>";

    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

    Object.keys(MAPS).forEach(tabKey => {
        const container = document.getElementById(`container-${tabKey}`);
        container.innerHTML = ''; 
        addRow(tabKey);
    });

    previewPhoto(null, null);
    if(notify) showToast("All fields cleared.");
}

function confirmDelete(event, num) {
    if(event) event.stopPropagation(); 
    
    document.getElementById('confirmTitle').innerText = "Confirm Delete";
    document.getElementById('confirmText').innerText = "Are you sure you want to delete employee " + num + "? This action cannot be undone.";
    
    const btn = document.getElementById('confirmActionBtn');
    btn.className = "btn btn-danger btn-sm px-3";
    btn.innerText = "Delete Permanently";
    btn.onclick = () => window.location.href = "emp_logic.php?del=" + num;
    
    new bootstrap.Modal(document.getElementById('confirmModal')).show();
}

function validateAndSave() {
    const inputs = document.querySelectorAll('#empForm input[required], #empForm select[required]');
    let valid = true;
    let firstErr = null;
    
    inputs.forEach(i => {
        if(!i.value.trim()){
            i.classList.add('is-invalid');
            valid = false;
            if(!firstErr) firstErr = i.closest('.emp-pane').dataset.pane;
        } else {
            i.classList.remove('is-invalid');
        }
    });

    if(!valid) {
        showToast("Fill in required fields.", "danger");
        document.querySelector(`.emp-tab-btn[data-tab="${firstErr}"]`).click();
        return;
    }

    const currentPass = document.getElementById('e_pass').value;
    const originalPass = document.getElementById('original_pass').value;
    const isEdit = document.getElementById('e_id').value !== "";

    if(isEdit && currentPass !== originalPass) {
        document.getElementById('confirmTitle').innerText = "Update Password?";
        document.getElementById('confirmText').innerText = "The login password for this employee has been changed. Do you want to proceed with the update?";
        const btn = document.getElementById('confirmActionBtn');
        btn.className = "btn btn-primary btn-sm px-3";
        btn.innerText = "Update";
        btn.onclick = () => document.getElementById('submitBtn').click();
        new bootstrap.Modal(document.getElementById('confirmModal')).show();
    } else {
        document.getElementById('submitBtn').click();
    }
}

function previewPhoto(input, src = null) {
    const previewDiv = document.getElementById('photoPreview');
    if (src) previewDiv.innerHTML = `<img src="${src}">`;
    else if (input && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => previewDiv.innerHTML = `<img src="${e.target.result}">`;
        reader.readAsDataURL(input.files[0]);
    } else previewDiv.innerHTML = `<i class="fas fa-camera text-muted"></i>`;
}

function calcSalary(input) {
    const row = input.closest('.dynamic-row-wrapper');
    const m = parseFloat(input.value) || 0;
    row.querySelector('.daily-input').value = (m / 26).toFixed(2);
    row.querySelector('.hourly-input').value = (m / 26 / 8).toFixed(2);
}

function addRow(tabKey, data = null) {
    const container = document.getElementById(`container-${tabKey}`);
    const template = document.querySelector(`.${tabKey}-row`);
    if(!template) return;

    const newRow = template.cloneNode(true);
    newRow.querySelectorAll('input, select').forEach(i => i.value = "");
    
    if(data) {
        const mapping = MAPS[tabKey];
        newRow.querySelectorAll('input, select').forEach(input => {
            const inputBaseName = input.name.replace('[]', '');
            for (let col in mapping) if (mapping[col] === inputBaseName) input.value = data[col] || "";
            if(inputBaseName === 'pos_m') calcSalary(input);
        });
    }

    const removeBtn = document.createElement('div');
    removeBtn.className = 'remove-row-btn';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.onclick = () => {
        if(container.children.length > 1) newRow.remove();
        else newRow.querySelectorAll('input, select').forEach(i => { i.value = ""; i.classList.remove('is-invalid'); });
    };
    newRow.appendChild(removeBtn);
    container.appendChild(newRow);
}

document.querySelectorAll('.emp-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.emp-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.emp-pane').forEach(p => p.classList.add('d-none'));
        btn.classList.add('active');
        document.querySelector(`.emp-pane[data-pane="${btn.dataset.tab}"]`).classList.remove('d-none');
    });
});
</script>