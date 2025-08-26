import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function BlogArticle() {
  return (
    <>
      {/* Scoped styles preserved from original article page */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.5rem; }
        .prose ul { color: #d1d5db; margin: 1.5rem 0; }
        .prose li { margin-bottom: 0.5rem; }
        .prose blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 2rem 0; font-style: italic; color: #9ca3af; }
        .prose code { background: #374151; color: #f9fafb; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem; }
        .prose pre { background: #1f2937; padding: 1.5rem; border-radius: 0.5rem; overflow-x: auto; margin: 2rem 0; }
        .toc-active { color: #3b82f6; }
      `}</style>

      <BlogNavbar />

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
          alt="modern tech recruitment dashboard interface with blue and purple gradients"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">Automation</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">How AI is Revolutionizing Recruitment: A Complete Guide</h1>
            <p className="text-xl text-gray-200 mb-6">Discover how artificial intelligence is transforming the way companies find, screen, and hire top talent in 2024.</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg"
                alt="Author"
                className="w-12 h-12 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">Marcus Johnson</p>
                <p className="text-gray-300 text-sm">Published on March 15, 2024</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div id="main-content" className="flex max-w-6xl mx-auto px-6 py-12 gap-8">
        {/* TOC */}
        <BlogTOC />

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="introduction">
            <p>
              The recruitment landscape has undergone a dramatic transformation in recent years, with artificial intelligence emerging as a game-changing force. As companies struggle to find qualified candidates in an increasingly competitive market, AI-powered tools are providing innovative solutions that streamline the hiring process and improve outcomes for both employers and job seekers.
            </p>

            <p>
              In this comprehensive guide, we'll explore how AI is reshaping recruitment practices, examine the benefits and challenges of implementation, and provide actionable insights for organizations looking to leverage these technologies effectively.
            </p>
          </div>

          <div id="ai-benefits">
            <h2>Key Benefits of AI in Recruitment</h2>

            <p>Artificial intelligence offers numerous advantages that address traditional recruitment pain points:</p>

            <ul>
              <li>
                <strong>Enhanced Candidate Screening:</strong> AI algorithms can quickly analyze resumes and identify the most qualified candidates based on specific criteria.
              </li>
              <li>
                <strong>Reduced Bias:</strong> Automated screening processes help minimize unconscious bias in initial candidate evaluations.
              </li>
              <li>
                <strong>Time Efficiency:</strong> Recruiters can focus on high-value activities while AI handles routine screening tasks.
              </li>
              <li>
                <strong>Improved Candidate Experience:</strong> Faster response times and personalized communication enhance the overall hiring experience.
              </li>
            </ul>

            <blockquote>
              "AI has reduced our time-to-hire by 40% while significantly improving the quality of candidates we interview." - Sarah Chen, Head of Talent Acquisition at TechCorp
            </blockquote>
          </div>

          {/* Inline CTA 1 */}
          <div id="inline-cta-1" className="bg-blue-600 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to Transform Your Recruitment Process?</h3>
            <p className="mb-4">Start your free trial of HirePilot today and experience the power of AI-driven recruitment.</p>
            <button className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">Start Free Trial</button>
          </div>

          <div id="implementation">
            <h2>Implementation Strategies</h2>

            <p>Successfully implementing AI in recruitment requires careful planning and execution. Here are key strategies to consider:</p>

            <h3>1. Define Clear Objectives</h3>
            <p>Before implementing any AI solution, establish specific goals such as reducing time-to-hire, improving candidate quality, or enhancing diversity metrics.</p>

            <h3>2. Choose the Right Technology</h3>
            <p>
              Evaluate different AI platforms based on your organization's needs, budget, and technical capabilities. Consider factors like:
            </p>

            <ul>
              <li>Integration capabilities with existing systems</li>
              <li>Scalability and customization options</li>
              <li>Data security and compliance features</li>
              <li>User interface and ease of adoption</li>
            </ul>

            <pre>
              <code>{`// Example API integration for candidate scoring
const candidateScore = await aiPlatform.evaluateCandidate({
  resume: candidateData.resume,
  jobRequirements: position.requirements,
  weights: {
    experience: 0.4,
    skills: 0.3,
    education: 0.2,
    cultural_fit: 0.1
  }
});`}</code>
            </pre>
          </div>

          <div id="case-studies">
            <h2>Real-World Case Studies</h2>

            <p>Let's examine how leading companies have successfully implemented AI in their recruitment processes:</p>

            <h3>Case Study 1: Global Tech Company</h3>
            <p>
              A Fortune 500 technology company implemented an AI-powered screening system that reduced initial resume review time by 75% while maintaining high-quality candidate selection standards.
            </p>

            <h3>Case Study 2: Healthcare Organization</h3>
            <p>
              A major healthcare network used AI chatbots to handle initial candidate inquiries, resulting in 24/7 availability and improved candidate engagement rates.
            </p>
          </div>

          {/* Inline CTA 2 */}
          <div id="inline-cta-2" className="bg-gray-800 border border-gray-700 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Need Help Getting Started?</h3>
            <p className="mb-4">Chat with REX, our AI assistant, inside the HirePilot app for personalized guidance.</p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Chat with REX</button>
          </div>

          <div id="future-trends">
            <h2>Future Trends in AI Recruitment</h2>

            <p>As AI technology continues to evolve, we can expect to see several emerging trends in recruitment:</p>

            <ul>
              <li>
                <strong>Predictive Analytics:</strong> AI will better predict candidate success and retention rates
              </li>
              <li>
                <strong>Video Interview Analysis:</strong> Advanced algorithms will analyze facial expressions and speech patterns
              </li>
              <li>
                <strong>Personalized Candidate Journeys:</strong> AI will create tailored experiences for each candidate
              </li>
              <li>
                <strong>Skills-Based Matching:</strong> Focus will shift from credentials to demonstrated abilities
              </li>
            </ul>
          </div>

          <div id="conclusion">
            <h2>Conclusion</h2>

            <p>
              AI is fundamentally changing how organizations approach recruitment, offering unprecedented opportunities to improve efficiency, reduce bias, and enhance the candidate experience. While implementation requires careful planning and consideration, the benefits far outweigh the challenges for most organizations.
            </p>

            <p>
              As we move forward, companies that embrace AI-powered recruitment tools will gain a significant competitive advantage in attracting and hiring top talent. The future of recruitment is here, and it's powered by artificial intelligence.
            </p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Keep Reading</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png"
                alt="recruitment analytics dashboard with charts and metrics"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Analytics</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">5 Key Metrics Every Recruiter Should Track</h3>
                <p className="text-gray-400 mb-4">
                  Discover the essential KPIs that will help you measure and improve your recruitment performance.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>March 10, 2024</span>
                  <span className="mx-2">•</span>
                  <span>5 min read</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png"
                alt="diverse team interview process with technology integration"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Best Practices</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Building Inclusive Hiring Practices</h3>
                <p className="text-gray-400 mb-4">
                  Learn how to create a more diverse and inclusive recruitment process that attracts top talent.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>March 8, 2024</span>
                  <span className="mx-2">•</span>
                  <span>7 min read</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png"
                alt="remote work setup with video conferencing technology"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Remote Work</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">The Future of Remote Hiring</h3>
                <p className="text-gray-400 mb-4">
                  Explore strategies and tools for effectively hiring remote talent in the post-pandemic world.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>March 5, 2024</span>
                  <span className="mx-2">•</span>
                  <span>6 min read</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <div id="newsletter-signup" className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Stay Ahead of the Curve</h2>
          <p className="text-xl mb-8 text-blue-100">Join other recruiters automating their workflow with HirePilot</p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <button className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Subscribe
            </button>
          </div>
          <p className="text-sm text-blue-200 mt-4">No spam. Unsubscribe anytime.</p>
        </div>
      </div>
    </>
  );
} 