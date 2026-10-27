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
 id:text('id').primaryKey(),accessMode:text('access_mode').notNull().default('full'),requestId:text('request_id'),customerId:text('customer_id').notNull().references(()=>customerProfiles.id),tokenHash:text('token_hash').notNull(),active:integer('active').notNull().default(1),expires:integer('expires').notNull(),createdBy:text('created_by').notNull(),createdAt:integer('created_at').notNull()
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

export const customerAccounts=sqliteTable('customer_accounts',{
 id:text('id').primaryKey(),customerId:text('customer_id').notNull().references(()=>customerProfiles.id),inviteId:text('invite_id').notNull().references(()=>customerInvites.id),username:text('username').notNull(),hash:text('hash').notNull(),salt:text('salt').notNull(),active:integer('active').notNull().default(1),mustChange:integer('must_change').notNull().default(1),version:integer('version').notNull().default(1),createdBy:text('created_by').notNull(),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()
},t=>[uniqueIndex('customer_username_unique').on(t.username)]);
export const customerSessions=sqliteTable('customer_sessions',{token:text('token').primaryKey(),accountId:text('account_id').notNull().references(()=>customerAccounts.id,{onDelete:'cascade'}),version:integer('version').notNull(),expires:integer('expires').notNull()});
export const knowledgeArticles=sqliteTable('knowledge_articles',{
 id:text('id').primaryKey(),productCode:text('product_code').notNull(),productName:text('product_name').notNull(),topicType:text('topic_type').notNull().default(''),title:text('title').notNull(),category:text('category').notNull(),summary:text('summary').notNull(),body:text('body').notNull(),links:text('links').notNull().default('[]'),status:text('status').notNull().default('draft'),language:text('language').notNull().default('zh'),version:integer('version').notNull().default(1),updatedBy:text('updated_by').notNull(),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()
});
export const knowledgeFiles=sqliteTable('knowledge_files',{id:text('id').primaryKey(),articleId:text('article_id').notNull().references(()=>knowledgeArticles.id),objectKey:text('object_key').notNull(),name:text('name').notNull(),mime:text('mime').notNull(),size:integer('size').notNull()});

// Raw source files and AI extraction outputs stay private in R2; D1 tracks the workflow.
export const knowledgeIntakes=sqliteTable('knowledge_intakes',{
 id:text('id').primaryKey(),label:text('label').notNull(),noteKey:text('note_key').notNull(),files:text('files').notNull(),status:text('status').notNull().default('pending'),error:text('error').notNull().default(''),resultKey:text('result_key').notNull().default(''),version:integer('version').notNull().default(1),createdBy:text('created_by').notNull(),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()
});
