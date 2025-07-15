const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://hvbigxctlqwlrptnlayq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkExecutionStatus() {
  try {
    console.log('🔍 Checking PhantomBuster execution status...');
    
    // Get all recent executions
    const { data: executions, error } = await supabase
      .from('campaign_executions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching executions:', error);
      return;
    }

    console.log(`📊 Found ${executions.length} recent executions:`);
    
    executions.forEach((exec, index) => {
      console.log(`\n${index + 1}. Execution: ${exec.phantombuster_execution_id}`);
      console.log(`   Campaign: ${exec.campaign_id}`);
      console.log(`   Status: ${exec.status}`);
      console.log(`   Created: ${exec.created_at}`);
      console.log(`   Updated: ${exec.updated_at}`);
      if (exec.error) {
        console.log(`   Error: ${exec.error}`);
      }
    });

    // Check specifically for running executions
    const { data: runningExecs, error: runningError } = await supabase
      .from('campaign_executions')
      .select('*')
      .eq('status', 'running');

    if (runningError) {
      console.error('❌ Error fetching running executions:', runningError);
      return;
    }

    console.log(`\n🏃 Currently running executions: ${runningExecs.length}`);
    runningExecs.forEach((exec) => {
      console.log(`   - ${exec.phantombuster_execution_id} (${exec.campaign_id})`);
    });

    // Check the specific execution from the logs
    const targetExecutionId = '8459283423406414';
    const { data: targetExec, error: targetError } = await supabase
      .from('campaign_executions')
      .select('*')
      .eq('phantombuster_execution_id', targetExecutionId)
      .single();

    if (targetError) {
      console.log(`\n❓ Target execution ${targetExecutionId} not found:`, targetError.message);
    } else {
      console.log(`\n🎯 Target execution ${targetExecutionId}:`);
      console.log(`   Status: ${targetExec.status}`);
      console.log(`   Campaign: ${targetExec.campaign_id}`);
      console.log(`   Created: ${targetExec.created_at}`);
      console.log(`   Updated: ${targetExec.updated_at}`);
    }

  } catch (error) {
    console.error('💥 Script failed:', error.message);
  }
}

checkExecutionStatus(); 