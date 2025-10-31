import React from 'react';

export default function SniperSettings() {
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

                <button class="py-2 px-1 border-b-2 border-blue-500 font-medium text-sm text-blue-600">

                    Global Defaults

                </button>

                <button class="py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300">

                    Per-Campaign Overrides

                </button>

            </nav>

        </div>

    </div>



    <!-- Main Content -->

    <div id="main-content" class="px-6 py-6">

        <div class="grid grid-cols-12 gap-6">

            <!-- Left Column - Help & Info -->

            <div id="help-column" class="col-span-4">

                <div class="bg-white rounded-lg border border-gray-200 p-6 sticky top-6">

                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Configuration Guide</h3>

                    <div class="space-y-4">

                        <div class="p-3 bg-blue-50 rounded-lg">

                            <h4 class="font-medium text-blue-900 mb-2">Working Hours</h4>

                            <p class="text-sm text-blue-800">Set when HirePilot can perform actions. Activities outside these hours will be queued.</p>

                        </div>

                        <div class="p-3 bg-green-50 rounded-lg">

                            <h4 class="font-medium text-green-900 mb-2">Daily Limits</h4>

                            <p class="text-sm text-green-800">Conservative limits protect your account. Increase gradually after warm-up period.</p>

                        </div>

                        <div class="p-3 bg-purple-50 rounded-lg">

                            <h4 class="font-medium text-purple-900 mb-2">Safety Features</h4>

                            <p class="text-sm text-purple-800">Auto-pause triggers help avoid account flags and maintain professional reputation.</p>

                        </div>

                    </div>

                </div>

            </div>



            <!-- Right Column - Controls -->

            <div id="controls-column" class="col-span-8 space-y-6">

                

                <!-- Working Hours Section -->

                <div id="working-hours-section" class="bg-white rounded-lg border border-gray-200 p-6">

                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Working Hours & Schedule</h3>

                    <div class="grid grid-cols-2 gap-6">

                        <div>

                            <label class="block text-sm font-medium text-gray-700 mb-2">Start Time</label>

                            <select class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">

                                <option>09:00 AM</option>

                                <option>08:00 AM</option>

                                <option>10:00 AM</option>

                            </select>

                        </div>

                        <div>

                            <label class="block text-sm font-medium text-gray-700 mb-2">End Time</label>

                            <select class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">

                                <option>05:00 PM</option>

                                <option>06:00 PM</option>

                                <option>04:00 PM</option>

                            </select>

                        </div>

                    </div>

                    <div class="mt-4">

                        <label class="block text-sm font-medium text-gray-700 mb-3">Active Days</label>

                        <div class="flex space-x-2">

                            <button class="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">Mon</button>

                            <button class="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">Tue</button>

                            <button class="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">Wed</button>

                            <button class="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">Thu</button>

                            <button class="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">Fri</button>

                            <button class="px-3 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium">Sat</button>

                            <button class="px-3 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium">Sun</button>

                        </div>

                    </div>

                    <div class="mt-4 flex items-center justify-between">

                        <label class="text-sm font-medium text-gray-700">Run on Weekends</label>

                        <label class="relative inline-flex items-center cursor-pointer">

                            <input type="checkbox" class="sr-only peer">

                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>

                        </label>

                    </div>

                </div>



                <!-- Warm-up & Health Section -->

                <div id="warmup-health-section" class="bg-white rounded-lg border border-gray-200 p-6">

                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Warm-up & Health Monitoring</h3>

                    <div class="space-y-4">

                        <div class="flex items-center justify-between">

                            <label class="text-sm font-medium text-gray-700">Warm-up Mode</label>

                            <label class="relative inline-flex items-center cursor-pointer">

                                <input type="checkbox" checked class="sr-only peer">

                                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>

                            </label>

                        </div>

                        <div>

                            <label class="block text-sm font-medium text-gray-700 mb-2">Warm-up Speed</label>

                            <div class="flex items-center space-x-4">

                                <span class="text-xs text-gray-500">Conservative</span>

                                <input type="range" class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" value="30" min="0" max="100">

                                <span class="text-xs text-gray-500">Aggressive</span>

                            </div>

                        </div>

                        <div class="flex items-center justify-between">

                            <label class="text-sm font-medium text-gray-700">Auto-pause on Flags</label>

                            <label class="relative inline-flex items-center cursor-pointer">

                                <input type="checkbox" checked class="sr-only peer">

                                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>

                            </label>

                        </div>

                    </div>

                </div>



                <!-- Per-Site Daily Limits -->

                <div id="daily-limits-section" class="bg-white rounded-lg border border-gray-200 p-6">

                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Daily Limits by Platform</h3>

                    

                    <!-- LinkedIn Limits -->

                    <div class="mb-6">

                        <div class="flex items-center space-x-3 mb-4">

                            <i class="fa-brands fa-linkedin text-blue-600 text-xl"></i>

                            <h4 class="text-md font-semibold text-gray-800">LinkedIn</h4>

                        </div>

                        <div class="grid grid-cols-2 gap-4">

                            <div>

                                <label class="block text-sm font-medium text-gray-700 mb-2">Profile Views</label>

                                <div class="flex items-center space-x-3">

                                    <input type="number" value="25" class="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm">

                                    <div class="flex-1 h-2 bg-gray-200 rounded-lg">

                                        <div class="h-2 bg-blue-500 rounded-lg" style="width: 42%"></div>

                                    </div>

                                    <span class="text-xs text-gray-500">/ 60 max</span>

                                </div>

                                <p class="text-xs text-gray-500 mt-1">Recommended: 40-60</p>

                            </div>

                            <div>

                                <label class="block text-sm font-medium text-gray-700 mb-2">Connection Invites</label>

                                <div class="flex items-center space-x-3">

                                    <input type="number" value="10" class="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm">

                                    <div class="flex-1 h-2 bg-gray-200 rounded-lg">

                                        <div class="h-2 bg-blue-500 rounded-lg" style="width: 20%"></div>

                                    </div>

                                    <span class="text-xs text-gray-500">/ 50 max</span>

                                </div>

                                <p class="text-xs text-gray-500 mt-1">Recommended: 40-50</p>

                            </div>

                            <div>

                                <label class="block text-sm font-medium text-gray-700 mb-2">Messages</label>

                                <div class="flex items-center space-x-3">

                                    <input type="number" value="30" class="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm">

                                    <div class="flex-1 h-2 bg-gray-200 rounded-lg">

                                        <div class="h-2 bg-blue-500 rounded-lg" style="width: 25%"></div>

                                    </div>

                                    <span class="text-xs text-gray-500">/ 120 max</span>

                                </div>

                                <p class="text-xs text-gray-500 mt-1">Recommended: 100-120</p>

                            </div>

                            <div>

                                <label class="block text-sm font-medium text-gray-700 mb-2">InMails</label>

                                <div class="flex items-center space-x-3">

                                    <input type="number" value="5" class="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm">

                                    <div class="flex-1 h-2 bg-gray-200 rounded-lg">

                                        <div class="h-2 bg-blue-500 rounded-lg" style="width: 25%"></div>

                                    </div>

                                    <span class="text-xs text-gray-500">/ 20 max</span>

                                </div>

                                <p class="text-xs text-gray-500 mt-1">Recommended: 15-20</p>

                            </div>

                        </div>

                    </div>



                    <!-- Indeed Limits -->

                    <div class="mb-4">

                        <div class="flex items-center space-x-3 mb-4">

                            <i class="fa-solid fa-briefcase text-blue-800 text-xl"></i>

                            <h4 class="text-md font-semibold text-gray-800">Indeed</h4>

                        </div>

                        <div class="grid grid-cols-2 gap-4">

                            <div>

                                <label class="block text-sm font-medium text-gray-700 mb-2">Scrapes per Day</label>

                                <div class="flex items-center space-x-3">

                                    <input type="number" value="100" class="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm">

                                    <div class="flex-1 h-2 bg-gray-200 rounded-lg">

                                        <div class="h-2 bg-blue-500 rounded-lg" style="width: 20%"></div>

                                    </div>

                                    <span class="text-xs text-gray-500">/ 500 max</span>

                                </div>

                                <p class="text-xs text-gray-500 mt-1">Recommended: 200-500</p>

                            </div>

                            <div>

                                <label class="block text-sm font-medium text-gray-700 mb-2">Reachouts per Day</label>

                                <div class="flex items-center space-x-3">

                                    <input type="number" value="25" class="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm">

                                    <div class="flex-1 h-2 bg-gray-200 rounded-lg">

                                        <div class="h-2 bg-blue-500 rounded-lg" style="width: 50%"></div>

                                    </div>

                                    <span class="text-xs text-gray-500">/ 50 max</span>

                                </div>

                                <p class="text-xs text-gray-500 mt-1">Recommended: 20-50</p>

                            </div>

                        </div>

                    </div>

                </div>



                <!-- Concurrency & Throttling -->

                <div id="concurrency-section" class="bg-white rounded-lg border border-gray-200 p-6">

                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Concurrency & Throttling</h3>

                    <div class="grid grid-cols-2 gap-6">

                        <div>

                            <label class="block text-sm font-medium text-gray-700 mb-2">Max Concurrent Sessions</label>

                            <input type="number" value="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg">

                        </div>

                        <div>

                            <label class="block text-sm font-medium text-gray-700 mb-2">Actions per Minute</label>

                            <input type="number" value="1" class="w-full px-3 py-2 border border-gray-300 rounded-lg">

                        </div>

                    </div>

                </div>



                <!-- Test & Monitor Section -->

                <div id="test-monitor-section" class="bg-white rounded-lg border border-gray-200 p-6">

                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Testing & Monitoring</h3>

                    <div class="flex space-x-4 mb-6">

                        <button class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">

                            <i class="fa-solid fa-play mr-2"></i>

                            Test Run (Dry Mode)

                        </button>

                        <button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">

                            <i class="fa-solid fa-check-circle mr-2"></i>

                            Validate Settings

                        </button>

                        <button class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">

                            <i class="fa-solid fa-download mr-2"></i>

                            Export Config

                        </button>

                    </div>

                    

                    <!-- Live Activity Feed -->

                    <div class="bg-gray-50 rounded-lg p-4">

                        <h4 class="text-sm font-semibold text-gray-800 mb-3">Live Activity</h4>

                        <div class="space-y-2 text-sm">

                            <div class="flex justify-between items-center">

                                <span class="text-gray-600">Profile Views Today</span>

                                <span class="font-medium text-blue-600">12 / 25</span>

                            </div>

                            <div class="flex justify-between items-center">

                                <span class="text-gray-600">Connection Invites</span>

                                <span class="font-medium text-green-600">3 / 10</span>

                            </div>

                            <div class="flex justify-between items-center">

                                <span class="text-gray-600">Messages Sent</span>

                                <span class="font-medium text-purple-600">8 / 30</span>

                            </div>

                            <div class="flex justify-between items-center">

                                <span class="text-gray-600">Account Health</span>

                                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">

                                    <i class="fa-solid fa-circle text-green-500 mr-1" style="font-size: 6px;"></i>

                                    Healthy

                                </span>

                            </div>

                        </div>

                    </div>

                </div>

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

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}


