import { assertActualCompatibility } from "./actual-version.js";
import { getActualCredentials } from "./settings-store.js";
import { mkdir } from "node:fs/promises";
import * as api from "@actual-app/api";
import { environmentValue } from "./config.js";
export class ActualApiClient {
    app;
    opened = false;
    constructor(app) {
        this.app = app;
    }
    get config() {
        return this.app.actual;
    }
    async open() {
        if (this.opened)
            return;
        await mkdir(this.config.cacheDirectory, { recursive: true });
        const base = {
            dataDir: this.config.cacheDirectory,
            serverURL: this.config.serverUrl,
            verbose: false,
        };
        const credentials = getActualCredentials(this.app);
        const syncId = this.config.syncId ??
            (this.config.syncIdEnv
                ? environmentValue(this.config.syncIdEnv)
                : undefined);
        if (!credentials || !syncId)
            throw new Error("Configure Actual in the app first");
        try {
            await api.init({
                ...base,
                ...(credentials.method === "password"
                    ? { password: credentials.credential }
                    : { sessionToken: credentials.credential }),
            });
            const version = await api.getServerVersion();
            if ("error" in version)
                throw new Error("Actual server check failed");
            assertActualCompatibility(version.version);
            await api.downloadBudget(syncId, {
                password: credentials.encryptionPassword,
            });
            this.opened = true;
        }
        catch (error) {
            await api.shutdown().catch(() => { });
            throw error;
        }
    }
    async close() {
        if (!this.opened)
            return;
        await api.shutdown();
        this.opened = false;
    }
    async getServerVersion() {
        await this.open();
        const result = await api.getServerVersion();
        if ("error" in result)
            throw new Error(`Actual server check failed: ${result.error}`);
        return result.version;
    }
    async getAccounts() {
        await this.open();
        return api.getAccounts();
    }
    async getCategories() {
        await this.open();
        return api.getCategories();
    }
    async getPayees() {
        await this.open();
        return api.getPayees();
    }
    async getTransactions(accountId, startDate, endDate) {
        await this.open();
        return api.getTransactions(accountId, startDate, endDate);
    }
    async importTransaction(accountId, transaction) {
        await this.open();
        const result = await api.importTransactions(accountId, [transaction], {
            defaultCleared: transaction.cleared,
            reimportDeleted: false,
        });
        return {
            added: result.added,
            errors: result.errors,
            updated: result.updated,
        };
    }
    async updateTransaction(id, fields) {
        await this.open();
        await api.updateTransaction(id, fields);
    }
    async deleteTransaction(id) {
        await this.open();
        await api.deleteTransaction(id);
    }
    async sync() {
        await this.open();
        await api.sync();
    }
}
//# sourceMappingURL=actual-api-client.js.map