import { payoutQueue } from '../utils/queue';

async function cleanQueue() {
  try {
    console.log('Cleaning queue...');
    
    // Get queue status before cleaning
    const jobCounts = await payoutQueue.getJobCounts();
    console.log('Current job counts:', jobCounts);

    // Clean all jobs (waiting, active, delayed, completed, failed)
    await payoutQueue.clean(0, 'active');
    await payoutQueue.clean(0, 'wait');
    await payoutQueue.clean(0, 'delayed');
    await payoutQueue.clean(0, 'completed');
    await payoutQueue.clean(0, 'failed');

    // Empty the queue
    await payoutQueue.empty();

    // Get queue status after cleaning
    const finalCounts = await payoutQueue.getJobCounts();
    console.log('Final job counts:', finalCounts);

    console.log('Queue cleaned successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning queue:', error);
    process.exit(1);
  }
}

cleanQueue();
