import { describe, expect, it } from 'vitest';
import { isIos, opensWebcal } from '../src/platform';

const env = (userAgent: string, platform = 'Linux armv8l', maxTouchPoints = 5) => ({ userAgent, platform, maxTouchPoints });

describe('isIos', () => {
  it('riconosce iPhone e iPad', () => {
    expect(isIos(env('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15', 'iPhone'))).toBe(true);
    expect(isIos(env('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15', 'iPad'))).toBe(true);
  });
  it("riconosce iPadOS che si presenta come un Mac con schermo touch, ma non un Mac vero", () => {
    expect(isIos(env('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 'MacIntel', 5))).toBe(true);
    expect(isIos(env('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 'MacIntel', 0))).toBe(false);
  });
  it('non scambia Android o desktop per iOS', () => {
    expect(isIos(env('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'))).toBe(false);
    expect(isIos(env('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130', 'Win32', 0))).toBe(false);
  });
});

describe('opensWebcal', () => {
  it('iPhone, iPad e Mac aprono il calendario', () => {
    expect(opensWebcal(env('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15', 'iPhone'))).toBe(true);
    expect(opensWebcal(env('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 'MacIntel', 5))).toBe(true);
    expect(opensWebcal(env('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130', 'MacIntel', 0))).toBe(true);
  });
  it('Android e Windows no', () => {
    expect(opensWebcal(env('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'))).toBe(false);
    expect(opensWebcal(env('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130', 'Win32', 0))).toBe(false);
  });
});
