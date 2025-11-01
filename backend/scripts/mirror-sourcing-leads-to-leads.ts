import { supabase } from '../src/lib/supabase';

async function mirrorForCampaign(campaignId: string) {
	const { data: campaign, error: cErr } = await supabase
		.from('sourcing_campaigns')
		.select('id, created_by, title')
		.eq('id', campaignId)
		.maybeSingle();
	if (cErr || !campaign) throw new Error(`Campaign not found: ${campaignId}`);
	const ownerUserId = (campaign as any).created_by as string;

	const { data: sLeads, error: sErr } = await supabase
		.from('sourcing_leads')
		.select('name, title, company, email, linkedin_url')
		.eq('campaign_id', campaignId);
	if (sErr) throw sErr;
	const incoming = (sLeads || []).filter((l: any) => !!l.email);
	if (!incoming.length) {
		console.log(`No sourcing leads with email to mirror for campaign ${campaignId}.`);
		return { inserted: 0 };
	}

	const emails = Array.from(
		new Set(incoming.map((l: any) => String(l.email).trim().toLowerCase()).filter(Boolean))
	);
	const { data: existing } = await supabase
		.from('leads')
		.select('email')
		.eq('user_id', ownerUserId)
		.in('email', emails);
	const existingEmails = new Set((existing || []).map((r: any) => String(r.email || '').toLowerCase()));

	const toInsert = incoming
		.filter((l: any) => !existingEmails.has(String(l.email).toLowerCase()))
		.map((l: any) => ({
			user_id: ownerUserId,
			name: l.name || l.email,
			email: l.email,
			title: l.title || null,
			company: l.company || null,
			linkedin_url: l.linkedin_url || null,
			campaign_id: null,
			source: 'sourcing_campaign'
		}));

	if (!toInsert.length) {
		console.log(`Nothing to insert; all ${incoming.length} leads already exist for user ${ownerUserId}.`);
		return { inserted: 0 };
	}
	await supabase.from('leads').insert(toInsert);
	console.log(`Inserted ${toInsert.length} lead(s) into base leads for campaign ${campaignId}.`);
	return { inserted: toInsert.length };
}

async function main() {
	const args = process.argv.slice(2);
	let campaignId: string | undefined;
	let userId: string | undefined;
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === '--campaign' || a === '-c') campaignId = args[++i];
		else if (a === '--user' || a === '-u') userId = args[++i];
	}
	if (!campaignId && !userId) {
		console.log('Usage: ts-node backend/scripts/mirror-sourcing-leads-to-leads.ts --campaign <sourcing_campaign_id> | --user <user_id>');
		process.exit(1);
	}

	if (campaignId) {
		await mirrorForCampaign(campaignId);
		return;
	}

	// Mirror for all campaigns by user
	const { data: campaigns, error: listErr } = await supabase
		.from('sourcing_campaigns')
		.select('id')
		.eq('created_by', userId);
	if (listErr) throw listErr;
	let total = 0;
	for (const c of campaigns || []) {
		const result = await mirrorForCampaign((c as any).id);
		total += Number((result as any)?.inserted || 0);
	}
	console.log(`Total inserted across user ${userId}: ${total}`);
}

main().catch((e) => {
	console.error('Mirror failed:', e?.message || e);
	process.exit(1);
});
