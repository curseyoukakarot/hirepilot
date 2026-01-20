import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LinkedinEngineCard from '../components/LinkedinEngineCard';
import { flags } from '../config/flags';

export default function SniperSettings() {
  const navigate = useNavigate();
  const html = `<!DOCTYPE html>

<html>

<head>

    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Sniper Settings</title>

    <script src="https://cdn.tailwindcss.com"></script>

    <script> window.FontAwesomeConfig = { autoReplaceSvg: 'nest'};</script>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <style>

        ::-webkit-scrollbar { display: none;}

        body { font-family: 'Inter', sans-serif; }

    </style>

    <script>

        tailwind.config = {

            theme: {

                extend: {

                    fontFamily: {

                        'inter': ['Inter', 'sans-serif'],

                    }

                }

            }

        }

    </script>

</head>

<body class="bg-gray-50 font-inter">



<div id="sniper-settings-container" class="min-h-screen">

    <!-- Header -->

    <header id="header" class="bg-white border-b border-gray-200 px-6 py-4">

        <div class="flex items-center justify-between">

            <div class="flex items-center space-x-4">

                <button id="back-to-agent" class="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    ← Back to Agent Center
                </button>

                <h1 class="text-2xl font-bold text-gray-900">Sniper Settings</h1>

                <div class="flex items-center space-x-2">

                    <span class="text-sm text-gray-600">Global Status:</span>

                    <label class="relative inline-flex items-center cursor-pointer">

                        <input type="checkbox" checked class="sr-only peer">

                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>

                    </label>

                    <span class="text-sm font-medium text-green-600">Active</span>

                </div>

            </div>

            <div class="flex items-center space-x-3">

                <button class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">

                    Reset to Defaults

                </button>

                <button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">

                    Save Changes

                </button>

            </div>

        </div>

    </header>



    <!-- Warm-up Banner -->

    <div id="warmup-banner" class="bg-amber-50 border-l-4 border-amber-400 p-4 mx-6 mt-4 rounded-lg">

        <div class="flex items-center justify-between">

            <div class="flex items-center space-x-3">

                <i class="fa-solid fa-exclamation-triangle text-amber-500"></i>

                <div>

                    <h3 class="text-sm font-medium text-amber-800">Warm-up Mode Active</h3>

                    <p class="text-sm text-amber-700">Week 1 of 3 - Conservative limits are applied to protect your account</p>

                </div>

            </div>

            <div class="flex items-center space-x-4">

                <div class="w-48 bg-amber-200 rounded-full h-2">

                    <div class="bg-amber-500 h-2 rounded-full" style="width: 33%"></div>

                </div>

                <span class="text-sm font-medium text-amber-800">33% Complete</span>

            </div>

        </div>

    </div>



    <!-- Tab Navigation -->

    <div id="tab-navigation" class="px-6 mt-6">

        <div class="border-b border-gray-200">

            <nav class="-mb-px flex space-x-8">

                <button id="tab-linkedin" class="py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300">

                    Linkedin Connect

                </button>

                <!-- Sniper Control Center tab (injected) -->
                <button id="tab-control-center" class="py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300">

                    Sniper Control Center

                </button>

            </nav>

        </div>

    </div>



    <!-- LinkedIn Connect Tab Content -->
    <div id="linkedin-content" class="px-6 py-6">
      <div class="grid grid-cols-12 gap-6">
        <div class="col-span-12 space-y-6">
          <div class="bg-white rounded-lg border border-gray-200 p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">LinkedIn Connect</h3>
            <div id="linkedin-connect-mount"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sniper Control Center Tab Content -->
    <div id="control-center-content" class="px-6 py-6 hidden">
      <div class="grid grid-cols-12 gap-6">
        <div class="col-span-12">
          <div id="sniper-control-center-mount"></div>
        </div>
      </div>
    </div>

</div>



<script>

// Toggle switches functionality

document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {

    checkbox.addEventListener('change', function() {

        console.log('Setting changed:', this.checked);

    });

});



// Range slider functionality

document.querySelectorAll('input[type="range"]').forEach(slider => {

    slider.addEventListener('input', function() {

        console.log('Slider value:', this.value);

    });

});



// Day selector functionality

document.querySelectorAll('.px-3.py-2').forEach(button => {

    if (button.textContent.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/)) {

        button.addEventListener('click', function() {

            this.classList.toggle('bg-blue-100');

            this.classList.toggle('text-blue-700');

            this.classList.toggle('bg-gray-100');

            this.classList.toggle('text-gray-500');

        });

    }

});

</script>



</body>

</html>`;

  useEffect(() => {
    // Back button (scripts in innerHTML won't execute)
    const backBtn = document.getElementById('back-to-agent');
    const onBack = (e) => {
      try { e?.preventDefault?.(); } catch {}
      navigate('/agent');
    };
    backBtn?.addEventListener('click', onBack);

    // Wire tab navigation (scripts in innerHTML won't execute)
    const tabLinkedin = document.getElementById('tab-linkedin');
    // Ensure Control Center tab exists even if HTML string wasn't refreshed (runtime injection)
    let tabControl = document.getElementById('tab-control-center');
    const navEl = document.querySelector('#tab-navigation nav');
    if (!tabControl && navEl) {
      try {
        tabControl = document.createElement('button');
        tabControl.id = 'tab-control-center';
        tabControl.className = 'py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300';
        tabControl.textContent = 'Sniper Control Center';
        navEl.appendChild(tabControl);
      } catch {}
    }
    const contentLinkedin = document.getElementById('linkedin-content');
    let contentControl = document.getElementById('control-center-content');
    if (!contentControl) {
      try {
        const container = document.getElementById('sniper-settings-container');
        const linkedinContent = document.getElementById('linkedin-content');
        const wrapper = document.createElement('div');
        wrapper.id = 'control-center-content';
        wrapper.className = 'px-6 py-6 hidden';
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-12 gap-6';
        const col = document.createElement('div');
        col.className = 'col-span-12';
        const mount = document.createElement('div');
        mount.id = 'sniper-control-center-mount';
        col.appendChild(mount);
        grid.appendChild(col);
        wrapper.appendChild(grid);
        if (container && linkedinContent && linkedinContent.parentNode === container) {
          container.appendChild(wrapper);
        } else if (container) {
          container.appendChild(wrapper);
        }
        contentControl = wrapper;
      } catch {}
    }

    const activate = (btn) => {
      [tabLinkedin, tabControl].forEach(b => {
        if (!b) return;
        b.classList.remove('border-blue-500', 'text-blue-600');
        b.classList.add('border-transparent', 'text-gray-500');
      });
      if (btn) {
        btn.classList.remove('border-transparent', 'text-gray-500');
        btn.classList.add('border-blue-500', 'text-blue-600');
      }
    };
    const hideAll = () => {
      contentLinkedin?.classList.add('hidden');
      contentControl?.classList.add('hidden');
    };
    const showLinkedin = (e) => { e && e.preventDefault && e.preventDefault(); activate(tabLinkedin); hideAll(); contentLinkedin?.classList.remove('hidden'); };
    const showControl = (e) => { e && e.preventDefault && e.preventDefault(); activate(tabControl); hideAll(); contentControl?.classList.remove('hidden'); };

    tabLinkedin?.addEventListener('click', showLinkedin);
    tabControl?.addEventListener('click', showControl);

    // Mount React components into LinkedIn tab
    const mount = document.getElementById('linkedin-connect-mount');
    if (mount) {
      import('react-dom/client').then(({ createRoot }) => {
        const root = createRoot(mount);
        root.render(
          <div className="space-y-6">
            {flags.sniperV1 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="text-sm font-semibold text-blue-900">Sniper v1</div>
                <div className="text-sm text-blue-800 mt-1">
                  Choose your LinkedIn automation provider in the <b>Sniper Control Center</b> tab:
                  <ul className="list-disc ml-5 mt-2">
                    <li><b>Cloud Engine</b>: embedded login (recommended)</li>
                    <li><b>Chrome Extension</b>: paste your <code>li_at</code> cookie below</li>
                  </ul>
                </div>
              </div>
            )}
            <LinkedinEngineCard />
          </div>
        );
      });
    }

    // Mount Sniper Control Center into its tab
    const sccMount = document.getElementById('sniper-control-center-mount');
    if (sccMount) {
      import('react-dom/client').then(({ createRoot }) => {
          const root = createRoot(sccMount);
        const loader = flags.sniperV1
          ? import('./SniperControlCenterV1')
          : import('./SniperControlCenter.jsx');
        loader.then(({ default: SniperControlCenter }) => {
          root.render(<SniperControlCenter />);
        });
      });
    }

    // default to LinkedIn tab visible
    showLinkedin();

    return () => {
      backBtn?.removeEventListener('click', onBack);
      tabLinkedin?.removeEventListener('click', showLinkedin);
      tabControl?.removeEventListener('click', showControl);
    };
  }, [navigate]);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}


