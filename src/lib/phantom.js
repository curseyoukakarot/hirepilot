/**
 * Fetches a proxy for a given phantom_id from the phantombuster_proxies table.
 * It selects a proxy that is not in use and matches the region of the phantom's linkedin_cookie.
 * @param {string} phantomId - The ID of the phantom.
 * @returns {Promise<Object|null>} - The proxy object or null if no proxy is available.
 */
async function getProxyForPhantom(phantomId) {
  const { data: phantom, error: phantomError } = await supabase
    .from('phantoms')
    .select('linkedin_cookie')
    .eq('id', phantomId)
    .single();

  if (phantomError || !phantom) {
    console.error('Error fetching phantom:', phantomError);
    return null;
  }

  const { data: cookie, error: cookieError } = await supabase
    .from('linkedin_cookies')
    .select('region')
    .eq('id', phantom.linkedin_cookie)
    .single();

  if (cookieError || !cookie) {
    console.error('Error fetching linkedin cookie:', cookieError);
    return null;
  }

  const { data: proxy, error: proxyError } = await supabase
    .from('phantombuster_proxies')
    .select('*')
    .eq('in_use', false)
    .eq('region', cookie.region)
    .order('last_used_at', { ascending: true })
    .limit(1)
    .single();

  if (proxyError) {
    console.error('Error fetching proxy:', proxyError);
    return null;
  }

  return proxy;
}

/**
 * Enqueues a new launch for a given phantom_id into the phantom_launch_queue table.
 * It checks if there is already a pending or running launch for the phantom_id and inserts a new record if none exists.
 * @param {string} phantomId - The ID of the phantom.
 * @returns {Promise<Object|null>} - The inserted launch record or null if a launch is already queued.
 */
async function enqueuePhantomLaunch(phantomId) {
  const { data: existingLaunch, error: existingError } = await supabase
    .from('phantom_launch_queue')
    .select('*')
    .eq('phantom_id', phantomId)
    .in('status', ['pending', 'running'])
    .single();

  if (existingError && existingError.code !== 'PGRST116') {
    console.error('Error checking existing launch:', existingError);
    return null;
  }

  if (existingLaunch) {
    console.log('A launch is already queued or running for this phantom.');
    return null;
  }

  const { data: newLaunch, error: insertError } = await supabase
    .from('phantom_launch_queue')
    .insert({
      phantom_id: phantomId,
      status: 'pending',
      scheduled_at: new Date().toISOString()
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error enqueueing launch:', insertError);
    return null;
  }

  return newLaunch;
}

/**
 * Processes the phantom_launch_queue by fetching the next pending launch, updating its status to 'running',
 * fetching the associated phantom and proxy, and then calling launchPhantom with the proxy configuration.
 * It also updates the proxy's in_use and last_used_at fields.
 * @returns {Promise<Object|null>} - The processed launch record or null if no pending launch is found.
 */
async function processPhantomLaunchQueue() {
  const { data: pendingLaunch, error: pendingError } = await supabase
    .from('phantom_launch_queue')
    .select('*')
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .single();

  if (pendingError || !pendingLaunch) {
    console.log('No pending launches found.');
    return null;
  }

  const { data: updatedLaunch, error: updateError } = await supabase
    .from('phantom_launch_queue')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', pendingLaunch.id)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating launch status:', updateError);
    return null;
  }

  const { data: phantom, error: phantomError } = await supabase
    .from('phantoms')
    .select('*')
    .eq('id', pendingLaunch.phantom_id)
    .single();

  if (phantomError || !phantom) {
    console.error('Error fetching phantom:', phantomError);
    return null;
  }

  const proxy = await getProxyForPhantom(phantom.id);
  if (!proxy) {
    console.error('No proxy available for phantom:', phantom.id);
    return null;
  }

  const { data: updatedProxy, error: proxyUpdateError } = await supabase
    .from('phantombuster_proxies')
    .update({ in_use: true, last_used_at: new Date().toISOString() })
    .eq('id', proxy.id)
    .select()
    .single();

  if (proxyUpdateError) {
    console.error('Error updating proxy status:', proxyUpdateError);
    return null;
  }

  const launchResult = await launchPhantom(phantom.id, { proxy: updatedProxy });
  if (!launchResult) {
    console.error('Failed to launch phantom:', phantom.id);
    return null;
  }

  return updatedLaunch;
}

/**
 * Updates the status of a launch in the phantom_launch_queue table.
 * This function updates the status, ended_at, and result fields of the launch record.
 * @param {string} launchId - The ID of the launch record.
 * @param {string} status - The new status of the launch ('completed', 'failed', etc.).
 * @param {Object} result - The result object to be stored.
 * @returns {Promise<Object|null>} - The updated launch record or null if the update fails.
 */
async function updatePhantomLaunchStatus(launchId, status, result) {
  const { data: updatedLaunch, error: updateError } = await supabase
    .from('phantom_launch_queue')
    .update({
      status,
      ended_at: new Date().toISOString(),
      result
    })
    .eq('id', launchId)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating launch status:', updateError);
    return null;
  }

  return updatedLaunch;
}

/**
 * Releases a proxy by updating its in_use status to false in the phantombuster_proxies table.
 * @param {string} proxyId - The ID of the proxy to release.
 * @returns {Promise<Object|null>} - The updated proxy record or null if the update fails.
 */
async function releaseProxy(proxyId) {
  const { data: updatedProxy, error: updateError } = await supabase
    .from('phantombuster_proxies')
    .update({ in_use: false })
    .eq('id', proxyId)
    .select()
    .single();

  if (updateError) {
    console.error('Error releasing proxy:', updateError);
    return null;
  }

  return updatedProxy;
}

/**
 * Launches a PhantomBuster phantom with the given configuration.
 * This function enqueues a launch, processes the queue, and releases the proxy after the launch is completed or failed.
 * @param {string} phantomId - The ID of the phantom to launch.
 * @param {Object} config - The configuration for the launch, including proxy details.
 * @returns {Promise<Object|null>} - The result of the launch or null if the launch fails.
 */
async function launchPhantom(phantomId, config) {
  const launch = await enqueuePhantomLaunch(phantomId);
  if (!launch) {
    console.error('Failed to enqueue launch for phantom:', phantomId);
    return null;
  }

  const processedLaunch = await processPhantomLaunchQueue();
  if (!processedLaunch) {
    console.error('Failed to process launch queue for phantom:', phantomId);
    return null;
  }

  try {
    const result = await phantombuster.launch(processedLaunch.phantom_id, config);
    await updatePhantomLaunchStatus(processedLaunch.id, 'completed', result);
    return result;
  } catch (error) {
    console.error('Error launching phantom:', error);
    await updatePhantomLaunchStatus(processedLaunch.id, 'failed', { error: error.message });
    return null;
  } finally {
    if (config.proxy) {
      await releaseProxy(config.proxy.id);
    }
  }
}

/**
 * Schedules a new launch for a given phantom_id by inserting a record into the phantom_schedules table.
 * This function checks if a schedule already exists for the given phantom_id and inserts a new record if none exists.
 * @param {string} phantomId - The ID of the phantom.
 * @param {Object} scheduleConfig - The configuration for the schedule, including run_plan, windows, and offsets.
 * @returns {Promise<Object|null>} - The inserted schedule record or null if a schedule already exists.
 */
async function schedulePhantomLaunch(phantomId, scheduleConfig) {
  const { data: existingSchedule, error: existingError } = await supabase
    .from('phantom_schedules')
    .select('*')
    .eq('phantom_id', phantomId)
    .single();

  if (existingError && existingError.code !== 'PGRST116') {
    console.error('Error checking existing schedule:', existingError);
    return null;
  }

  if (existingSchedule) {
    console.log('A schedule already exists for this phantom.');
    return null;
  }

  const { data: newSchedule, error: insertError } = await supabase
    .from('phantom_schedules')
    .insert({
      phantom_id: phantomId,
      run_plan: scheduleConfig.run_plan,
      windows: scheduleConfig.windows,
      offsets: scheduleConfig.offsets
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error scheduling launch:', insertError);
    return null;
  }

  return newSchedule;
}

/**
 * Generates a randomized run time for a given schedule.
 * This function calculates the next run time based on the schedule's run_plan, windows, and offsets.
 * @param {Object} schedule - The schedule object containing run_plan, windows, and offsets.
 * @returns {Date} - The next randomized run time.
 */
function generateRandomizedRunTime(schedule) {
  const now = new Date();
  const { run_plan, windows, offsets } = schedule;

  let nextRunTime = new Date(now);
  if (run_plan === 'daily') {
    nextRunTime.setDate(nextRunTime.getDate() + 1);
  } else if (run_plan === 'weekly') {
    nextRunTime.setDate(nextRunTime.getDate() + 7);
  } else if (run_plan === 'monthly') {
    nextRunTime.setMonth(nextRunTime.getMonth() + 1);
  }

  const window = windows[Math.floor(Math.random() * windows.length)];
  const offset = offsets[Math.floor(Math.random() * offsets.length)];

  nextRunTime.setHours(window.start + offset);
  nextRunTime.setMinutes(0);
  nextRunTime.setSeconds(0);

  return nextRunTime;
}

/**
 * Enqueues a new job into the phantom_job_queue table.
 * This function inserts a job with the given phantom_id, schedule_id, and next_run_at.
 * @param {string} phantomId - The ID of the phantom.
 * @param {string} scheduleId - The ID of the schedule.
 * @param {Date} nextRunAt - The next run time for the job.
 * @returns {Promise<Object|null>} - The inserted job record or null if the insert fails.
 */
async function enqueuePhantomJob(phantomId, scheduleId, nextRunAt) {
  const { data: newJob, error: insertError } = await supabase
    .from('phantom_job_queue')
    .insert({
      phantom_id: phantomId,
      schedule_id: scheduleId,
      next_run_at: nextRunAt.toISOString()
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error enqueueing job:', insertError);
    return null;
  }

  return newJob;
}

/**
 * Processes the phantom_job_queue by fetching the next job with next_run_at <= now(),
 * enqueuing a launch for the phantom, and then re-enqueuing the job with a new next_run_at based on the schedule.
 * @returns {Promise<Object|null>} - The processed job record or null if no job is found.
 */
async function processPhantomJobQueue() {
  const { data: nextJob, error: jobError } = await supabase
    .from('phantom_job_queue')
    .select('*')
    .lte('next_run_at', new Date().toISOString())
    .order('next_run_at', { ascending: true })
    .limit(1)
    .single();

  if (jobError || !nextJob) {
    console.log('No jobs found to process.');
    return null;
  }

  const { data: schedule, error: scheduleError } = await supabase
    .from('phantom_schedules')
    .select('*')
    .eq('id', nextJob.schedule_id)
    .single();

  if (scheduleError || !schedule) {
    console.error('Error fetching schedule:', scheduleError);
    return null;
  }

  const launch = await enqueuePhantomLaunch(nextJob.phantom_id);
  if (!launch) {
    console.error('Failed to enqueue launch for phantom:', nextJob.phantom_id);
    return null;
  }

  const nextRunAt = generateRandomizedRunTime(schedule);
  const { data: updatedJob, error: updateError } = await supabase
    .from('phantom_job_queue')
    .update({ next_run_at: nextRunAt.toISOString() })
    .eq('id', nextJob.id)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating job:', updateError);
    return null;
  }

  return updatedJob;
}

/**
 * Logs the health status of a phantom run by inserting a record into the phantom_health_logs table.
 * This function logs the phantom_id, run_id, status, and details.
 * @param {string} phantomId - The ID of the phantom.
 * @param {string} runId - The ID of the run.
 * @param {string} status - The status of the run ('success', 'warning', 'error', etc.).
 * @param {Object} details - Additional details about the run.
 * @returns {Promise<Object|null>} - The inserted log record or null if the insert fails.
 */
async function logPhantomHealth(phantomId, runId, status, details) {
  const { data: newLog, error: insertError } = await supabase
    .from('phantom_health_logs')
    .insert({
      phantom_id: phantomId,
      run_id: runId,
      status,
      details
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error logging phantom health:', insertError);
    return null;
  }

  return newLog;
}

/**
 * Sets the cooldown status of a phantom by updating the cooldown_until field in the phantoms table.
 * @param {string} phantomId - The ID of the phantom.
 * @param {Date} cooldownUntil - The date until which the phantom is in cooldown.
 * @returns {Promise<Object|null>} - The updated phantom record or null if the update fails.
 */
async function setPhantomCooldown(phantomId, cooldownUntil) {
  const { data: updatedPhantom, error: updateError } = await supabase
    .from('phantoms')
    .update({ cooldown_until: cooldownUntil.toISOString() })
    .eq('id', phantomId)
    .select()
    .single();

  if (updateError) {
    console.error('Error setting phantom cooldown:', updateError);
    return null;
  }

  return updatedPhantom;
}

/**
 * Checks the health of a phantom run, logs the health status, and sets a cooldown if the status is 'error'.
 * @param {string} phantomId - The ID of the phantom.
 * @param {string} runId - The ID of the run.
 * @param {string} status - The status of the run ('success', 'warning', 'error', etc.).
 * @param {Object} details - Additional details about the run.
 * @returns {Promise<Object|null>} - The logged health record or null if the logging fails.
 */
async function checkPhantomHealth(phantomId, runId, status, details) {
  const log = await logPhantomHealth(phantomId, runId, status, details);
  if (!log) {
    return null;
  }

  if (status === 'error') {
    const cooldownUntil = new Date();
    cooldownUntil.setHours(cooldownUntil.getHours() + 48);
    await setPhantomCooldown(phantomId, cooldownUntil);
  }

  return log;
}

/**
 * Fetches the health status of a phantom from the phantom_health_logs table.
 * This function fetches the most recent log for the given phantom_id.
 * @param {string} phantomId - The ID of the phantom.
 * @returns {Promise<Object|null>} - The most recent health log or null if no log is found.
 */
async function getPhantomHealth(phantomId) {
  const { data: healthLog, error: healthError } = await supabase
    .from('phantom_health_logs')
    .select('*')
    .eq('phantom_id', phantomId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (healthError) {
    console.error('Error fetching phantom health:', healthError);
    return null;
  }

  return healthLog;
}

/**
 * Fetches the cooldown status of a phantom from the phantoms table.
 * This function fetches the cooldown_until field for the given phantom_id.
 * @param {string} phantomId - The ID of the phantom.
 * @returns {Promise<Object|null>} - The phantom record with cooldown_until or null if the fetch fails.
 */
async function getPhantomCooldown(phantomId) {
  const { data: phantom, error: phantomError } = await supabase
    .from('phantoms')
    .select('cooldown_until')
    .eq('id', phantomId)
    .single();

  if (phantomError) {
    console.error('Error fetching phantom cooldown:', phantomError);
    return null;
  }

  return phantom;
}

/**
 * Overrides the cooldown status of a phantom by setting the cooldown_until field to null in the phantoms table.
 * @param {string} phantomId - The ID of the phantom.
 * @returns {Promise<Object|null>} - The updated phantom record or null if the update fails.
 */
async function overridePhantomCooldown(phantomId) {
  const { data: updatedPhantom, error: updateError } = await supabase
    .from('phantoms')
    .update({ cooldown_until: null })
    .eq('id', phantomId)
    .select()
    .single();

  if (updateError) {
    console.error('Error overriding phantom cooldown:', updateError);
    return null;
  }

  return updatedPhantom;
}

/**
 * Fetches the monitor data for all phantoms.
 * This function fetches the phantom_id, status, last_run, cookie_age, proxy, phantom_status, cooldown, and next_run for each phantom.
 * @returns {Promise<Array|null>} - An array of monitor data records or null if the fetch fails.
 */
async function getPhantomMonitorData() {
  const { data: monitorData, error: monitorError } = await supabase
    .from('phantoms')
    .select(`
      id,
      status,
      last_run,
      linkedin_cookie (
        created_at
      ),
      proxy (
        id,
        region
      ),
      cooldown_until,
      phantom_schedules (
        next_run_at
      )
    `);

  if (monitorError) {
    console.error('Error fetching phantom monitor data:', monitorError);
    return null;
  }

  return monitorData.map(phantom => ({
    phantom_id: phantom.id,
    status: phantom.status,
    last_run: phantom.last_run,
    cookie_age: phantom.linkedin_cookie ? Math.floor((new Date() - new Date(phantom.linkedin_cookie.created_at)) / (1000 * 60 * 60 * 24)) : null,
    proxy: phantom.proxy ? { id: phantom.proxy.id, region: phantom.proxy.region } : null,
    phantom_status: phantom.status,
    cooldown: phantom.cooldown_until,
    next_run: phantom.phantom_schedules && phantom.phantom_schedules.length > 0 ? phantom.phantom_schedules[0].next_run_at : null
  }));
}

/**
 * Fetches the health logs for a given phantom_id from the phantom_health_logs table.
 * This function fetches the logs ordered by created_at in descending order.
 * @param {string} phantomId - The ID of the phantom.
 * @returns {Promise<Array|null>} - An array of health log records or null if the fetch fails.
 */
async function getPhantomHealthLogs(phantomId) {
  const { data: healthLogs, error: healthError } = await supabase
    .from('phantom_health_logs')
    .select('*')
    .eq('phantom_id', phantomId)
    .order('created_at', { ascending: false });

  if (healthError) {
    console.error('Error fetching phantom health logs:', healthError);
    return null;
  }

  return healthLogs;
}

/**
 * Fetches the proxy assigned to a given phantom_id from the phantombuster_proxies table.
 * This function fetches the proxy record for the given phantom_id.
 * @param {string} phantomId - The ID of the phantom.
 * @returns {Promise<Object|null>} - The proxy record or null if the fetch fails.
 */
async function getPhantomProxy(phantomId) {
  const { data: proxy, error: proxyError } = await supabase
    .from('phantombuster_proxies')
    .select('*')
    .eq('phantom_id', phantomId)
    .single();

  if (proxyError) {
    console.error('Error fetching phantom proxy:', proxyError);
    return null;
  }

  return proxy;
}

/**
 * Fetches the schedule for a given phantom_id from the phantom_schedules table.
 * This function fetches the schedule record for the given phantom_id.
 * @param {string} phantomId - The ID of the phantom.
 * @returns {Promise<Object|null>} - The schedule record or null if the fetch fails.
 */
async function getPhantomSchedule(phantomId) {
  const { data: schedule, error: scheduleError } = await supabase
    .from('phantom_schedules')
    .select('*')
    .eq('phantom_id', phantomId)
    .single();

  if (scheduleError) {
    console.error('Error fetching phantom schedule:', scheduleError);
    return null;
  }

  return schedule;
}

/**
 * Fetches the next job for a given phantom_id from the phantom_job_queue table.
 * This function fetches the job record for the given phantom_id with next_run_at <= now().
 * @param {string} phantomId - The ID of the phantom.
 * @returns {Promise<Object|null>} - The job record or null if the fetch fails.
 */
async function getPhantomJob(phantomId) {
  const { data: job, error: jobError } = await supabase
    .from('phantom_job_queue')
    .select('*')
    .eq('phantom_id', phantomId)
    .lte('next_run_at', new Date().toISOString())
    .order('next_run_at', { ascending: true })
    .limit(1)
    .single();

  if (jobError) {
    console.error('Error fetching phantom job:', jobError);
    return null;
  }

  return job;
}

/**
 * Fetches the next launch for a given phantom_id from the phantom_launch_queue table.
 * This function fetches the launch record for the given phantom_id with status = 'pending'.
 * @param {string} phantomId - The ID of the phantom.
 * @returns {Promise<Object|null>} - The launch record or null if the fetch fails.
 */
async function getPhantomLaunch(phantomId) {
  const { data: launch, error: launchError } = await supabase
    .from('phantom_launch_queue')
    .select('*')
    .eq('phantom_id', phantomId)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .single();

  if (launchError) {
    console.error('Error fetching phantom launch:', launchError);
    return null;
  }

  return launch;
}

/**
 * Fetches the launch history for a given phantom_id from the phantom_launch_queue table.
 * This function fetches the launch records for the given phantom_id ordered by scheduled_at in descending order.
 * @param {string} phantomId - The ID of the phantom.
 * @returns {Promise<Array|null>} - An array of launch records or null if the fetch fails.
 */
async function getPhantomLaunchHistory(phantomId) {
  const { data: launches, error: launchError } = await supabase
    .from('phantom_launch_queue')
    .select('*')
    .eq('phantom_id', phantomId)
    .order('scheduled_at', { ascending: false });

  if (launchError) {
    console.error('Error fetching phantom launch history:', launchError);
    return null;
  }

  return launches;
}

/**
 * Fetches the job history for a given phantom_id from the phantom_job_queue table.
 * This function fetches the job records for the given phantom_id ordered by next_run_at in descending order.
 * @param {string} phantomId - The ID of the phantom.
 * @returns {Promise<Array|null>} - An array of job records or null if the fetch fails.
 */
async function getPhantomJobHistory(phantomId) {
  const { data: jobs, error: jobError } = await supabase
    .from('phantom_job_queue')
    .select('*')
    .eq('phantom_id', phantomId)
    .order('next_run_at', { ascending: false });

  if (jobError) {
    console.error('Error fetching phantom job history:', jobError);
    return null;
  }

  return jobs;
}

/**
 * Fetches the schedule history for a given phantom_id from the phantom_schedules table.
 * This function fetches the schedule records for the given phantom_id ordered by created_at in descending order.
 * @param {string} phantomId - The ID of the phantom.
 * @returns {Promise<Array|null>} - An array of schedule records or null if the fetch fails.
 */
async function getPhantomScheduleHistory(phantomId) {
  const { data: schedules, error: scheduleError } = await supabase
    .from('phantom_schedules')
    .select('*')
    .eq('phantom_id', phantomId)
    .order('created_at', { ascending: false });

  if (scheduleError) {
    console.error('Error fetching phantom schedule history:', scheduleError);
    return null;
  }

  return schedules;
}

/**
 * Fetches the proxy history for a given phantom_id from the phantombuster_proxies table.
 * This function fetches the proxy records for the given phantom_id ordered by last_used_at in descending order.
 * @param {string} phantomId - The ID of the phantom.
 * @returns {Promise<Array|null>} - An array of proxy records or null if the fetch fails.
 */
async function getPhantomProxyHistory(phantomId) {
  const { data: proxies, error: proxyError } = await supabase
    .from('phantombuster_proxies')
    .select('*')
    .eq('phantom_id', phantomId)
    .order('last_used_at', { ascending: false });

  if (proxyError) {
    console.error('Error fetching phantom proxy history:', proxyError);
    return null;
  }

  return proxies;
} 