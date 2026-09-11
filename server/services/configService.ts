export class ConfigService {
  /**
   * Evaluates if Demo Mode is enabled.
   * Priority:
   * 1. process.env.DEMO_MODE ('true' | '1' => true, 'false' | '0' => false)
   * 2. Defaults to true in development/test, false in production.
   */
  public static isDemoMode(): boolean {
    if (process.env.DEMO_MODE !== undefined) {
      return process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === '1';
    }
    return process.env.NODE_ENV !== 'production';
  }

  /**
   * Returns current public system configuration for the UI client.
   */
  public static getSystemConfig() {
    return {
      demoMode: this.isDemoMode(),
      nodeEnv: process.env.NODE_ENV || 'development'
    };
  }
}
