alter table notifications add column loan_id uuid references loans(id) on delete set null;

create index notifications_loan_idx on notifications (loan_id, template) where loan_id is not null;
