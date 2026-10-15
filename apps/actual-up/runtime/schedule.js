import { Cron } from "croner";
/** Full history repairs interrupted imports without a separate cursor database. */
export function startSchedule(config, engine, runner, actual) {
    if (!config.schedule.enabled)
        return () => { };
    const reconcile = (backfill) => {
        if (!config.mappings.length)
            return;
        runner.enqueue(backfill ? "automatic-backfill" : "schedule", backfill ? "automatic-backfill" : "schedule", async () => {
            await actual.sync();
            return engine.reconcile(backfill ? { since: "1970-01-01" } : {});
        });
    };
    const options = { paused: true, timezone: config.schedule.timezone };
    const recent = new Cron(config.schedule.cron, options, () => reconcile(false));
    const backfill = new Cron(config.schedule.backfillCron, options, () => reconcile(true));
    reconcile(true);
    recent.resume();
    backfill.resume();
    return () => {
        recent.stop();
        backfill.stop();
    };
}
//# sourceMappingURL=schedule.js.map