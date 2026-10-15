import { parentPort, workerData } from "node:worker_threads";
import { ActualApiClient } from "./actual-api-client.js";
import { setActualCredentials, } from "./settings-store.js";
const { config, credentials } = workerData;
setActualCredentials(config, credentials);
const client = new ActualApiClient(config);
// Keep the SDK singleton serial even if a caller accidentally overlaps requests.
let chain = Promise.resolve();
parentPort.on("message", ({ id, method, args, }) => {
    chain = chain.then(async () => {
        try {
            const operation = client[method];
            const value = await operation.apply(client, args);
            parentPort.postMessage({ id, ok: true, value });
        }
        catch {
            parentPort.postMessage({ id, ok: false });
        }
    });
});
//# sourceMappingURL=actual-worker.js.map