import React from 'react';

type Props = { slug: string };

export function PublicForm({ slug }: Props) {
  const html = `<!DOCTYPE html>

<html>

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HirePilot Form</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'hp-bg': '#0a0a0a',
                        'hp-surface': '#1a1a1a',
                        'hp-primary': '#5b8cff',
                        'hp-primary-2': '#4a7bef',
                        'hp-text-muted': '#a0a0a0',
                        'hp-success': '#00d084'
                    }
                }
            }
        }
    </script>
    <script> window.FontAwesomeConfig = { autoReplaceSvg: 'nest'};</script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { display: none; }
        .backdrop-blur { backdrop-filter: blur(10px); }
        .field-card {
            opacity: 0;
            transform: translateY(20px);
            animation: slideUp 0.6s ease-out forwards;
        }
        .field-card:nth-child(2) { animation-delay: 0.1s; }
        .field-card:nth-child(3) { animation-delay: 0.2s; }
        .field-card:nth-child(4) { animation-delay: 0.3s; }
        .field-card:nth-child(5) { animation-delay: 0.4s; }
        .field-card:nth-child(6) { animation-delay: 0.5s; }
        @keyframes slideUp {
            to { opacity: 1; transform: translateY(0); }
        }
        .progress-bar { transition: width 0.3s ease-out; }
        .glow-hover { transition: all 0.3s ease; }
        .glow-hover:hover { box-shadow: 0 0 20px rgba(91, 140, 255, 0.3); }
        .file-drop-zone {
            border: 2px dashed rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
        }
        .file-drop-zone:hover {
            border-color: rgba(91, 140, 255, 0.5);
            background: rgba(91, 140, 255, 0.05);
        }
    </style>

</head>

<body class="bg-hp-bg text-white">

    <div id="main-container" class="min-h-screen w-full flex flex-col items-center py-14 px-6">

        <div id="form-wrapper" class="max-w-[700px] w-full">
            
            <!-- Progress Bar -->
            <div id="progress-section" class="mb-10">
                <div class="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div id="progress-fill" class="h-full bg-hp-primary progress-bar" style="width: 45%"></div>
                </div>
            </div>
            <!-- Hero Section -->
            <div id="hero-section" class="text-center mb-12">
                <div class="h-10 mx-auto mb-6 opacity-80 w-10 bg-hp-primary rounded-lg flex items-center justify-center">
                    <i class="fa-solid fa-rocket text-white text-lg"></i>
                </div>
                <h1 class="text-3xl font-semibold mb-3">Senior Frontend Developer Application</h1>
                <p class="text-hp-text-muted text-lg">Help us get to know you better. This should take about 5 minutes to complete.</p>
            </div>
            <!-- Form Fields -->
            <form id="application-form" class="space-y-6">
                
                <!-- Personal Information -->
                <div class="field-card rounded-2xl border border-white/10 bg-hp-surface/50 backdrop-blur p-6">
                    <label class="block text-sm font-medium mb-3">Full Name *</label>
                    <input 
                        type="text" 
                        required
                        placeholder="Enter your full name"
                        class="w-full h-12 px-4 rounded-xl bg-black/20 border border-white/10 focus:border-hp-primary focus:ring-4 focus:ring-hp-primary/20 transition-all glow-hover placeholder-white/40"
                    />
                </div>
                <!-- Email -->
                <div class="field-card rounded-2xl border border-white/10 bg-hp-surface/50 backdrop-blur p-6">
                    <label class="block text-sm font-medium mb-3">Email Address *</label>
                    <input 
                        type="email" 
                        required
                        placeholder="your.email@example.com"
                        class="w-full h-12 px-4 rounded-xl bg-black/20 border border-white/10 focus:border-hp-primary focus:ring-4 focus:ring-hp-primary/20 transition-all glow-hover placeholder-white/40"
                    />
                </div>
                <!-- Experience Level -->
                <div class="field-card rounded-2xl border border-white/10 bg-hp-surface/50 backdrop-blur p-6">
                    <label class="block text-sm font-medium mb-3">Years of Experience *</label>
                    <select required class="w-full h-12 px-4 rounded-xl bg-black/20 border border-white/10 cursor-pointer focus:border-hp-primary focus:ring-4 focus:ring-hp-primary/20 transition-all glow-hover">
                        <option value="">Select your experience level</option>
                        <option value="1-2">1-2 years</option>
                        <option value="3-5">3-5 years</option>
                        <option value="6-8">6-8 years</option>
                        <option value="9+">9+ years</option>
                    </select>
                </div>
                <!-- Skills -->
                <div class="field-card rounded-2xl border border-white/10 bg-hp-surface/50 backdrop-blur p-6">
                    <label class="block text-sm font-medium mb-3">Primary Technologies *</label>
                    <div class="grid grid-cols-2 gap-3">
                        <label class="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" class="w-4 h-4 text-hp-primary bg-black/20 border-white/10 rounded focus:ring-hp-primary/20">
                            <span class="text-sm">React</span>
                        </label>
                        <label class="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" class="w-4 h-4 text-hp-primary bg-black/20 border-white/10 rounded focus:ring-hp-primary/20">
                            <span class="text-sm">Vue.js</span>
                        </label>
                        <label class="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" class="w-4 h-4 text-hp-primary bg-black/20 border-white/10 rounded focus:ring-hp-primary/20">
                            <span class="text-sm">TypeScript</span>
                        </label>
                        <label class="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" class="w-4 h-4 text-hp-primary bg-black/20 border-white/10 rounded focus:ring-hp-primary/20">
                            <span class="text-sm">Node.js</span>
                        </label>
                        <label class="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" class="w-4 h-4 text-hp-primary bg-black/20 border-white/10 rounded focus:ring-hp-primary/20">
                            <span class="text-sm">Next.js</span>
                        </label>
                        <label class="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" class="w-4 h-4 text-hp-primary bg-black/20 border-white/10 rounded focus:ring-hp-primary/20">
                            <span class="text-sm">GraphQL</span>
                        </label>
                    </div>
                </div>
                <!-- Cover Letter -->
                <div class="field-card rounded-2xl border border-white/10 bg-hp-surface/50 backdrop-blur p-6">
                    <label class="block text-sm font-medium mb-3">Why are you interested in this position? *</label>
                    <textarea 
                        required
                        placeholder="Tell us what excites you about this opportunity..."
                        class="w-full min-h-[120px] rounded-xl px-4 py-3 bg-black/20 border border-white/10 focus:border-hp-primary focus:ring-4 focus:ring-hp-primary/20 transition-all glow-hover placeholder-white/40 resize-none"
                    ></textarea>
                </div>
                <!-- File Upload -->
                <div class="field-card rounded-2xl border border-white/10 bg-hp-surface/50 backdrop-blur p-6">
                    <label class="block text-sm font-medium mb-3">Resume/CV *</label>
                    <div class="file-drop-zone rounded-xl p-8 text-center cursor-pointer">
                        <i class="fa-solid fa-cloud-arrow-up text-3xl text-hp-primary mb-3"></i>
                        <p class="text-sm text-hp-text-muted mb-2">Drag and drop your resume here, or click to browse</p>
                        <p class="text-xs text-white/40">PDF, DOC, DOCX up to 10MB</p>
                        <input type="file" class="hidden" accept=".pdf,.doc,.docx" />
                    </div>
                    <div id="file-list" class="mt-4 space-y-2"></div>
                </div>
                <!-- Submit Button -->
                <div class="field-card">
                    <button 
                        type="submit"
                        class="w-full h-14 mt-8 rounded-xl bg-hp-primary text-white font-semibold text-lg hover:bg-hp-primary-2 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(91,140,255,.5)] active:scale-[0.97]"
                    >
                        <span class="flex items-center justify-center space-x-2">
                            <span>Submit Application</span>
                            <i class="fa-solid fa-arrow-right"></i>
                        </span>
                    </button>
                </div>
            </form>
            <!-- Success State (Hidden by default) -->
            <div id="success-state" class="text-center py-20 hidden">
                <div class="text-hp-success h-20 w-20 mx-auto mb-6 flex items-center justify-center">
                    <i class="fa-solid fa-circle-check text-6xl"></i>
                </div>
                <h2 class="text-3xl font-semibold mb-3">Thank you!</h2>
                <p class="text-hp-text-muted text-lg">Your application has been submitted successfully.</p>
                <p class="text-sm text-white/60 mt-4">We'll review your application and get back to you within 2-3 business days.</p>
            </div>
        </div>
    </div>
    <script>
        // File upload functionality
        const fileDropZone = document.querySelector('.file-drop-zone');
        const fileInput = fileDropZone.querySelector('input[type=\"file\"]');
        const fileList = document.getElementById('file-list');
        fileDropZone.addEventListener('click', () => fileInput.click());
        fileDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileDropZone.style.borderColor = 'rgba(91, 140, 255, 0.8)';
            fileDropZone.style.background = 'rgba(91, 140, 255, 0.1)';
        });
        fileDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            fileDropZone.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            fileDropZone.style.background = 'transparent';
        });
        fileDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            fileDropZone.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            fileDropZone.style.background = 'transparent';
            handleFiles(e.dataTransfer.files);
        });
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });
        function handleFiles(files) {
            fileList.innerHTML = '';
            Array.from(files).forEach(file => {
                const fileItem = document.createElement('div');
                fileItem.className = 'flex items-center justify-between bg-black/20 rounded-lg p-3 border border-white/10';
                fileItem.innerHTML =
                  '<div class="flex items-center space-x-3">' +
                  '<i class="fa-solid fa-file-pdf text-hp-primary"></i>' +
                  '<span class="text-sm">' + file.name + '</span>' +
                  '<span class="text-xs text-hp-text-muted">' + (file.size / 1024 / 1024).toFixed(2) + ' MB</span>' +
                  '</div>' +
                  '<button type="button" class="text-red-400 hover:text-red-300 transition-colors">' +
                  '<i class="fa-solid fa-times"></i>' +
                  '</button>';
                fileList.appendChild(fileItem);
            });
        }
        // Form submission
        document.getElementById('application-form').addEventListener('submit', (e) => {
            e.preventDefault();
            // Hide form and show success state
            document.getElementById('form-wrapper').style.display = 'none';
            document.getElementById('progress-section').style.display = 'none';
            const successState = document.getElementById('success-state');
            successState.classList.remove('hidden');
            successState.style.opacity = '0';
            successState.style.transform = 'translateY(20px)';
            setTimeout(() => {
                successState.style.transition = 'all 0.3s ease-out';
                successState.style.opacity = '1';
                successState.style.transform = 'translateY(0)';
            }, 100);
        });
        // Progress bar animation
        window.addEventListener('load', () => {
            setTimeout(() => {
                document.getElementById('progress-fill').style.width = '75%';
            }, 1000);
        });
    </script>

</body>

</html>`;

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <iframe
        title={`Published Form ${slug}`}
        srcDoc={html as any}
        style={{ width: '100%', height: 'calc(100vh - 0px)', border: '0', background: 'transparent' }}
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}

export default PublicForm;
