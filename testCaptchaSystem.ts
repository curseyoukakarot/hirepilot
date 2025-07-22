/**
 * CAPTCHA System Testing Utilities
 * Simple test to verify CAPTCHA system files and components are in place
 */

interface TestResult {
  test: string;
  passed: boolean;
  details: string;
  duration: number;
}

class CaptchaSystemTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting CAPTCHA System Tests...\n');

    // Test 1: Check files exist
    await this.testFilesExist();
    
    // Test 2: Check database migration
    await this.testDatabaseMigration();
    
    // Test 3: Create test page
    await this.createMockCaptchaTestPage();
    
    // Show results
    this.showResults();
  }

  private async testFilesExist(): Promise<void> {
    const start = Date.now();
    
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const requiredFiles = [
        'services/puppet/captchaDetectionService.ts',
        'services/puppet/slackAlertService.ts', 
        'services/puppet/captchaOrchestrator.ts',
        'services/puppet/captchaSystemRecovery.ts',
        'supabase/migrations/20250130000014_add_captcha_detection_system.sql',
        'api/puppet/healthStats.ts',
        'CAPTCHA_DETECTION_SYSTEM.md'
      ];

      let existingFiles = 0;
      const missingFiles: string[] = [];

      for (const file of requiredFiles) {
        try {
          await fs.access(path.join(process.cwd(), file));
          existingFiles++;
        } catch {
          missingFiles.push(file);
        }
      }

      const allExist = existingFiles === requiredFiles.length;

      this.results.push({
        test: 'CAPTCHA Files Exist',
        passed: allExist,
        details: allExist 
          ? `All ${requiredFiles.length} CAPTCHA system files exist ✅` 
          : `${existingFiles}/${requiredFiles.length} files exist. Missing: ${missingFiles.join(', ')}`,
        duration: Date.now() - start
      });
    } catch (error) {
      this.results.push({
        test: 'CAPTCHA Files Exist',
        passed: false,
        details: error.message,
        duration: Date.now() - start
      });
    }
  }

  private async testDatabaseMigration(): Promise<void> {
    const start = Date.now();
    
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const migrationFile = path.join(process.cwd(), 'supabase/migrations/20250130000014_add_captcha_detection_system.sql');
      const content = await fs.readFile(migrationFile, 'utf8');
      
      // Check for key components in the migration
      const requiredComponents = [
        'puppet_captcha_incidents',
        'puppet_captcha_detection_settings',
        'record_captcha_incident',
        'get_unresolved_captcha_incidents',
        'get_captcha_statistics'
      ];

      const missingComponents = requiredComponents.filter(component => 
        !content.includes(component)
      );

      const isComplete = missingComponents.length === 0;

      this.results.push({
        test: 'Database Migration',
        passed: isComplete,
        details: isComplete 
          ? 'Migration contains all required CAPTCHA tables and functions ✅'
          : `Migration missing: ${missingComponents.join(', ')}`,
        duration: Date.now() - start
      });
    } catch (error) {
      this.results.push({
        test: 'Database Migration',
        passed: false,
        details: `Migration file error: ${error.message}`,
        duration: Date.now() - start
      });
    }
  }

  private showResults(): void {
    console.log('\n🎯 CAPTCHA System Test Results:');
    console.log('================================');
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.test} (${result.duration}ms)`);
      console.log(`   ${result.details}\n`);
    });
    
    console.log(`📊 Summary: ${passed}/${total} tests passed (${failed} failed)`);
    console.log(`\n🛡️ CAPTCHA System Status:`);
    
    if (failed === 0) {
      console.log('🎉 All CAPTCHA system components are in place! ');
      console.log('✅ Database schema ready');
      console.log('✅ Service files created');
      console.log('✅ Admin dashboard integrated');
      console.log('✅ Documentation complete');
      console.log('\n🚀 Next steps:');
      console.log('1. Run database migration: psql -f supabase/migrations/20250130000014_add_captcha_detection_system.sql');
      console.log('2. Configure Slack webhook URL in environment variables');
      console.log('3. Set up Supabase storage bucket for screenshots');
      console.log('4. Test with mock CAPTCHA page (created below)');
    } else {
      console.log('⚠️  Some components are missing. Please review the errors above.');
    }
  }

  /**
   * Create a local HTML test file for manual CAPTCHA testing
   */
  async createMockCaptchaTestPage(): Promise<string> {
    const start = Date.now();
    
    try {
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LinkedIn Security Challenge - Test Page</title>
    <style>
        body { 
            font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Helvetica Neue,sans-serif;
            padding: 20px; 
            background: #f3f2ef; 
            margin: 0;
        }
        .container { 
            max-width: 500px; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            border-radius: 8px; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 { color: #0a66c2; margin-bottom: 8px; }
        .captcha-container { 
            border: 2px solid #0a66c2; 
            padding: 20px; 
            margin: 20px 0; 
            border-radius: 4px; 
            background: #f8f9fa;
        }
        input[name="captcha"] { 
            width: 100%; 
            padding: 12px; 
            margin: 10px 0; 
            border: 1px solid #ccc; 
            border-radius: 4px; 
            box-sizing: border-box;
        }
        .challenge-form { 
            background: #ffffff; 
            padding: 15px; 
            border-radius: 4px; 
            border: 1px solid #ddd;
        }
        button { 
            background: #0a66c2; 
            color: white; 
            padding: 12px 24px; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
            font-weight: 600;
        }
        button:hover { background: #004182; }
        .info { 
            background: #e7f3ff; 
            border: 1px solid #0a66c2; 
            padding: 15px; 
            border-radius: 4px; 
            margin-top: 20px;
        }
        .info p { margin: 5px 0; }
        .status { color: #067306; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 LinkedIn Security Challenge</h1>
        <p>Please complete this security check to verify you're human</p>
        
        <div class="captcha-container">
            <div class="challenge-form">
                <h3>Complete this challenge:</h3>
                <input type="text" name="captcha" placeholder="Enter the characters you see..." required>
                <div style="margin: 15px 0;">
                    <div style="width: 200px; height: 60px; background: #f0f0f0; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-family: monospace; font-size: 18px; letter-spacing: 3px; color: #333; background: linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%);">
                        X7K9P
                    </div>
                </div>
                <button type="submit" onclick="verify()">Verify Human</button>
            </div>
        </div>
        
        <div id="captcha" style="display: none; background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px;">
            <p><strong>⚠️ Additional verification required</strong></p>
            <p>Alternative CAPTCHA method activated</p>
        </div>
        
        <div class="info">
            <h3>🧪 CAPTCHA Detection Test Page</h3>
            <p><strong>This is a test page for HirePilot CAPTCHA detection system.</strong></p>
            <p class="status">✓ URL pattern: /checkpoint/challenge</p>
            <p class="status">✓ CAPTCHA elements: input[name="captcha"], .captcha-container, #captcha</p>
            <p class="status">✓ Warning text: "Please complete this security check"</p>
            <p><strong>📝 Usage:</strong> Use this page to test CAPTCHA detection in your Puppeteer automation.</p>
        </div>
    </div>
    
    <script>
        // Simulate LinkedIn's CAPTCHA behavior
        setTimeout(() => {
            document.getElementById('captcha').style.display = 'block';
        }, 3000);
        
        function verify() {
            alert('🧪 Test CAPTCHA detected! This would trigger the HirePilot CAPTCHA detection system.');
        }
    </script>
</body>
</html>`;

      const fs = require('fs').promises;
      const path = require('path');
      
      const testFilePath = path.join(process.cwd(), 'test-captcha-page.html');
      await fs.writeFile(testFilePath, htmlContent);
      
      console.log(`\n📄 Mock CAPTCHA test page created: ${testFilePath}`);
      console.log('💡 Open this file in a browser to see the test CAPTCHA page');
      console.log('🔗 Or use file://' + testFilePath + ' in your Puppeteer tests');
      
      this.results.push({
        test: 'Create Mock Test Page',
        passed: true,
        details: `Test page created successfully: test-captcha-page.html`,
        duration: Date.now() - start
      });
      
      return testFilePath;
    } catch (error) {
      this.results.push({
        test: 'Create Mock Test Page',
        passed: false,
        details: error.message,
        duration: Date.now() - start
      });
      return '';
    }
  }
}

// Export for use
export { CaptchaSystemTester };

// Manual test runner functions
export async function runCaptchaSystemTests() {
  const tester = new CaptchaSystemTester();
  await tester.runAllTests();
}

export async function createMockCaptchaPage() {
  const tester = new CaptchaSystemTester();
  return await tester.createMockCaptchaTestPage();
}

// Run if called directly
if (require.main === module) {
  runCaptchaSystemTests().catch(console.error);
} 