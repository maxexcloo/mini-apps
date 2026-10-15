import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
const lifetime = 8 * 60 * 60 * 1000;
const cookieName = "actual_up_session";
const digest = (value) => createHash("sha256").update(value).digest();
/** Opaque, server-side sessions expire on restart; no credentials enter cookies. */
export class Sessions {
    username;
    password;
    secure;
    sessions = new Map();
    attempts = new Map();
    constructor(username, password, secure) {
        this.username = username;
        this.password = password;
        this.secure = secure;
    }
    token(cookie) {
        return cookie
            ?.split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${cookieName}=`))
            ?.slice(cookieName.length + 1);
    }
    valid(cookie) {
        const token = this.token(cookie);
        if (!token)
            return false;
        const hash = digest(token).toString("hex");
        const expires = this.sessions.get(hash);
        if (expires && expires > Date.now())
            return true;
        this.sessions.delete(hash);
        return false;
    }
    login(username, password, address) {
        const now = Date.now();
        for (const [key, value] of this.attempts)
            if (value.until <= now)
                this.attempts.delete(key);
        const attempt = this.attempts.get(address) ?? {
            count: 0,
            until: now + 15 * 60 * 1000,
        };
        if (attempt.count >= 10 ||
            (!this.attempts.has(address) && this.attempts.size >= 1000))
            return { limited: true };
        // Evaluate both comparisons even if the username is wrong.
        const userMatches = timingSafeEqual(digest(username), digest(this.username));
        const passwordMatches = timingSafeEqual(digest(password), digest(this.password));
        if (!userMatches || !passwordMatches) {
            attempt.count++;
            this.attempts.set(address, attempt);
            return {};
        }
        this.attempts.delete(address);
        for (const [key, expires] of this.sessions)
            if (expires <= now)
                this.sessions.delete(key);
        if (this.sessions.size >= 100)
            this.sessions.delete(this.sessions.keys().next().value);
        const token = randomBytes(32).toString("base64url");
        this.sessions.set(digest(token).toString("hex"), now + lifetime);
        return { cookie: this.cookie(token, lifetime / 1000) };
    }
    logout(cookie) {
        const token = this.token(cookie);
        if (token)
            this.sessions.delete(digest(token).toString("hex"));
        return this.cookie("", 0);
    }
    cookie(token, age) {
        return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${this.secure ? "; Secure" : ""}`;
    }
}
//# sourceMappingURL=auth.js.map