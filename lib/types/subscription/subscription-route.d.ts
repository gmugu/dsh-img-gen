import type { Context } from '@deepseek-ai/cordis';
import { SubscriptionManager } from './manager.js';
export { SUBSCRIPTION_LOGIN_ROUTE, SUBSCRIPTION_STATUS_ROUTE } from '../shared.js';
/** Register the login/status routes on the plugin's web server. */
export declare function registerSubscriptionRoutes(ctx: Context, manager: SubscriptionManager): void;
