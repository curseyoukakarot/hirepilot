import { SourcingParamsT, WizardStateT, AgentPlanT } from './schemas';
import { supabase } from '../lib/supabase';

// Wizard session management
export class WizardSessionManager {
  private static sessions = new Map<string, WizardStateT>();

  static async createSession(userId: string, params: Partial<SourcingParamsT>): Promise<string> {
    const sessionId = `wizard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session: WizardStateT = {
      step: 'extract',
      params,
      user_id: userId,
      session_id: sessionId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.sessions.set(sessionId, session);
    
    // Optionally persist to database for production
    await this.persistSession(session);
    
    return sessionId;
  }

  static getSession(sessionId: string): WizardStateT | null {
    return this.sessions.get(sessionId) || null;
  }

  static updateSession(sessionId: string, updates: Partial<WizardStateT>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const updatedSession = {
      ...session,
      ...updates,
      updated_at: new Date().toISOString()
    };

    this.sessions.set(sessionId, updatedSession);
    
    // Optionally persist to database
    this.persistSession(updatedSession);
    
    return true;
  }

  static deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    
    // Optionally remove from database
    this.removePersistedSession(sessionId);
    
    return deleted;
  }

  static cleanupExpiredSessions(): number {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const sessionAge = now - new Date(session.created_at).getTime();
      if (sessionAge > maxAge) {
        this.sessions.delete(sessionId);
        this.removePersistedSession(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  private static async persistSession(session: WizardStateT): Promise<void> {
    try {
      await supabase
        .from('wizard_sessions')
        .upsert({
          session_id: session.session_id,
          user_id: session.user_id,
          step: session.step,
          params: session.params,
          created_at: session.created_at,
          updated_at: session.updated_at
        });
    } catch (error) {
      console.error('Error persisting wizard session:', error);
    }
  }

  private static async removePersistedSession(sessionId: string): Promise<void> {
    try {
      await supabase
        .from('wizard_sessions')
        .delete()
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('Error removing persisted session:', error);
    }
  }
}

// Parameter validation and transformation
export class ParameterProcessor {
  static validateTitleGroups(titles: string[]): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const title of titles) {
      const cleaned = title.trim();
      if (cleaned.length > 0 && cleaned.length <= 100) {
        valid.push(cleaned);
      } else {
        invalid.push(title);
      }
    }

    return { valid, invalid };
  }

  static normalizeIndustry(industry: string): string {
    const industryMap: Record<string, string> = {
      'tech': 'Technology',
      'healthcare': 'Healthcare',
      'finance': 'Financial Services',
      'fintech': 'Financial Services',
      'manufacturing': 'Manufacturing',
      'retail': 'Retail',
      'education': 'Education',
      'government': 'Government',
      'nonprofit': 'Non-profit',
      'consulting': 'Consulting',
      'media': 'Media & Entertainment'
    };

    const normalized = industry.toLowerCase().trim();
    return industryMap[normalized] || industry;
  }

  static validateEmailLimit(limit: number): number {
    return Math.max(10, Math.min(5000, limit));
  }

  static validateSpacing(days: number): number {
    return Math.max(1, Math.min(5, days));
  }

  static generateCampaignTitle(params: Partial<SourcingParamsT>): string {
    if (params.campaign_title) return params.campaign_title;

    const titlePart = params.title_groups?.slice(0, 2).join(' & ') || 'Sourcing';
    const industryPart = params.industry ? ` - ${params.industry}` : '';
    const datePart = new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });

    return `${titlePart}${industryPart} (${datePart})`;
  }
}

// Lead generation integration
export class LeadGenerator {
  static async generateLeads(params: SourcingParamsT): Promise<any[]> {
    // This would integrate with Apollo, LinkedIn Sales Navigator, etc.
    // For now, return mock data based on parameters
    
    const mockLeads = [];
    const leadCount = Math.min(params.limit, 100); // Limit for demo

    for (let i = 1; i <= leadCount; i++) {
      const titleIndex = (i - 1) % params.title_groups.length;
      const title = params.title_groups[titleIndex];
      
      mockLeads.push({
        name: `${this.generateName()} ${i}`,
        title,
        company: this.generateCompany(params.industry),
        email: `lead${i}@${this.generateDomain()}.com`,
        linkedin_url: `https://linkedin.com/in/lead${i}`,
        location: params.location || 'United States'
      });
    }

    return mockLeads;
  }

  private static generateName(): string {
    const firstNames = ['Alex', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Riley', 'Avery', 'Quinn'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    return `${firstName} ${lastName}`;
  }

  private static generateCompany(industry?: string): string {
    const techCompanies = ['TechCorp', 'InnovateLabs', 'DataFlow Inc', 'CloudTech', 'AI Solutions'];
    const healthCompanies = ['HealthTech', 'MedFlow', 'CareConnect', 'HealthPlus', 'MedInnovate'];
    const financeCompanies = ['FinTech Solutions', 'Capital Partners', 'InvestCorp', 'Financial Plus', 'MoneyFlow'];
    const defaultCompanies = ['Global Corp', 'Enterprise Inc', 'Business Solutions', 'Professional Services', 'Growth Company'];

    let companies = defaultCompanies;
    
    if (industry === 'Technology') companies = techCompanies;
    else if (industry === 'Healthcare') companies = healthCompanies;
    else if (industry === 'Financial Services') companies = financeCompanies;

    return companies[Math.floor(Math.random() * companies.length)];
  }

  private static generateDomain(): string {
    const domains = ['techcorp', 'innovate', 'dataflow', 'cloudtech', 'solutions', 'company', 'business', 'enterprise'];
    return domains[Math.floor(Math.random() * domains.length)];
  }
}

// Analytics and reporting
export class CampaignAnalytics {
  static async getCampaignMetrics(campaignId: string): Promise<any> {
    try {
      const { data: campaign } = await supabase
        .from('sourcing_campaigns')
        .select(`
          *,
          sourcing_leads (
            id,
            outreach_stage,
            reply_status
          ),
          sourcing_replies (
            id,
            direction,
            classified_as
          )
        `)
        .eq('id', campaignId)
        .single();

      if (!campaign) return null;

      const leads = campaign.sourcing_leads || [];
      const replies = campaign.sourcing_replies || [];

      const metrics = {
        total_leads: leads.length,
        emails_sent: leads.filter((l: any) => 
          ['step1_sent', 'step2_sent', 'step3_sent', 'replied'].includes(l.outreach_stage)
        ).length,
        replies_received: replies.filter((r: any) => r.direction === 'inbound').length,
        positive_replies: replies.filter((r: any) => 
          r.direction === 'inbound' && r.classified_as === 'positive'
        ).length,
        neutral_replies: replies.filter((r: any) => 
          r.direction === 'inbound' && r.classified_as === 'neutral'
        ).length,
        negative_replies: replies.filter((r: any) => 
          r.direction === 'inbound' && r.classified_as === 'negative'
        ).length,
        reply_rate: 0,
        positive_rate: 0
      };

      if (metrics.emails_sent > 0) {
        metrics.reply_rate = (metrics.replies_received / metrics.emails_sent) * 100;
      }

      if (metrics.replies_received > 0) {
        metrics.positive_rate = (metrics.positive_replies / metrics.replies_received) * 100;
      }

      return {
        campaign,
        metrics,
        performance_grade: this.calculatePerformanceGrade(metrics)
      };
    } catch (error) {
      console.error('Error getting campaign metrics:', error);
      return null;
    }
  }

  private static calculatePerformanceGrade(metrics: any): string {
    const replyRate = metrics.reply_rate;
    const positiveRate = metrics.positive_rate;

    if (replyRate >= 15 && positiveRate >= 60) return 'A';
    if (replyRate >= 10 && positiveRate >= 50) return 'B';
    if (replyRate >= 5 && positiveRate >= 40) return 'C';
    if (replyRate >= 2) return 'D';
    return 'F';
  }
}

// Error handling and logging
export class WizardLogger {
  static logWizardStart(userId: string, sessionId: string, params: any): void {
    console.log(`[WIZARD] Started session ${sessionId} for user ${userId}`, {
      params,
      timestamp: new Date().toISOString()
    });
  }

  static logWizardStep(sessionId: string, step: string, action: any): void {
    console.log(`[WIZARD] Step ${step} in session ${sessionId}`, {
      action,
      timestamp: new Date().toISOString()
    });
  }

  static logWizardComplete(sessionId: string, campaignId: string): void {
    console.log(`[WIZARD] Completed session ${sessionId}, created campaign ${campaignId}`, {
      timestamp: new Date().toISOString()
    });
  }

  static logWizardError(sessionId: string, error: any): void {
    console.error(`[WIZARD] Error in session ${sessionId}:`, error, {
      timestamp: new Date().toISOString()
    });
  }
}
