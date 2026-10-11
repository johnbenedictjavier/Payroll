<?php
require 'db.php';

if (isset($_GET['del'])) {
    $emp_num = $_GET['del'];
    try {
        $conn->beginTransaction();
        $conn->prepare("DELETE FROM user WHERE employee_num = ?")->execute([$emp_num]);
        $conn->prepare("DELETE FROM e_contact WHERE employee_num = ?")->execute([$emp_num]);
        $conn->prepare("DELETE FROM dependent WHERE employee_num = ?")->execute([$emp_num]);
        $conn->prepare("DELETE FROM educ_bg WHERE employee_num = ?")->execute([$emp_num]);
        $conn->prepare("DELETE FROM charac_ref WHERE employee_num = ?")->execute([$emp_num]);
        $conn->prepare("DELETE FROM employee_position WHERE employee_num = ?")->execute([$emp_num]);
        $conn->prepare("DELETE FROM valid_id WHERE employee_num = ?")->execute([$emp_num]);
        $conn->prepare("DELETE FROM employee_info WHERE employee_num = ?")->execute([$emp_num]);
        
        $conn->commit();
        header("Location: employee.php?msg=deleted");
    } catch (Exception $e) { 
        $conn->rollBack(); 
        die("Error deleting: " . $e->getMessage()); 
    }
    exit();
}

if (isset($_POST['save_employee'])) {
    $emp_id = $_POST['employee_id']; 
    $emp_num = $_POST['employee_num'];

    try {
        $conn->beginTransaction();

        $photo_path = ""; 
        if (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
            
            $upload_dir = __DIR__ . '/uploads/'; 
            
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0777, true);
            }

            $ext = pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION);
            $filename = $emp_num . "_" . time() . "." . $ext;
            
            $destination = $upload_dir . $filename;
            
            $db_save_path = 'uploads/' . $filename;

            if (move_uploaded_file($_FILES['photo']['tmp_name'], $destination)) {
                $photo_path = $db_save_path;
            } else {
                die("Failed to move uploaded file. Check folder permissions for: " . $upload_dir);
            }
        }

        if (!empty($emp_id)) {
            $sql = "UPDATE employee_info SET ln=?, fn=?, mn=?, gender=?, email=?, civil=?, nationality=?, religion=?, bdate=?, perm_add=?, pres_add=?, contact=?";
            $params = [
                $_POST['ln'], $_POST['fn'], $_POST['mn'], $_POST['gender'], 
                $_POST['email'], $_POST['civil'], $_POST['nationality'], $_POST['religion'], 
                $_POST['bdate'], $_POST['perm_add'], $_POST['pres_add'], $_POST['contact']
            ];
            
            if ($photo_path !== "") { 
                $sql .= ", photo=?"; 
                $params[] = $photo_path; 
            }
            
            $sql .= " WHERE employee_id=?";
            $params[] = $emp_id;
            
            $conn->prepare($sql)->execute($params);

            $usersql = "UPDATE user SET portal_pass=?, full_name=?";
            $fullname = $_POST['fn'] . " " . $_POST['ln'];
            $userparam = [
                $_POST['password'], $fullname
            ];
            $usersql .= " WHERE employee_num=?";
            $userparam[] = $emp_num;

            $conn->prepare($usersql)->execute($userparam);
        } else {
            $sql = "INSERT INTO employee_info (employee_num, ln, fn, mn, gender, email, civil, nationality, religion, bdate, perm_add, pres_add, contact, photo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
            $params = [
                $emp_num, $_POST['ln'], $_POST['fn'], $_POST['mn'], $_POST['gender'], 
                $_POST['email'], $_POST['civil'], $_POST['nationality'], $_POST['religion'], 
                $_POST['bdate'], $_POST['perm_add'], $_POST['pres_add'], $_POST['contact'], $photo_path
            ];
            $conn->prepare($sql)->execute($params);

            $pass = !empty($_POST['password']) ? $_POST['password'] : '123456';
            $fullname = $_POST['fn'] . " " . $_POST['ln'];
            $conn->prepare("INSERT INTO user (employee_num, portal_pass, full_name) VALUES (?,?,?)")->execute([$emp_num, $pass, $fullname]);
        }

        $conn->prepare("DELETE FROM valid_id WHERE employee_num=?")->execute([$emp_num]);
        $ids = ['SSS' => $_POST['val_sss'], 'PhilHealth' => $_POST['val_phil'], 'Pag-IBIG' => $_POST['val_pag'], 'ATM' => $_POST['val_atm'], 'TIN' => $_POST['val_tin']];
        foreach ($ids as $type => $val) {
            if (!empty($val)) $conn->prepare("INSERT INTO valid_id (employee_num, type, id_info) VALUES (?,?,?)")->execute([$emp_num, $type, $val]);
        }

        $tabs = ['e_contact', 'dependent', 'educ_bg', 'charac_ref', 'employee_position'];
        foreach($tabs as $t) $conn->prepare("DELETE FROM $t WHERE employee_num=?")->execute([$emp_num]);

        if (isset($_POST['ec_name'])) {
            foreach ($_POST['ec_name'] as $i => $v) if (!empty($v)) 
                $conn->prepare("INSERT INTO e_contact (employee_num, name, relationship, contact, address) VALUES (?,?,?,?,?)")->execute([$emp_num, $v, $_POST['ec_rel'][$i], $_POST['ec_contact'][$i], $_POST['ec_add'][$i]]);
        }
        if (isset($_POST['dep_name'])) {
            foreach ($_POST['dep_name'] as $i => $v) if (!empty($v)) 
                $conn->prepare("INSERT INTO dependent (employee_num, name, relationship, bdate) VALUES (?,?,?,?)")->execute([$emp_num, $v, $_POST['dep_rel'][$i], $_POST['dep_bdate'][$i]]);
        }
        if (isset($_POST['ed_level'])) {
            foreach ($_POST['ed_level'] as $i => $v) if (!empty($v)) 
                $conn->prepare("INSERT INTO educ_bg (employee_num, level, school, address, sy) VALUES (?,?,?,?,?)")->execute([$emp_num, $v, $_POST['ed_school'][$i], $_POST['ed_add'][$i], $_POST['ed_sy'][$i]]);
        }
        if (isset($_POST['ref_name'])) {
            foreach ($_POST['ref_name'] as $i => $v) if (!empty($v)) 
                $conn->prepare("INSERT INTO charac_ref (employee_num, name, occupation, contact, address) VALUES (?,?,?,?,?)")->execute([$emp_num, $v, $_POST['ref_occ'][$i], $_POST['ref_contact'][$i], $_POST['ref_add'][$i]]);
        }
        if (isset($_POST['pos_name'])) {
            foreach ($_POST['pos_name'] as $i => $v) if (!empty($v)) 
                $conn->prepare("INSERT INTO employee_position (employee_num, department, position, start_date, end_date, monthly, daily, hourly) VALUES (?,?,?,?,?,?,?,?)")->execute([$emp_num, $_POST['pos_dept'][$i], $v, $_POST['pos_start'][$i], $_POST['pos_end'][$i], $_POST['pos_m'][$i], $_POST['pos_d'][$i], $_POST['pos_h'][$i]]);
        }

        $conn->commit();
        header("Location: employee.php?msg=saved");
    } catch (Exception $e) { 
        $conn->rollBack(); 
        die("Error: " . $e->getMessage()); 
    }
}