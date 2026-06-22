type CellarEmailPayload = {
  subject: string;
  html: string;
  text: string;
  to?: string[];
};

const cellarDefaultRecipients = ['boshea@jobzcafe.com', 'alanum@jobzcafe.com'];

function getCellarEmailRecipients() {
  const configured = Deno.env.get('CELLAR_NOTIFICATION_EMAILS');
  if (!configured) return cellarDefaultRecipients;
  const recipients = configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return recipients.length ? recipients : cellarDefaultRecipients;
}

function escapeCellarHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function cellarPresentationColleagueEmail(input: {
  to: string;
  presentationTitle: string;
  presentationUrl: string;
}): CellarEmailPayload {
  const subject = `JOBZ CAFE CELLAR presentation: ${input.presentationTitle}`;
  const text = [
    'A JOBZ CAFE CELLAR presentation has been shared with you.',
    '',
    input.presentationTitle,
    input.presentationUrl,
    '',
    'For the best experience, verify your own investor access so you receive presentation updates and can message the JOBZ CAFE team about the presentation.',
    '',
    'JOBZ CAFE does not keep your email address from this share action.',
  ].join('\n');
  const html = [
    '<div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#24151f;">',
    '<h2 style="margin:0 0 12px;">CELLAR presentation</h2>',
    `<p style="margin:0 0 16px;color:#6b5a65;">A JOBZ CAFE CELLAR presentation has been shared with you.</p>`,
    `<p style="margin:0 0 18px;font-weight:600;">${escapeCellarHtml(input.presentationTitle)}</p>`,
    `<p style="margin:0 0 18px;"><a href="${escapeCellarHtml(input.presentationUrl)}" style="color:#4f384c;font-weight:600;">Open the presentation</a></p>`,
    '<p style="margin:0 0 14px;color:#6b5a65;">For the best experience, verify your own investor access so you receive presentation updates and can message the JOBZ CAFE team about the presentation.</p>',
    '<p style="margin:0;color:#6b5a65;font-size:13px;">JOBZ CAFE does not keep your email address from this share action.</p>',
    '</div>',
  ].join('');

  return {
    subject,
    html,
    text,
    to: [input.to],
  };
}

export function cellarInvestorAccessRequestEmail(input: {
  email: string;
  firstName: string;
  lastName: string;
  investorCategory: string;
  title?: string;
  company?: string;
  investorAccessId?: string | null;
  investorProfileId?: string | null;
}): CellarEmailPayload {
  const fullName = `${input.firstName} ${input.lastName}`.trim();
  const subject = `CELLAR access request: ${fullName || input.email}`;
  const rows = [
    ['Name', fullName],
    ['Email', input.email],
    ['Investor type', input.investorCategory],
    ['Title', input.title || 'Not provided'],
    ['Company', input.company || 'Not provided'],
    ['Investor access ID', input.investorAccessId || 'Pending'],
    ['Investor profile ID', input.investorProfileId || 'Pending'],
  ];
  const text = [
    'A new CELLAR investor access request was submitted.',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Review this request in the CELLAR staff workspace.',
  ].join('\n');
  const htmlRows = rows
    .map(([label, value]) => (
      `<tr><td style="padding:6px 12px 6px 0;color:#6b5a65;">${escapeCellarHtml(label)}</td>` +
      `<td style="padding:6px 0;color:#24151f;font-weight:600;">${escapeCellarHtml(value)}</td></tr>`
    ))
    .join('');
  const html = [
    '<div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#24151f;">',
    '<h2 style="margin:0 0 12px;">New CELLAR investor access request</h2>',
    '<p style="margin:0 0 16px;color:#6b5a65;">An investor submitted a request from the CELLAR pitch workspace.</p>',
    `<table style="border-collapse:collapse;">${htmlRows}</table>`,
    '<p style="margin:18px 0 0;color:#6b5a65;">Review this request in the CELLAR staff workspace.</p>',
    '</div>',
  ].join('');

  return {
    subject,
    html,
    text,
    to: getCellarEmailRecipients(),
  };
}

export function cellarInvestorMessageEmail(input: {
  investorEmail?: string | null;
  investorName?: string | null;
  subject: string;
  body: string;
}): CellarEmailPayload {
  const investorLabel = input.investorName || input.investorEmail || 'CELLAR investor';
  const subject = `CELLAR investor message: ${input.subject || investorLabel}`;
  const rows = [
    ['Investor', investorLabel],
    ['Email', input.investorEmail || 'Not recorded'],
  ];
  const text = [
    'A CELLAR investor message was submitted.',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Message:',
    input.body,
    '',
    'Review and reply in the CELLAR staff workspace.',
  ].join('\n');
  const htmlRows = rows
    .map(([label, value]) => (
      `<tr><td style="padding:6px 12px 6px 0;color:#6b5a65;">${escapeCellarHtml(label)}</td>` +
      `<td style="padding:6px 0;color:#24151f;font-weight:600;">${escapeCellarHtml(value)}</td></tr>`
    ))
    .join('');
  const html = [
    '<div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#24151f;">',
    '<h2 style="margin:0 0 12px;">New CELLAR investor message</h2>',
    '<p style="margin:0 0 16px;color:#6b5a65;">An investor submitted a message from the CELLAR workspace.</p>',
    `<table style="border-collapse:collapse;">${htmlRows}</table>`,
    '<h3 style="margin:18px 0 8px;">Message</h3>',
    `<div style="white-space:pre-wrap;border:1px solid #e7dbe3;border-radius:8px;padding:12px;color:#24151f;">${escapeCellarHtml(input.body)}</div>`,
    '<p style="margin:18px 0 0;color:#6b5a65;">Review and reply in the CELLAR staff workspace.</p>',
    '</div>',
  ].join('');

  return {
    subject,
    html,
    text,
    to: getCellarEmailRecipients(),
  };
}

export function cellarInvestorNotesEmail(input: {
  investorEmail?: string | null;
  investorName?: string | null;
  subject: string;
  body: string;
}): CellarEmailPayload {
  const investorLabel = input.investorName || input.investorEmail || 'CELLAR investor';
  const subject = `CELLAR investor notes: ${input.subject || investorLabel}`;
  const rows = [
    ['Investor', investorLabel],
    ['Email', input.investorEmail || 'Not recorded'],
  ];
  const text = [
    'A CELLAR investor sent notes from the presentation workspace.',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Notes:',
    input.body,
    '',
    'Review these slide notes separately from the investor message inbox.',
  ].join('\n');
  const htmlRows = rows
    .map(([label, value]) => (
      `<tr><td style="padding:6px 12px 6px 0;color:#6b5a65;">${escapeCellarHtml(label)}</td>` +
      `<td style="padding:6px 0;color:#24151f;font-weight:600;">${escapeCellarHtml(value)}</td></tr>`
    ))
    .join('');
  const html = [
    '<div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#24151f;">',
    '<h2 style="margin:0 0 12px;">CELLAR investor notes</h2>',
    '<p style="margin:0 0 16px;color:#6b5a65;">An investor sent notes from the CELLAR presentation workspace.</p>',
    `<table style="border-collapse:collapse;">${htmlRows}</table>`,
    '<h3 style="margin:18px 0 8px;">Notes</h3>',
    `<div style="white-space:pre-wrap;border:1px solid #e7dbe3;border-radius:8px;padding:12px;color:#24151f;">${escapeCellarHtml(input.body)}</div>`,
    '<p style="margin:18px 0 0;color:#6b5a65;">Review these slide notes separately from the investor message inbox.</p>',
    '</div>',
  ].join('');

  return {
    subject,
    html,
    text,
    to: getCellarEmailRecipients(),
  };
}

export async function cellarSendEmail(payload: CellarEmailPayload) {
  const apiKey = Deno.env.get('CELLAR_RESEND_API_KEY') ?? Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return {
      sent: false,
      reason: 'CELLAR_EMAIL_PROVIDER_NOT_CONFIGURED',
    };
  }

  const from = Deno.env.get('CELLAR_EMAIL_FROM') ?? 'JOBZ CAFE® <noreply@auth.jobzcafe.com>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: payload.to ?? getCellarEmailRecipients(),
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      sent: false,
      reason: result?.message ?? result?.error ?? 'CELLAR_EMAIL_SEND_FAILED',
    };
  }

  return {
    sent: true,
    id: result?.id ?? null,
  };
}
