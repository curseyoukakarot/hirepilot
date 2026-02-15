import { IgniteProposalComputed } from '../types/proposalComputed';

function escapeHtml(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function renderEventProposalPdfHtml(args: {
  proposal: IgniteProposalComputed;
  optionId?: string | null;
}): string {
  const proposal = args.proposal;
  const selected =
    proposal.options.find((option) => option.id === args.optionId) ||
    proposal.options.find((option) => option.isRecommended) ||
    proposal.options[0];

  if (!selected) {
    throw new Error('No proposal option available for PDF rendering');
  }

  const categoryRows = selected.breakdown
    .map(
      (row) => `<tr><td>${escapeHtml(row.categoryName)}</td><td class="right">${formatMoney(row.amount)}</td></tr>`
    )
    .join('');

  const includedCards = proposal.included.sections
    .map(
      (section) => `
        <div class="card">
          <h3 style="margin-top:0;">${escapeHtml(section.title)}</h3>
          <ul class="bullets">
            ${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}
          </ul>
        </div>
      `
    )
    .join('');

  const lineItemsTable =
    proposal.visibilityRules.showLineItems && selected.lineItems.length
      ? `
      <h2>Line Item Detail</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Item</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${selected.lineItems
            .map(
              (line) => `
            <tr>
              <td>${escapeHtml(line.category)}</td>
              <td>${escapeHtml(line.name)}</td>
              <td class="right">${formatMoney(line.amount)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>IgniteGTM - Event Proposal (PDF)</title>
  <style>
    @page { size: Letter; margin: 1.9in 0.75in 1in 0.75in; }
    :root{ --ink:#0b1220; --muted:#4b5563; --line:#e5e7eb; --soft:#f6f7fb; --brand:#4f46e5; }
    * { box-sizing: border-box; }
    body { margin:0; color:var(--ink); font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; font-size:12px; line-height:1.4; print-color-adjust:exact; background:#fff; }
    header { position:fixed; top:0; left:0; right:0; height:1.25in; border-bottom:1px solid var(--line); padding:0.28in 0 0.16in 0; background:#fff; }
    footer { position:fixed; bottom:0; left:0; right:0; height:0.75in; border-top:1px solid var(--line); padding:0.15in 0 0.2in 0; color:var(--muted); font-size:10px; background:#fff; }
    main { padding-top: 0.08in; }
    .header-row{display:flex;align-items:center;justify-content:space-between;gap:16px;}
    .brand-left{display:flex;align-items:center;gap:12px;}
    .logo{height:32px;width:auto;display:block;}
    .brand-name{font-weight:700;font-size:12px;}
    .brand-sub{color:var(--muted);font-size:10px;}
    .confidential{font-size:10px;font-weight:700;color:var(--brand);letter-spacing:.08em;}
    .addr{color:var(--muted);font-size:10px;max-width:340px;text-align:right;}
    .footer-row{display:flex;justify-content:space-between;align-items:flex-end;}
    .page-num:before{content:counter(page);} .page-count:before{content:counter(pages);}
    h1{font-size:28px;line-height:1.1;margin:20px 0 8px 0;letter-spacing:-0.3px;}
    h2{font-size:16px;margin:26px 0 10px 0;letter-spacing:-0.2px;}
    h3{font-size:12px;margin:14px 0 8px 0;}
    .muted{color:var(--muted);} .small{font-size:10px;}
    .pill-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}
    .pill{border:1px solid var(--line);padding:6px 10px;border-radius:999px;font-size:10px;}
    .hero-grid{display:grid;grid-template-columns:1.2fr 0.8fr;gap:18px;margin-top:14px;align-items:start;}
    .card{border:1px solid var(--line);border-radius:14px;background:#fff;padding:14px;}
    .card.soft{background:var(--soft);border-color:#e9eaf2;}
    .kpi-title{text-transform:uppercase;letter-spacing:.10em;font-size:10px;color:var(--muted);margin-bottom:4px;}
    .kpi-value{font-size:26px;font-weight:800;letter-spacing:-0.4px;margin:2px 0 6px 0;}
    .two-kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;}
    .kpi-mini{border:1px solid var(--line);border-radius:12px;padding:10px;background:#fff;}
    .kpi-mini .label{font-size:10px;color:var(--muted);} .kpi-mini .val{font-weight:700;margin-top:4px;}
    .table{width:100%;border-collapse:collapse;margin-top:10px;border:1px solid var(--line);}
    .table thead th{text-align:left;background:var(--soft);padding:10px;font-size:10px;color:var(--muted);border-bottom:1px solid var(--line);letter-spacing:.08em;text-transform:uppercase;}
    .table tbody td{padding:10px;border-bottom:1px solid var(--line);vertical-align:top;}
    .table tbody tr:last-child td{border-bottom:none;}
    .right{text-align:right;}
    .total-row td{font-weight:800;background:#fff;}
    .highlight-total{border:2px solid rgba(79,70,229,.25);background:rgba(79,70,229,.06);border-radius:14px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;margin-top:12px;}
    .tval{font-size:18px;font-weight:900;}
    .section-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;}
    .bullets{margin:8px 0 0 0;padding-left:14px;}
    .bullets li{margin:6px 0;}
    .page-break{page-break-after:always;}
    .badge{display:inline-block;padding:4px 8px;border-radius:999px;font-size:10px;border:1px solid rgba(79,70,229,.25);background:rgba(79,70,229,.08);color:var(--brand);font-weight:800;}
  </style>
</head>
<body>
  <header>
    <div class="header-row">
      <div class="brand-left">
        <img class="logo" src="http://cdn.mcauto-images-production.sendgrid.net/a6712336a2649f82/23257b38-cdf1-498a-8d1d-00c22d91638b/454x137.png" alt="IgniteGTM" />
        <div>
          <div class="brand-name">IgniteGTM</div>
          <div class="brand-sub">Event Proposal</div>
        </div>
      </div>
      <div>
        <div class="confidential">CONFIDENTIAL</div>
        <div class="addr">3031 Tisch Way, 110 Plaza West San Jose, CA 95128 USA</div>
        <div class="brand-sub" style="text-align:right;">ignitegtm.com</div>
      </div>
    </div>
  </header>
  <footer>
    <div class="footer-row">
      <div>
        <div><strong>IgniteGTM</strong> - Event Proposal</div>
        <div class="small">Prepared for ${escapeHtml(proposal.clientName)} - Updated ${escapeHtml(
    proposal.updatedAt
  )}</div>
      </div>
      <div class="small">Page <span class="page-num"></span> of <span class="page-count"></span></div>
    </div>
  </footer>
  <main>
    <section>
      <div class="badge">Proposal ready for review</div>
      <h1>${escapeHtml(proposal.eventName)}</h1>
      <div class="muted" style="font-size:13px;max-width:640px;">${escapeHtml(
        proposal.overview.objective || selected.description || 'Event proposal prepared by IgniteGTM.'
      )}</div>
      <div class="pill-row">
        <div class="pill"><strong>Client:</strong> ${escapeHtml(proposal.clientName)}</div>
        <div class="pill"><strong>Headcount:</strong> ${escapeHtml(proposal.headcount)}</div>
        <div class="pill"><strong>Venue:</strong> ${escapeHtml(proposal.location)}</div>
        <div class="pill"><strong>City:</strong> ${escapeHtml(proposal.eventSnapshot.city || 'TBD')}</div>
        <div class="pill"><strong>Time:</strong> ${escapeHtml(proposal.eventSnapshot.startTime || 'TBD')} - ${escapeHtml(
    proposal.eventSnapshot.endTime || 'TBD'
  )}</div>
        ${
          proposal.eventSnapshot.primarySponsor
            ? `<div class="pill"><strong>Sponsor:</strong> ${escapeHtml(proposal.eventSnapshot.primarySponsor)}</div>`
            : ''
        }
        ${
          proposal.eventSnapshot.coSponsors.length
            ? `<div class="pill"><strong>Co-Sponsors:</strong> ${escapeHtml(
                proposal.eventSnapshot.coSponsors.join(', ')
              )}</div>`
            : ''
        }
        <div class="pill"><strong>Model:</strong> ${escapeHtml(proposal.modelType)}</div>
      </div>
      <div class="hero-grid">
        <div class="card soft">
          <h2 style="margin-top:0;">Executive Summary</h2>
          <p class="muted" style="margin:0;">${escapeHtml(
            proposal.overview.objective ||
              selected.description ||
              'IgniteGTM will manage planning and execution for a premium event experience.'
          )}</p>
          ${
            proposal.overview.successCriteria.length
              ? `<div style="margin-top:10px;">
            <div class="kpi-title">Success Criteria</div>
            <ul class="bullets">${proposal.overview.successCriteria
              .map((line) => `<li>${escapeHtml(line)}</li>`)
              .join('')}</ul>
          </div>`
              : ''
          }
          <div class="section-grid">
            <div class="card">
              <div class="kpi-title">Selected Option</div>
              <div style="font-size:15px;font-weight:800;">${escapeHtml(selected.name)}</div>
            </div>
            <div class="card">
              <div class="kpi-title">Next Steps</div>
              <ul class="bullets">${proposal.nextSteps.bullets
                .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
                .join('')}</ul>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="kpi-title">Total Event Investment</div>
          <div class="kpi-value">${formatMoney(selected.totals.total)}</div>
          <div class="two-kpis">
            <div class="kpi-mini"><div class="label">Costs Subtotal</div><div class="val">${formatMoney(
              selected.totals.subtotal
            )}</div></div>
            <div class="kpi-mini"><div class="label">Ignite Fee</div><div class="val">${formatMoney(
              selected.totals.fee
            )}</div></div>
          </div>
          <div class="kpi-mini" style="margin-top:10px;"><div class="label">Contingency</div><div class="val">${formatMoney(
            selected.totals.contingency
          )}</div></div>
        </div>
      </div>
    </section>
    <div class="page-break"></div>
    <section>
      <h2 style="margin-top:0;">Investment Breakdown (${escapeHtml(selected.name)})</h2>
      <table class="table">
        <thead><tr><th>Category</th><th class="right">Investment</th></tr></thead>
        <tbody>
          ${categoryRows}
          <tr><td>Ignite Management Fee</td><td class="right">${formatMoney(selected.totals.fee)}</td></tr>
          <tr><td>Contingency</td><td class="right">${formatMoney(selected.totals.contingency)}</td></tr>
          <tr class="total-row"><td>Total Event Investment</td><td class="right">${formatMoney(selected.totals.total)}</td></tr>
        </tbody>
      </table>
      <div class="highlight-total">
        <div class="tlabel">Total Event Investment</div>
        <div class="tval">${formatMoney(selected.totals.total)}</div>
      </div>
      ${lineItemsTable}
    </section>
    <div class="page-break"></div>
    <section>
      <h2 style="margin-top:0;">What's Included</h2>
      <div class="section-grid">${includedCards}</div>
      <div class="card" style="margin-top:14px;">
        <h3 style="margin-top:0;">Agreement Terms</h3>
        <table class="table">
          <tbody>
            <tr><td>Deposit Percentage</td><td class="right">${escapeHtml(proposal.agreementTerms.depositPercent)}%</td></tr>
            <tr><td>Deposit Due</td><td class="right">${escapeHtml(
              proposal.agreementTerms.depositDueRule || 'Per agreement'
            )}</td></tr>
            <tr><td>Balance Due</td><td class="right">${escapeHtml(
              proposal.agreementTerms.balanceDueRule || 'Per agreement'
            )}</td></tr>
            <tr><td>Cancellation Window</td><td class="right">${escapeHtml(
              proposal.agreementTerms.cancellationWindowDays
            )} days</td></tr>
            <tr><td>Confidentiality</td><td class="right">${proposal.agreementTerms.confidentialityEnabled ? 'Enabled' : 'Disabled'}</td></tr>
            ${
              proposal.agreementTerms.costSplitNotes
                ? `<tr><td>Cost Split Notes</td><td class="right">${escapeHtml(
                    proposal.agreementTerms.costSplitNotes
                  )}</td></tr>`
                : ''
            }
            ${
              proposal.agreementTerms.signerName || proposal.agreementTerms.signerEmail
                ? `<tr><td>Client Signer</td><td class="right">${escapeHtml(
                    `${proposal.agreementTerms.signerName || ''} ${proposal.agreementTerms.signerTitle ? `(${proposal.agreementTerms.signerTitle})` : ''} ${proposal.agreementTerms.signerEmail ? `- ${proposal.agreementTerms.signerEmail}` : ''}`
                  )}</td></tr>`
                : ''
            }
          </tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`;
}
