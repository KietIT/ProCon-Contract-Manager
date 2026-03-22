import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM = process.env.EMAIL_FROM ?? 'noreply@tar-platform.com';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!resend) {
    console.log(`[email-stub] To: ${to} | Subject: ${subject}`);
    return;
  }

  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  });
}

export async function sendApprovalRequestEmail(opts: {
  approverEmail: string;
  approverName: string;
  requesterName: string;
  milestoneTitle: string;
  contractNumber: string;
  slaDeadline: Date;
}) {
  const deadlineStr = opts.slaDeadline.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  await sendEmail({
    to: opts.approverEmail,
    subject: `Approval Required: ${opts.milestoneTitle}`,
    html: `
      <h2>Approval Request</h2>
      <p><strong>${opts.requesterName}</strong> has requested your approval for milestone completion.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Milestone</td><td style="padding:4px 0"><strong>${opts.milestoneTitle}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Contract</td><td style="padding:4px 0">${opts.contractNumber}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">SLA Deadline</td><td style="padding:4px 0;color:#c00"><strong>${deadlineStr}</strong></td></tr>
      </table>
      <p>Please review and approve or reject this request before the SLA deadline.</p>
    `,
  });
}

export async function sendEscalationEmail(opts: {
  escalatedToEmail: string;
  escalatedToName: string;
  originalApproverName: string;
  milestoneTitle: string;
  contractNumber: string;
  originalDeadline: Date;
}) {
  const deadlineStr = opts.originalDeadline.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  await sendEmail({
    to: opts.escalatedToEmail,
    subject: `ESCALATION: Approval overdue — ${opts.milestoneTitle}`,
    html: `
      <h2 style="color:#c00">Escalated Approval Request</h2>
      <p>An approval request has breached its SLA deadline and has been escalated to you.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Milestone</td><td style="padding:4px 0"><strong>${opts.milestoneTitle}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Contract</td><td style="padding:4px 0">${opts.contractNumber}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Original Approver</td><td style="padding:4px 0">${opts.originalApproverName}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Missed Deadline</td><td style="padding:4px 0;color:#c00">${deadlineStr}</td></tr>
      </table>
      <p>Please review and take action immediately.</p>
    `,
  });
}

export async function sendApprovalDecisionEmail(opts: {
  requesterEmail: string;
  requesterName: string;
  approverName: string;
  milestoneTitle: string;
  contractNumber: string;
  decision: 'approved' | 'rejected';
  comments?: string | null;
}) {
  const isApproved = opts.decision === 'approved';

  await sendEmail({
    to: opts.requesterEmail,
    subject: `${isApproved ? 'Approved' : 'Rejected'}: ${opts.milestoneTitle}`,
    html: `
      <h2 style="color:${isApproved ? '#16a34a' : '#dc2626'}">${isApproved ? 'Approved' : 'Rejected'}</h2>
      <p><strong>${opts.approverName}</strong> has ${opts.decision} your milestone completion request.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Milestone</td><td style="padding:4px 0"><strong>${opts.milestoneTitle}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Contract</td><td style="padding:4px 0">${opts.contractNumber}</td></tr>
      </table>
      ${opts.comments ? `<p><strong>Comments:</strong> ${opts.comments}</p>` : ''}
    `,
  });
}
