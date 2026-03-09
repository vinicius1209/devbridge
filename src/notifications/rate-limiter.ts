export class RateLimiter {
  private requests = new Map<string, number[]>();

  isAllowed(ip: string, maxPerMinute: number): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000;

    let timestamps = this.requests.get(ip) ?? [];
    // Clean old entries
    timestamps = timestamps.filter(t => now - t < windowMs);

    if (timestamps.length >= maxPerMinute) {
      this.requests.set(ip, timestamps);
      return false;
    }

    timestamps.push(now);
    this.requests.set(ip, timestamps);
    return true;
  }
}
