// Basic Jest test stubs for autoScrollPage and scrapeResults

describe('HirePilot Auto-Scraper (content.js)', () => {
  beforeEach(() => {
    // Minimal DOM and chrome mocks
    global.chrome = global.chrome || { runtime: { sendMessage: jest.fn() } };
    document.body.innerHTML = `
      <ul class="reusable-search__entity-result-list">
        <li class="reusable-search__result-container">
          <a class="app-aware-link" href="/in/john-doe"><span aria-hidden="true">John Doe</span></a>
          <div class="entity-result__primary-subtitle">Head of Sales at Foo Inc</div>
          <div class="entity-result__secondary-subtitle">Foo Inc</div>
        </li>
      </ul>
    `;
    window.__HP = undefined;
  });

  test('scrapeResults returns basic lead structure', async () => {
    // Load the content script into this environment
    require('../content.js');
    expect(typeof window.__HP?.scrapeResults).toBe('function');
    const leads = await window.__HP.scrapeResults();
    expect(Array.isArray(leads)).toBe(true);
    expect(leads.length).toBeGreaterThan(0);
    expect(leads[0]).toEqual(expect.objectContaining({
      name: expect.any(String),
      profileUrl: expect.any(String),
    }));
  });

  test('autoScrollPage resolves and returns info', async () => {
    require('../content.js');
    expect(typeof window.__HP?.autoScrollPage).toBe('function');
    const info = await window.__HP.autoScrollPage({ maxRetries: 1, minPauseMs: 1, maxPauseMs: 2 });
    expect(info).toEqual(expect.objectContaining({
      totalVisible: expect.any(Number),
      retriesUsed: expect.any(Number),
      durationMs: expect.any(Number)
    }));
  });
});


