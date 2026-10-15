import { environmentValue } from "./config.js";
export class WebhookAlertSink {
    config;
    logger;
    fetcher;
    lastSent = new Map();
    constructor(config, logger, fetcher = fetch) {
        this.config = config;
        this.logger = logger;
        this.fetcher = fetcher;
    }
    async send(alert) {
        const key = `${alert.type}:${alert.account ?? "global"}`;
        const now = Date.now();
        const cooldown = this.config.cooldownMinutes * 60_000;
        if (now - (this.lastSent.get(key) ?? 0) < cooldown)
            return;
        const response = await this.fetcher(environmentValue(this.config.urlEnv), {
            body: JSON.stringify({
                ...alert,
                source: "actual-up",
                timestamp: new Date().toISOString(),
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
            this.logger.warn({ alertType: alert.type, status: response.status }, "Alert webhook failed");
            return;
        }
        this.lastSent.set(key, now);
    }
}
export class LoggingAlertSink {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    async send(alert) {
        this.logger.warn({
            account: alert.account,
            alertType: alert.type,
            severity: alert.severity,
        }, alert.detail);
    }
}
//# sourceMappingURL=alerts.js.map