<?php
require 'db.php';

// --- DEPARTMENTS ---

if (isset($_POST['save_dept'])) {
    $id = $_POST['dept_id'];
    $name = strtoupper(trim($_POST['dept_name']));

    if (!empty($id)) {
        // Get old name first to update employee records
        $old = $conn->prepare("SELECT dept_name FROM department WHERE dept_id = ?");
        $old->execute([$id]);
        $old_name = $old->fetchColumn();

        // Update linked employees
        $stmtEmp = $conn->prepare("UPDATE employee_position SET department = ? WHERE department = ?");
        $stmtEmp->execute([$name, $old_name]);

        // Update department table
        $stmt = $conn->prepare("UPDATE department SET dept_name = ? WHERE dept_id = ?");
        $stmt->execute([$name, $id]);
        $msg = "Department Updated Succesfully";
    } else {
        $stmt = $conn->prepare("INSERT INTO department (dept_name) VALUES (?)");
        $stmt->execute([$name]);
        $msg = "Department Added Succesfully";
    }
    header("Location: dep_and_pos.php?msg=$msg");
    exit();
}

if (isset($_GET['delete_dept'])) {
    $id = $_GET['delete_dept'];
    
    // Get name to set employees to "Not Available"
    $old = $conn->prepare("SELECT dept_name FROM department WHERE dept_id = ?");
    $old->execute([$id]);
    $dept_name = $old->fetchColumn();

    // Update employees to "Department not available"
    $stmtEmp = $conn->prepare("UPDATE employee_position SET department = 'Department not available' WHERE department = ?");
    $stmtEmp->execute([$dept_name]);

    // Delete record
    $stmt = $conn->prepare("DELETE FROM department WHERE dept_id = ?");
    $stmt->execute([$id]);
    
    header("Location: dep_and_pos.php?msg=Deleted Succesfully");
    exit();
}

// --- POSITIONS ---

if (isset($_POST['save_pos'])) {
    $id = $_POST['pos_id'];
    $name = strtoupper(trim($_POST['pos_name']));

    if (!empty($id)) {
        // Get old name first to update employee records
        $old = $conn->prepare("SELECT pos_name FROM position WHERE pos_id = ?");
        $old->execute([$id]);
        $old_name = $old->fetchColumn();

        // Update linked employees
        $stmtEmp = $conn->prepare("UPDATE employee_position SET position = ? WHERE position = ?");
        $stmtEmp->execute([$name, $old_name]);

        // Update position table
        $stmt = $conn->prepare("UPDATE position SET pos_name = ? WHERE pos_id = ?");
        $stmt->execute([$name, $id]);
        $msg = "Position Updated Succesfully";
    } else {
        $stmt = $conn->prepare("INSERT INTO position (pos_name) VALUES (?)");
        $stmt->execute([$name]);
        $msg = "Position Added Succesfully";
    }
    header("Location: dep_and_pos.php?msg=$msg");
    exit();
}

if (isset($_GET['delete_pos'])) {
    $id = $_GET['delete_pos'];

    // Get name to set employees to "Not Available"
    $old = $conn->prepare("SELECT pos_name FROM position WHERE pos_id = ?");
    $old->execute([$id]);
    $pos_name = $old->fetchColumn();

    // Update employees to "Position not available"
    $stmtEmp = $conn->prepare("UPDATE employee_position SET position = 'Position not available' WHERE position = ?");
    $stmtEmp->execute([$pos_name]);

    $stmt = $conn->prepare("DELETE FROM position WHERE pos_id = ?");
    $stmt->execute([$id]);
    header("Location: dep_and_pos.php?msg=Deleted Succesfully");
    exit();
}