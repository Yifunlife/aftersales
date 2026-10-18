import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const employees = sqliteTable('employees', {
 id:text('id').primaryKey(), employeeId:text('employee_id'),email:text('email'),name:text('name').notNull(),role:text('role').notNull(),active:integer('active').notNull().default(1),mustChange:integer('must_change').notNull().default(1),hash:text('hash').notNull(),salt:text('salt').notNull(),version:integer('version').notNull().default(1),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()
}, t=>[uniqueIndex('employee_id_unique').on(t.employeeId),uniqueIndex('employee_email_unique').on(t.email)]);
export const sessions=sqliteTable('sessions',{token:text('token').primaryKey(),userId:text('user_id').notNull().references(()=>employees.id,{onDelete:'cascade'}),version:integer('version').notNull(),expires:integer('expires').notNull()});
export const loginLimits=sqliteTable('login_limits',{key:text('key').primaryKey(),attempts:integer('attempts').notNull(),until:integer('until').notNull()});
export const audit=sqliteTable('account_audit',{id:text('id').primaryKey(),actor:text('actor').notNull(),target:text('target').notNull(),action:text('action').notNull(),at:integer('at').notNull()});
