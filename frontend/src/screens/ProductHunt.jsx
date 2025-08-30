import React, { useEffect, useRef, useState } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function ProductHunt() {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <base target="_top" />

  <title>HirePilot — AI Recruiting Copilot (Product Hunt)</title>
  <meta name="description" content="Automate sourcing & outreach. Fill roles in weeks, not months. Product Hunt exclusive offer live now." />

  <!-- Open Graph / Twitter -->
  <meta property="og:title" content="HirePilot — AI Recruiting Copilot" />
  <meta property="og:description" content="Automate sourcing & outreach. Fill roles in weeks, not months." />
  <meta property="og:image" content="https://thehirepilot.com/og/hirepilot-ph.png" />
  <meta property="og:url" content="https://thehirepilot.com/ph" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="HirePilot — AI Recruiting Copilot" />
  <meta name="twitter:description" content="Automate sourcing & outreach. Fill roles in weeks, not months." />
  <meta name="twitter:image" content="https://thehirepilot.com/og/hirepilot-ph.png" />

  <!-- JSON-LD Product schema -->
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"SoftwareApplication",
    "name":"HirePilot",
    "description":"AI recruiting copilot for sourcing and outreach.",
    "applicationCategory":"BusinessApplication",
    "offers":{"@type":"Offer","price":"99","priceCurrency":"USD"},
    "url":"https://thehirepilot.com",
    "image":"https://thehirepilot.com/og/hirepilot-ph.png"
  }
  </script>

  <!-- Fonts & Tailwind -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800;900&display=swap" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: { extend: { fontFamily: { sans: ['Inter','sans-serif'] } } }
    };
  </script>

  <!-- Icons -->
  <script> window.FontAwesomeConfig = { autoReplaceSvg: 'nest' };</script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

  <style>
    ::-webkit-scrollbar{display:none}
    html,body{-ms-overflow-style:none;scrollbar-width:none}
    body{font-family:'Inter',sans-serif}
    .gradient-text{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .card{background:#0f172a80;border:1px solid #334155;border-radius:16px}
    .btn{padding:.9rem 1.25rem;border-radius:.75rem;border:1px solid #e2e8f0}
    header{display:none!important}
  </style>
</head>
<body class="bg-gray-900 text-white overflow-x-hidden">

  <!-- Header -->
  <header class="fixed top-0 w-full bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 z-50">
    <div class="container mx-auto px-6 py-4 flex justify-between items-center">
      <a href="/" class="flex items-center gap-2" aria-label="HirePilot Home">
        <span class="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg grid place-items-center">
          <i class="fas fa-robot text-white text-sm" aria-hidden="true"></i>
        </span>
        <span class="text-xl font-bold">HirePilot</span>
      </a>
      <nav class="flex items-center gap-4">
        <a href="/pricing" class="text-gray-300 hover:text-white transition-colors">Pricing</a>
        <a href="/blog" class="text-gray-300 hover:text-white transition-colors">Blog</a>
        <a id="cta-nav-start"
           href="/signup?utm_source=producthunt&utm_medium=landing&utm_campaign=ph_launch"
           class="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-opacity">
          Start Free Trial
        </a>
      </nav>
    </div>
  </header>

  <main>
    <!-- Hero -->
    <section class="pt-32 pb-20 px-6 min-h-[760px] flex items-center">
      <div class="container mx-auto max-w-4xl text-center">
        <span class="inline-flex items-center px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-300 text-sm font-medium mb-6">
          👋 Welcome, Product Hunt!
        </span>
        <h1 class="text-5xl lg:text-6xl font-extrabold mb-6 leading-tight">
          The AI Recruiting Copilot — <span class="gradient-text">Source, Message & Hire Faster</span>
        </h1>
        <p class="text-xl text-gray-300 mb-10 max-w-3xl mx-auto">
          Automate sourcing & outreach. <span class="font-semibold">Fill roles in weeks, not months.</span>
        </p>

        <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a id="cta-hero-start"
             href="/signup?utm_source=producthunt&utm_medium=landing&utm_campaign=ph_launch"
             class="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-lg font-semibold hover:opacity-90 transition-opacity shadow-lg">
            Start Free Trial
          </a>
          <a id="cta-hero-affiliate"
             href="/affiliates?utm_source=producthunt&utm_medium=landing&utm_campaign=ph_launch"
             class="px-8 py-4 border-2 border-gray-600 rounded-lg text-lg font-semibold hover:border-gray-500 transition-colors">
            Earn with HirePilot
          </a>
        </div>

        <figure class="mt-14">
          <img
            class="w-full max-w-4xl mx-auto rounded-2xl shadow-2xl"
            src="/product-hunt-hero.png"
            alt="HirePilot dashboard showing candidate pipeline and automated outreach"
            width="1280" height="720" />
          <figcaption class="sr-only">HirePilot product dashboard</figcaption>
        </figure>
      </div>
    </section>

    <!-- Value Props -->
    <section class="py-16 px-6">
      <div class="container mx-auto max-w-6xl">
        <div class="grid md:grid-cols-3 gap-6">
          <article class="text-center p-8 card">
            <div class="w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl grid place-items-center mx-auto mb-6">
              <i class="fas fa-bolt text-white text-2xl" aria-hidden="true"></i>
            </div>
            <h3 class="text-2xl font-bold mb-3">Automated Sourcing</h3>
            <p class="text-gray-300">AI + integrations pull top candidates into your pipeline.</p>
          </article>
          <article class="text-center p-8 card">
            <div class="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-2xl grid place-items-center mx-auto mb-6">
              <i class="fas fa-comments text-white text-2xl" aria-hidden="true"></i>
            </div>
            <h3 class="text-2xl font-bold mb-3">Smart Outreach</h3>
            <p class="text-gray-300">Multi-step messaging that feels personal, not spammy.</p>
          </article>
          <article class="text-center p-8 card">
            <div class="w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-2xl grid place-items-center mx-auto mb-6">
              <i class="fas fa-chart-line text-white text-2xl" aria-hidden="true"></i>
            </div>
            <h3 class="text-2xl font-bold mb-3">Hiring at Scale</h3>
            <p class="text-gray-300">See analytics, replies, and booked interviews in one place.</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Screenshots -->
    <section class="py-16 px-6 bg-gray-800/30">
      <div class="container mx-auto max-w-6xl">
        <h2 class="text-4xl font-bold text-center mb-12">See HirePilot in Action</h2>
        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <figure class="text-center">
            <img loading="lazy" class="w-full h-48 object-cover rounded-xl mb-3"
                 src="/hero-1.png"
                 alt="Campaign dashboard with candidate pipeline and performance metrics" width="600" height="320" />
            <figcaption class="text-gray-300 font-medium">Campaign Dashboard</figcaption>
          </figure>
          <figure class="text-center">
            <img loading="lazy" class="w-full h-48 object-cover rounded-xl mb-3"
                 src="/homepage-hero-1.png"
                 alt="Lead profile enrichment with contact details and sources" width="600" height="320" />
            <figcaption class="text-gray-300 font-medium">Lead Profile Enrichment</figcaption>
          </figure>
          <figure class="text-center">
            <img loading="lazy" class="w-full h-48 object-cover rounded-xl mb-3"
                 src="/REX-2.png"
                 alt="REX AI copilot chat composing outreach to candidates" width="600" height="320" />
            <figcaption class="text-gray-300 font-medium">REX — Your Recruiting Copilot</figcaption>
          </figure>
          <figure class="text-center">
            <img loading="lazy" class="w-full h-48 object-cover rounded-xl mb-3"
                 src="/slack-integration.png"
                 alt="Slack integration sending automated hiring notifications" width="600" height="320" />
            <figcaption class="text-gray-300 font-medium">Slack Integration</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- PH Exclusive Offer (with countdown) -->
    <section class="py-16 px-6">
      <div class="container mx-auto max-w-4xl text-center">
        <div class="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-3xl p-12">
          <h2 class="text-4xl font-bold mb-3">Product Hunt Exclusive 🚀</h2>
          <p class="text-xl text-gray-300 mb-6 max-w-2xl mx-auto">
            Sign up this week and get <b>500 bonus credits</b> to supercharge your first campaigns.
          </p>
          <p class="text-sm text-orange-300 mb-6">
            Offer ends in <span id="ph-countdown" class="font-semibold">7d 00h 00m</span>
          </p>
          <a id="cta-claim-offer"
             href="/signup?utm_source=producthunt&utm_medium=landing&utm_campaign=ph_launch&claim=500"
             class="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg text-lg font-semibold hover:opacity-90 transition-opacity shadow-lg">
            Claim Your Free Credits
          </a>
        </div>
      </div>
    </section>

    <!-- Testimonials -->
    <section class="py-16 px-6 bg-gray-800/30">
      <div class="container mx-auto max-w-6xl">
        <h2 class="text-4xl font-bold text-center mb-12">What Our Users Say</h2>
        <div class="grid md:grid-cols-3 gap-6">
          <blockquote class="p-8 card">
            <p class="text-lg mb-6">“I landed my first client in 3 weeks with HirePilot!”</p>
            <div class="flex items-center">
              <div>
                <p class="font-semibold">Sarah J.</p>
                <p class="text-gray-400 text-sm">Freelance Tech Recruiter</p>
              </div>
            </div>
          </blockquote>
          <blockquote class="p-8 card">
            <p class="text-lg mb-6">“I made 8k in my first 6 weeks”</p>
            <div class="flex items-center">
              <div>
                <p class="font-semibold">Dejanira (Dej) L.</p>
                <p class="text-gray-400 text-sm">Freelance Tech Recruiter</p>
              </div>
            </div>
          </blockquote>
          <blockquote class="p-8 card">
            <p class="text-lg mb-6">“The automated scheduling and engagement features have saved countless hours of manual work.”</p>
            <div class="flex items-center">
              <div>
                <p class="font-semibold">Emily R.</p>
                <p class="text-gray-400 text-sm">Talent Lead</p>
              </div>
            </div>
          </blockquote>
        </div>
      </div>
    </section>

    <!-- Affiliate Teaser -->
    <section class="py-16 px-6">
      <div class="container mx-auto max-w-4xl text-center">
        <div class="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-3xl p-12">
          <h2 class="text-4xl font-bold mb-4">Want to earn while you share HirePilot?</h2>
          <p class="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join our affiliate program. Refer recruiters & teams → earn payouts up to $7,200 per client.
          </p>
          <a id="cta-mid-affiliate"
             href="/affiliates?utm_source=producthunt&utm_medium=landing&utm_campaign=ph_launch"
             class="px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg text-lg font-semibold hover:opacity-90 transition-opacity shadow-lg">
            Earn with HirePilot
          </a>
        </div>
      </div>
    </section>

    <!-- Pricing strip (simplified) -->
    <section id="pricing" class="py-16 px-6">
      <div class="container mx-auto max-w-6xl">
        <h2 class="text-3xl font-bold text-center mb-8">Simple, Flexible Pricing</h2>
        <div class="grid sm:grid-cols-3 gap-6 items-stretch">
          <div class="p-6 card flex flex-col">
            <h3 class="text-xl font-semibold mb-2">Starter</h3>
            <p class="text-gray-300 mb-4">For solo recruiters</p>
            <ul class="text-gray-300 space-y-2 mb-6 text-sm flex-1">
              <li>LinkedIn and Apollo Lead Sources</li>
              <li>Access to Zapier and Make</li>
            </ul>
            <a href="/pricing?select=starter&utm_source=producthunt&utm_medium=landing&utm_campaign=ph_launch" class="btn hover:bg-white/10 mt-auto">Get Started</a>
          </div>
          <div class="p-6 card border-blue-500 flex flex-col">
            <h3 class="text-xl font-semibold mb-2">Pro and Team</h3>
            <p class="text-gray-300 mb-4">For teams & agencies</p>
            <ul class="text-gray-300 space-y-2 mb-6 text-sm flex-1">
              <li>Access to REX — your Recruiting AI Assistant</li>
            </ul>
            <a href="/pricing?select=pro&utm_source=producthunt&utm_medium=landing&utm_campaign=ph_launch" class="btn hover:bg-white/10 mt-auto">Get Started</a>
          </div>
          <div class="p-6 card flex flex-col">
            <h3 class="text-xl font-semibold mb-2">DFY</h3>
            <p class="text-gray-300 mb-4">Let our team run the playbook for you</p>
            <a href="/handsfree" class="btn hover:bg-white/10 mt-auto">Contact Us</a>
          </div>
        </div>
      </div>
    </section>

    <!-- Closing CTA -->
    <section class="py-16 px-6 text-center">
      <div class="container mx-auto max-w-4xl">
        <h2 class="text-5xl font-bold mb-6">Ready to Hire Smarter?</h2>
        <a id="cta-bottom-start"
           href="/signup?utm_source=producthunt&utm_medium=landing&utm_campaign=ph_launch"
           class="px-12 py-5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-xl font-semibold hover:opacity-90 transition-opacity shadow-lg">
          Start Free Trial
        </a>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="py-16 px-6 bg-gray-800/30">
      <div class="container mx-auto max-w-4xl">
        <h2 class="text-3xl font-bold text-center mb-8">FAQ</h2>
        <div class="space-y-4">
          <details class="p-5 card">
            <summary class="cursor-pointer font-semibold">Is there a free trial?</summary>
            <p class="mt-2 text-gray-300">Yes — start free. No credit card required for the trial.</p>
          </details>
          <details class="p-5 card">
            <summary class="cursor-pointer font-semibold">What integrations are supported?</summary>
            <p class="mt-2 text-gray-300">LinkedIn (workflows), Apollo, Slack, Zapier, and more.</p>
          </details>
          <details class="p-5 card">
            <summary class="cursor-pointer font-semibold">Can I cancel anytime?</summary>
            <p class="mt-2 text-gray-300">Absolutely. Plans are monthly or annual with a discount.</p>
          </details>
          <details class="p-5 card">
            <summary class="cursor-pointer font-semibold">Is my data secure?</summary>
            <p class="mt-2 text-gray-300">We use industry-standard encryption and least-privilege access.</p>
          </details>
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="bg-gray-800 border-t border-gray-700 py-12 px-6">
    <div class="container mx-auto max-w-6xl">
      <div class="flex flex-col md:flex-row justify-between items-center gap-6">
        <a href="/" class="flex items-center gap-2" aria-label="HirePilot Home">
          <span class="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg grid place-items-center">
            <i class="fas fa-robot text-white text-sm" aria-hidden="true"></i>
          </span>
          <span class="text-xl font-bold">HirePilot</span>
        </a>
        <nav class="flex flex-wrap gap-6">
          <a href="/pricing" class="text-gray-300 hover:text-white">Pricing</a>
          <a href="/blog" class="text-gray-300 hover:text-white">Blog</a>
          <a href="/affiliates" class="text-gray-300 hover:text-white">Affiliates</a>
          <a href="/contact" class="text-gray-300 hover:text-white">Contact</a>
        </nav>
        <a href="https://www.producthunt.com/" target="_blank" rel="noopener" class="inline-flex items-center px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-300 text-sm">
          🚀 We launched on Product Hunt!
        </a>
      </div>
    </div>
  </footer>

  <!-- Sticky mobile CTA -->
  <div class="fixed bottom-4 inset-x-0 px-4 md:hidden z-50">
    <a href="/signup?utm_source=producthunt&utm_medium=landing&utm_campaign=ph_launch"
       class="block text-center w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl font-semibold shadow-lg">
      Start Free Trial
    </a>
  </div>

  <!-- PH source cookie, tracking, countdown, smooth-scroll -->
  <script>
    (function () {
      try {
        // Set PH source cookie for 90 days
        const d = new Date(); d.setDate(d.getDate() + 90);
        document.cookie = "hp_ref=ph; path=/; SameSite=Lax; expires=" + d.toUTCString();
        try { if (window.top && window.top !== window) { window.top.document.cookie = "hp_ref=ph; path=/; SameSite=Lax; expires=" + d.toUTCString(); } } catch {}

        // DataLayer events (works with GTM if present)
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "ph_view" });

        const bindTrack = (id, evt) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.addEventListener('click', () => window.dataLayer.push({ event: evt }));
        };
        bindTrack('cta-hero-start', 'ph_cta_click_trial');
        bindTrack('cta-nav-start', 'ph_cta_click_trial');
        bindTrack('cta-bottom-start', 'ph_cta_click_trial');
        bindTrack('cta-hero-affiliate', 'ph_cta_click_affiliate');
        bindTrack('cta-mid-affiliate', 'ph_cta_click_affiliate');
        bindTrack('cta-claim-offer', 'ph_claim_offer');

        // Smooth scroll for in-page anchors (within _top navigation context)
        document.querySelectorAll('a[href^="#"]').forEach(a => {
          a.addEventListener('click', (e) => {
            e.preventDefault();
            (window.top || window).document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });

        // Countdown to 7 days from first visit (persisted in localStorage)
        const KEY = 'ph_offer_deadline';
        let deadline = localStorage.getItem(KEY);
        if (!deadline) {
          deadline = (Date.now() + 7 * 24 * 60 * 60 * 1000).toString();
          localStorage.setItem(KEY, deadline);
        }
        function tick() {
          const remain = Math.max(0, parseInt(deadline, 10) - Date.now());
          const d = Math.floor(remain / 86400000);
          const h = Math.floor((remain % 86400000) / 3600000);
          const m = Math.floor((remain % 3600000) / 60000);
          const el = document.getElementById('ph-countdown');
          if (el) el.textContent = \`\${d}d \${h}h \${m}m\`;
          if (remain > 0) setTimeout(tick, 30000);
        }
        tick();
      } catch (e) { /* no-op */ }
    })();
  </script>
</body>
</html>`;

  return (
    <>
      <PublicNavbar />
      <IFrameEmbed html={html} />
      <PublicFooter />
    </>
  );
}


function IFrameEmbed({ html }) {
  const iframeRef = useRef(null);
  const [heightPx, setHeightPx] = useState('calc(100vh - 80px)');

  const recalc = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe) return;
      const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
      if (!doc) return;
      const body = doc.body;
      const htmlEl = doc.documentElement;
      const newHeight = Math.max(
        body ? body.scrollHeight : 0,
        htmlEl ? htmlEl.scrollHeight : 0,
        body ? body.offsetHeight : 0,
        htmlEl ? htmlEl.offsetHeight : 0
      );
      if (newHeight && Number.isFinite(newHeight)) {
        setHeightPx(`${newHeight}px`);
      }
    } catch (_) {
      // ignore
    }
  };

  useEffect(() => {
    const onResize = () => recalc();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div style={{ width: '100%', paddingTop: '80px' }}>
      <iframe
        ref={iframeRef}
        title="HirePilot Product Hunt"
        srcDoc={html}
        style={{ width: '100%', height: heightPx, border: '0', display: 'block' }}
        onLoad={recalc}
      />
    </div>
  );
}


