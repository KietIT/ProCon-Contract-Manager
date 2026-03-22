-- CreateIndex
CREATE INDEX "approval_requests_approver_user_id_status_idx" ON "approval_requests"("approver_user_id", "status");

-- CreateIndex
CREATE INDEX "approval_requests_milestone_id_idx" ON "approval_requests"("milestone_id");

-- CreateIndex
CREATE INDEX "contracts_project_id_idx" ON "contracts"("project_id");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "cost_entries_contract_id_idx" ON "cost_entries"("contract_id");

-- CreateIndex
CREATE INDEX "milestones_contract_id_idx" ON "milestones"("contract_id");

-- CreateIndex
CREATE INDEX "milestones_due_date_idx" ON "milestones"("due_date");

-- CreateIndex
CREATE INDEX "users_org_id_idx" ON "users"("org_id");
