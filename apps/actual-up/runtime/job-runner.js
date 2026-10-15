import { randomUUID } from "node:crypto";
/** One queue owns complete operations, including reads and manual actions. */
export class JobRunner {
    metrics;
    logger;
    chain = Promise.resolve();
    keys = new Set();
    jobs = [];
    stopping = false;
    constructor(metrics, logger) {
        this.metrics = metrics;
        this.logger = logger;
    }
    get history() {
        return this.jobs;
    }
    get depth() {
        return this.keys.size;
    }
    enqueue(key, trigger, operation) {
        if (this.stopping || this.keys.has(key) || this.keys.size >= 32)
            return false;
        this.keys.add(key);
        const job = { id: randomUUID(), trigger, state: "queued" };
        this.jobs.unshift(job);
        this.metrics.queueDepth.set(this.depth);
        this.chain = this.chain.then(async () => {
            job.state = "running";
            job.startedAt = new Date().toISOString();
            const stopTimer = this.metrics.jobDuration.startTimer({ trigger });
            try {
                job.result = await operation();
                job.state = hasFailures(job.result) ? "failure" : "success";
            }
            catch {
                job.state = "failure";
                this.logger.error({ trigger }, "Operation failed; check credentials, mappings and connectivity");
            }
            finally {
                stopTimer();
                job.finishedAt = new Date().toISOString();
                this.metrics.jobs.inc({ outcome: job.state, trigger });
                if (job.state === "success")
                    this.metrics.lastSuccess.set({ trigger }, Date.now() / 1000);
                this.keys.delete(key);
                this.metrics.queueDepth.set(this.depth);
                const completed = this.jobs.filter((entry) => entry.finishedAt);
                for (const old of completed.slice(20))
                    this.jobs.splice(this.jobs.indexOf(old), 1);
            }
        });
        return true;
    }
    async drain() {
        let pending;
        do {
            pending = this.chain;
            await pending;
        } while (pending !== this.chain);
    }
    async close() {
        this.stopping = true;
        await this.drain();
    }
}
function hasFailures(value) {
    return (typeof value === "object" &&
        value !== null &&
        "failed" in value &&
        typeof value.failed === "number" &&
        value.failed > 0);
}
//# sourceMappingURL=job-runner.js.map