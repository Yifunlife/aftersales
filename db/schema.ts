import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const employees = sqliteTable('employees', {
 id:text('id').primaryKey(), employeeId:text('employee_id'),email:text('email'),name:text('name').notNull(),role:text('role').notNull(),active:integer('active').notNull().default(1),mustChange:integer('must_change').notNull().default(1),hash:text('hash').notNull(),salt:text('salt').notNull(),version:integer('version').notNull().default(1),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()
}, t=>[uniqueIndex('employee_id_unique').on(t.employeeId),uniqueIndex('employee_email_unique').on(t.email)]);
export const sessions=sqliteTable('sessions',{token:text('token').primaryKey(),userId:text('user_id').notNull().references(()=>employees.id,{onDelete:'cascade'}),version:integer('version').notNull(),expires:integer('expires').notNull()});
export const loginLimits=sqliteTable('login_limits',{key:text('key').primaryKey(),attempts:integer('attempts').notNull(),until:integer('until').notNull()});
export const audit=sqliteTable('account_audit',{id:text('id').primaryKey(),actor:text('actor').notNull(),target:text('target').notNull(),action:text('action').notNull(),at:integer('at').notNull()});

// Customer intake is durable and separate from the legacy workflow examples.
export const customerProfiles=sqliteTable('customer_profiles',{
 id:text('id').primaryKey(),marketId:text('market_id'),company:text('company').notNull(),contact:text('contact').notNull(),email:text('email').notNull(),phone:text('phone').notNull(),country:text('country').notNull(),language:text('language').notNull(),salesOwner:text('sales_owner').notNull(),updatedAt:integer('updated_at').notNull()
},t=>[uniqueIndex('customer_market_id_unique').on(t.marketId)]);
export const customerStores=sqliteTable('customer_stores',{
 id:text('id').primaryKey(),customerId:text('customer_id').notNull().references(()=>customerProfiles.id),marketId:text('market_id'),name:text('name').notNull(),orderNo:text('order_no').notNull(),address:text('address').notNull(),contact:text('contact').notNull(),email:text('email').notNull(),phone:text('phone').notNull(),updatedAt:integer('updated_at').notNull()
},t=>[uniqueIndex('store_market_id_unique').on(t.marketId)]);
export const customerInvites=sqliteTable('customer_invites',{
 id:text('id').primaryKey(),customerId:text('customer_id').notNull().references(()=>customerProfiles.id),tokenHash:text('token_hash').notNull(),active:integer('active').notNull().default(1),expires:integer('expires').notNull(),createdBy:text('created_by').notNull(),createdAt:integer('created_at').notNull()
},t=>[uniqueIndex('customer_invite_token_unique').on(t.tokenHash)]);
export const customerRequests=sqliteTable('customer_requests',{
 id:text('id').primaryKey(),customerId:text('customer_id').notNull().references(()=>customerProfiles.id),storeId:text('store_id').notNull().references(()=>customerStores.id),inviteId:text('invite_id').notNull().references(()=>customerInvites.id),submissionKey:text('submission_key').notNull(),status:text('status').notNull(),payload:text('payload').notNull(),note:text('note').notNull(),reviewerId:text('reviewer_id'),checkedBy:text('checked_by'),submittedAt:integer('submitted_at').notNull(),updatedAt:integer('updated_at').notNull()
},t=>[uniqueIndex('customer_request_submission_unique').on(t.inviteId,t.submissionKey)]);
export const customerWorkItems=sqliteTable('customer_work_items',{
 id:text('id').primaryKey(),requestId:text('request_id').notNull().references(()=>customerRequests.id),payload:text('payload').notNull(),version:integer('version').notNull().default(1),updatedAt:integer('updated_at').notNull(),updatedBy:text('updated_by').notNull()
});
export const customerFiles=sqliteTable('customer_files',{
 id:text('id').primaryKey(),requestId:text('request_id').notNull().references(()=>customerRequests.id),objectKey:text('object_key').notNull(),name:text('name').notNull(),mime:text('mime').notNull(),size:integer('size').notNull()
});
export const customerRateLimits=sqliteTable('customer_rate_limits',{key:text('key').primaryKey(),attempts:integer('attempts').notNull(),until:integer('until').notNull()});

// Attachments from staff-created workflows also live exclusively in R2.
export const staffFiles=sqliteTable('staff_files',{
 id:text('id').primaryKey(),objectKey:text('object_key').notNull(),name:text('name').notNull(),mime:text('mime').notNull(),size:integer('size').notNull(),uploadedBy:text('uploaded_by').notNull().references(()=>employees.id),createdAt:integer('created_at').notNull()
});
