-- =====================================================================
-- AURA Payroll System — Schema Migration
-- Run this ONCE against your existing database before using the new
-- dep_and_pos.php / employee.php files.
--
-- What this does:
--   1. Links each position to a department (position.department_id)
--   2. Adds a created_at timestamp to position (used for the "New" badge)
--   3. Links each employee to a department + position (for "View Staff")
-- =====================================================================

ALTER TABLE position
    ADD COLUMN department_id INT NULL AFTER position_name,
    ADD COLUMN created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER department_id,
    ADD CONSTRAINT fk_position_department
        FOREIGN KEY (department_id) REFERENCES department(id) ON DELETE CASCADE;

ALTER TABLE employee
    ADD COLUMN department_id INT NULL AFTER tin,
    ADD COLUMN position_id INT NULL AFTER department_id,
    ADD CONSTRAINT fk_employee_department
        FOREIGN KEY (department_id) REFERENCES department(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_employee_position
        FOREIGN KEY (position_id) REFERENCES position(id) ON DELETE SET NULL;

-- Optional: if you already have positions and want to assign them to a
-- department manually, use something like:
-- UPDATE position SET department_id = 1 WHERE id IN (1,2,3);
