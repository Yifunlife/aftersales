ALTER TABLE employees ADD COLUMN roles TEXT NOT NULL DEFAULT '[]';
UPDATE employees SET roles=json_array(role);
