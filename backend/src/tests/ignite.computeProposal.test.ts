import { computeProposal } from '../services/ignite/computeProposal';
import { describe, it, expect } from '@jest/globals';

describe('computeProposal', () => {
  it('computes subtotal, fee, contingency, and total for cost+ mode', () => {
    const proposal = {
      pricing_mode: 'cost_plus',
      settings_json: {
        igniteFeeRate: 0.1,
        contingencyRate: 0.05
      }
    };
    const options = [{ id: 'opt-1', option_key: 'A', label: 'Option A' }];
    const lineItems = [
      {
        id: 'li-1',
        option_id: 'opt-1',
        category: 'Venue',
        line_name: 'Ballroom rental',
        qty: 2,
        unit_cost: 1000,
        apply_service: false,
        apply_tax: false
      },
      {
        id: 'li-2',
        option_id: 'opt-1',
        category: 'AV',
        line_name: 'Audio package',
        qty: 1,
        unit_cost: 500,
        apply_service: true,
        service_rate: 0.1,
        apply_tax: true,
        tax_rate: 0.05,
        tax_applies_after_service: true
      }
    ];

    const result = computeProposal(proposal, options as any, lineItems as any);
    expect(result.subtotal).toBe(2577.5);
    expect(result.ignite_fee).toBe(257.75);
    expect(result.contingency).toBe(128.88);
    expect(result.total_investment).toBe(2964.13);
  });

  it('supports tax-before-service toggle with distinct component amounts', () => {
    const proposal = { pricing_mode: 'cost_plus', settings_json: {} };
    const options = [{ id: 'opt-1', option_key: 'A', label: 'Option A' }];
    const lineItems = [
      {
        id: 'li-1',
        option_id: 'opt-1',
        category: 'Labor',
        line_name: 'Install crew',
        qty: 1,
        unit_cost: 100,
        apply_service: true,
        service_rate: 0.1,
        apply_tax: true,
        tax_rate: 0.05,
        tax_applies_after_service: false
      }
    ];

    const result = computeProposal(proposal, options as any, lineItems as any);
    const row = result.per_option[0].line_items[0];
    expect(row.service_amount).toBe(10.5);
    expect(row.tax_amount).toBe(5);
    expect(row.line_total).toBe(115.5);
  });

  it('supports turnkey helpers and delta against computed total', () => {
    const proposal = { pricing_mode: 'turnkey', settings_json: {} };
    const options = [
      {
        id: 'opt-1',
        option_key: 'A',
        label: 'Turnkey Option',
        pricing_mode: 'turnkey',
        package_price: 2000
      }
    ];
    const lineItems = [
      {
        id: 'li-1',
        option_id: 'opt-1',
        category: 'Venue',
        line_name: 'Space',
        qty: 1,
        unit_cost: 1500,
        apply_service: false,
        apply_tax: false
      }
    ];

    const result = computeProposal(proposal, options as any, lineItems as any);
    expect(result.per_option[0].turnkey.enabled).toBe(true);
    expect(result.per_option[0].turnkey.package_price).toBe(2000);
    expect(result.per_option[0].turnkey.delta_to_computed_total).toBe(500);
  });
});

